import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ─── Helpers ───────────────────────────────────────────

  getPushDuration(): number {
    return parseInt(this.config.get('ATTENDANCE_PUSH_DURATION_SECONDS', '60'), 10);
  }

  getHeartbeatInterval(): number {
    return parseInt(this.config.get('HEARTBEAT_INTERVAL_SECONDS', '120'), 10);
  }

  /** Append an event entry to the details JSON log */
  private appendDetail(existing: any[] | null | undefined, entry: Record<string, any>): any[] {
    const log = Array.isArray(existing) ? existing : [];
    return [...log, { ...entry, at: new Date().toISOString() }];
  }

  // ─── Upsert-based Attendance (1 record per user+recording) ──

  /**
   * "Push" event — student watched enough to mark COMPLETED.
   * Upserts the single attendance row and appends a PUSH event to details.
   */
  async markCompleted(userId: string, recordingId: string, watchedSec: number) {
    const existing = await this.prisma.attendance.findUnique({
      where: { userId_recordingId: { userId, recordingId } },
    });

    const event = { type: 'PUSH', watchedSec };

    if (existing) {
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: 'COMPLETED',
          watchedSec,
          details: this.appendDetail(existing.details as any, event),
        },
      });
    }

    return this.prisma.attendance.create({
      data: {
        userId,
        recordingId,
        status: 'COMPLETED',
        watchedSec,
        details: this.appendDetail(null, event),
      },
    });
  }

  /**
   * INCOMPLETE attempt — user navigated away before push threshold.
   * Only creates if no record exists yet; otherwise appends an event.
   */
  async markIncomplete(userId: string, recordingId: string, watchedSec: number) {
    const existing = await this.prisma.attendance.findUnique({
      where: { userId_recordingId: { userId, recordingId } },
    });

    const event = { type: 'INCOMPLETE_EXIT', watchedSec };

    if (existing) {
      // Don't downgrade COMPLETED → INCOMPLETE. Just log the event.
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          watchedSec: Math.max(existing.watchedSec ?? 0, watchedSec),
          details: this.appendDetail(existing.details as any, event),
        },
      });
    }

    return this.prisma.attendance.create({
      data: {
        userId,
        recordingId,
        status: 'INCOMPLETE',
        watchedSec,
        details: this.appendDetail(null, event),
      },
    });
  }

  /**
   * Admin: manually mark attendance for a student.
   */
  async manualMark(data: { userId: string; recordingId?: string; eventName?: string }) {
    const event = { type: 'MANUAL', eventName: data.eventName || null };

    if (data.recordingId) {
      const existing = await this.prisma.attendance.findUnique({
        where: { userId_recordingId: { userId: data.userId, recordingId: data.recordingId } },
      });

      if (existing) {
        return this.prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status: 'MANUAL',
            eventName: data.eventName || existing.eventName,
            details: this.appendDetail(existing.details as any, event),
          },
        });
      }
    }

    return this.prisma.attendance.create({
      data: {
        userId: data.userId,
        recordingId: data.recordingId || null,
        eventName: data.eventName || null,
        status: 'MANUAL',
        details: this.appendDetail(null, event),
      },
    });
  }

  /**
   * Live join — marks attendance when student joins via live link.
   * Upserts and appends LIVE_JOIN event with timestamp.
   */
  async markLiveJoin(userId: string, recordingId: string) {
    const existing = await this.prisma.attendance.findUnique({
      where: { userId_recordingId: { userId, recordingId } },
    });

    const event = { type: 'LIVE_JOIN' };

    if (existing) {
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: 'COMPLETED',
          liveJoinedAt: existing.liveJoinedAt ?? new Date(),
          eventName: 'LIVE_JOIN',
          details: this.appendDetail(existing.details as any, event),
        },
      });
    }

    return this.prisma.attendance.create({
      data: {
        userId,
        recordingId,
        status: 'COMPLETED',
        eventName: 'LIVE_JOIN',
        liveJoinedAt: new Date(),
        details: this.appendDetail(null, event),
      },
    });
  }

  /**
   * Log a START event (student opened the recording player).
   * Creates the attendance row if it doesn't exist yet.
   */
  async logStart(userId: string, recordingId: string, videoPosition: number) {
    const existing = await this.prisma.attendance.findUnique({
      where: { userId_recordingId: { userId, recordingId } },
    });

    const event = { type: 'START', videoPosition };

    if (existing) {
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          details: this.appendDetail(existing.details as any, event),
        },
      });
    }

    return this.prisma.attendance.create({
      data: {
        userId,
        recordingId,
        status: 'INCOMPLETE',
        watchedSec: 0,
        details: this.appendDetail(null, event),
      },
    });
  }

  /**
   * Log an END event (student closed or left the recording player).
   */
  async logEnd(userId: string, recordingId: string, videoPosition: number, watchedSec: number) {
    const existing = await this.prisma.attendance.findUnique({
      where: { userId_recordingId: { userId, recordingId } },
    });
    if (!existing) return null;

    const event = { type: 'END', videoPosition, watchedSec };

    return this.prisma.attendance.update({
      where: { id: existing.id },
      data: {
        watchedSec: Math.max(existing.watchedSec ?? 0, watchedSec),
        details: this.appendDetail(existing.details as any, event),
      },
    });
  }

  // ─── Query Methods (unchanged logic) ───────────────────

  async getAll(filters?: { classId?: string; recordingId?: string; status?: string; page?: number; limit?: number }) {
    const where: any = {};
    if (filters?.recordingId) where.recordingId = filters.recordingId;
    if (filters?.status) where.status = filters.status;
    if (filters?.classId) where.recording = { month: { classId: filters.classId } };

    const take = filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 200) : 50;
    const skip = filters?.page && filters.page > 1 ? (filters.page - 1) * take : 0;

    const [data, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        include: {
          user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true } } } },
          recording: { select: { title: true, month: { select: { name: true, class: { select: { name: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return { data, total, page: filters?.page || 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  async getByUser(userId: string) {
    return this.prisma.attendance.findMany({
      where: { userId },
      include: {
        recording: { select: { title: true, month: { select: { name: true, class: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getByClass(classId: string) {
    return this.prisma.attendance.findMany({
      where: { recording: { month: { classId } } },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true } } } },
        recording: { select: { title: true, month: { select: { name: true, class: { select: { id: true, name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getByRecording(recordingId: string) {
    return this.prisma.attendance.findMany({
      where: { recordingId },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin: aggregated student stats for a recording.
   * Returns all enrolled students with attendance, watch session stats, and payment info.
   */
  async getRecordingStudentStats(recordingId: string) {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      include: { month: { include: { class: true } } },
    });
    if (!recording) throw new NotFoundException('Recording not found');

    const classId = recording.month.classId;

    const [enrollments, attendances, sessions, payments] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { classId },
        include: { user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true, phone: true, status: true } } } } },
      }),
      this.prisma.attendance.findMany({ where: { recordingId } }),
      this.prisma.watchSession.findMany({ where: { recordingId }, orderBy: { startedAt: 'desc' } }),
      this.prisma.paymentSlip.findMany({
        where: { monthId: recording.monthId },
        select: { id: true, userId: true, monthId: true, status: true, type: true, createdAt: true },
      }),
    ]);

    const attMap = new Map<string, (typeof attendances)[0]>();
    for (const a of attendances) attMap.set(a.userId, a);

    const sessionMap = new Map<string, (typeof sessions)>();
    for (const s of sessions) {
      if (!sessionMap.has(s.userId)) sessionMap.set(s.userId, []);
      sessionMap.get(s.userId)!.push(s);
    }

    const payMap = new Map<string, (typeof payments)[0]>();
    for (const p of payments) {
      const ex = payMap.get(p.userId);
      if (!ex || p.status === 'VERIFIED' || (p.status === 'PENDING' && ex.status !== 'VERIFIED')) {
        payMap.set(p.userId, p);
      }
    }

    const isFree = recording.month.status === 'ANYONE';
    const seen = new Set<string>();
    const students: any[] = [];

    const buildRow = (uid: string, user: any, enrolled: boolean) => {
      const att = attMap.get(uid);
      const userSessions = sessionMap.get(uid) || [];
      const pay = payMap.get(uid);
      const totalWatchedSec = userSessions.reduce((sum, s) => sum + (s.totalWatchedSec || 0), 0);
      return {
        userId: uid,
        user,
        enrolled,
        attendanceStatus: att?.status || null,
        attendanceWatchedSec: att?.watchedSec || 0,
        liveJoinedAt: att?.liveJoinedAt || null,
        attendanceDetails: att?.details || [],
        completedAt: att?.status === 'COMPLETED' ? att.updatedAt : null,
        sessionCount: userSessions.length,
        totalWatchedSec,
        lastWatchedAt: userSessions[0]?.startedAt || null,
        paymentStatus: isFree ? 'FREE' : (pay?.status || 'NOT_PAID'),
        sessions: userSessions.map(s => ({
          id: s.id,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          videoStartPos: s.videoStartPos,
          videoEndPos: s.videoEndPos,
          totalWatchedSec: s.totalWatchedSec,
          status: s.status,
          events: s.events,
        })),
      };
    };

    for (const enr of enrollments) {
      if (seen.has(enr.userId)) continue;
      seen.add(enr.userId);
      students.push(buildRow(enr.userId, enr.user, true));
    }

    // Include non-enrolled users who have attendance or sessions
    const extraIds = new Set<string>();
    for (const a of attendances) if (!seen.has(a.userId)) extraIds.add(a.userId);
    for (const s of sessions) if (!seen.has(s.userId)) extraIds.add(s.userId);

    if (extraIds.size > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...extraIds] } },
        include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true, phone: true, status: true } } },
      });
      const userMap = new Map(users.map(u => [u.id, u]));
      for (const uid of extraIds) {
        seen.add(uid);
        students.push(buildRow(uid, userMap.get(uid) || null, false));
      }
    }

    return {
      recording: {
        id: recording.id,
        title: recording.title,
        duration: recording.duration,
        isLive: recording.isLive,
        videoType: recording.videoType,
      },
      month: { id: recording.month.id, name: recording.month.name },
      class: { id: recording.month.class.id, name: recording.month.class.name },
      students,
      totals: {
        enrolled: students.filter(s => s.enrolled).length,
        completed: students.filter(s => s.attendanceStatus === 'COMPLETED').length,
        incomplete: students.filter(s => s.attendanceStatus === 'INCOMPLETE').length,
        notViewed: students.filter(s => s.sessionCount === 0).length,
      },
    };
  }

  // ─── Watch Session Methods (unchanged) ─────────────────

  /** Admin: get a single student's watch stats for a specific recording */
  async getStudentRecordingStats(recordingId: string, userId: string) {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      include: { month: { include: { class: true } } },
    });
    if (!recording) throw new NotFoundException('Recording not found');

    const [enrollment, attendance, sessions, payment, user] = await Promise.all([
      this.prisma.enrollment.findUnique({
        where: { userId_classId: { userId, classId: recording.month.classId } },
      }),
      this.prisma.attendance.findUnique({ where: { userId_recordingId: { userId, recordingId } } }),
      this.prisma.watchSession.findMany({
        where: { userId, recordingId },
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.paymentSlip.findFirst({
        where: { userId, monthId: recording.monthId, type: 'MONTHLY', status: 'VERIFIED' },
        select: { id: true, status: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { profile: { select: { fullName: true, instituteId: true, phone: true, status: true, avatarUrl: true } } },
      }),
    ]);

    const isFree = recording.month.status === 'ANYONE';
    let paymentStatus = isFree ? 'FREE' : 'NOT_PAID';
    if (!isFree) {
      if (payment) {
        paymentStatus = 'VERIFIED';
      } else {
        const pending = await this.prisma.paymentSlip.findFirst({
          where: { userId, monthId: recording.monthId, type: 'MONTHLY' },
          select: { id: true, status: true },
          orderBy: { createdAt: 'desc' },
        });
        paymentStatus = pending?.status || 'NOT_PAID';
      }
    }

    const totalWatchedSec = sessions.reduce((sum, s) => sum + (s.totalWatchedSec || 0), 0);

    return {
      recording: {
        id: recording.id,
        title: recording.title,
        duration: recording.duration,
        isLive: recording.isLive,
        videoType: recording.videoType,
        thumbnail: recording.thumbnail,
      },
      month: { id: recording.month.id, name: recording.month.name },
      class: { id: recording.month.class.id, name: recording.month.class.name },
      student: {
        userId,
        user,
        enrolled: !!enrollment,
        attendanceStatus: attendance?.status || null,
        attendanceWatchedSec: attendance?.watchedSec || 0,
        liveJoinedAt: attendance?.liveJoinedAt || null,
        attendanceDetails: attendance?.details || [],
        completedAt: attendance?.status === 'COMPLETED' ? attendance.updatedAt : null,
        sessionCount: sessions.length,
        totalWatchedSec,
        lastWatchedAt: sessions.length > 0 ? sessions[sessions.length - 1].startedAt : null,
        firstWatchedAt: sessions.length > 0 ? sessions[0].startedAt : null,
        paymentStatus,
        sessions: sessions.map(s => ({
          id: s.id,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          videoStartPos: s.videoStartPos,
          videoEndPos: s.videoEndPos,
          totalWatchedSec: s.totalWatchedSec,
          status: s.status,
          events: s.events,
        })),
      },
    };
  }

  async startSession(userId: string, recordingId: string, videoPosition: number, events?: any[]) {
    await this.prisma.watchSession.updateMany({
      where: { userId, recordingId, status: 'WATCHING' },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    // Also log a START in the attendance record
    await this.logStart(userId, recordingId, videoPosition);

    return this.prisma.watchSession.create({
      data: {
        userId, recordingId,
        videoStartPos: videoPosition, videoEndPos: videoPosition,
        totalWatchedSec: 0, status: 'WATCHING',
        events: events || [],
      },
    });
  }

  async heartbeat(userId: string, sessionId: string, videoPosition: number, watchedSec: number, events?: any[]) {
    const session = await this.prisma.watchSession.findFirst({
      where: { id: sessionId, userId, status: 'WATCHING' },
    });
    if (!session) return null;

    const existingEvents = Array.isArray(session.events) ? session.events as any[] : [];
    const mergedEvents = events ? [...existingEvents, ...events] : existingEvents;

    return this.prisma.watchSession.update({
      where: { id: sessionId },
      data: {
        videoEndPos: videoPosition,
        totalWatchedSec: Math.max(session.totalWatchedSec, watchedSec),
        endedAt: new Date(),
        events: mergedEvents,
      },
    });
  }

  async endSession(userId: string, sessionId: string, videoPosition: number, watchedSec: number, events?: any[]) {
    const session = await this.prisma.watchSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) return null;

    const existingEvents = Array.isArray(session.events) ? session.events as any[] : [];
    const mergedEvents = events ? [...existingEvents, ...events] : existingEvents;

    const finalWatched = Math.max(session.totalWatchedSec, watchedSec);

    // Also log END in attendance record
    await this.logEnd(userId, session.recordingId, videoPosition, finalWatched);

    return this.prisma.watchSession.update({
      where: { id: sessionId },
      data: {
        videoEndPos: videoPosition,
        totalWatchedSec: finalWatched,
        endedAt: new Date(), status: 'ENDED',
        events: mergedEvents,
      },
    });
  }

  async endSessionBySessionId(sessionId: string, videoPosition: number, watchedSec: number, events?: any[]) {
    const session = await this.prisma.watchSession.findFirst({
      where: { id: sessionId, status: 'WATCHING' },
    });
    if (!session) return null;

    const existingEvents = Array.isArray(session.events) ? session.events as any[] : [];
    const mergedEvents = events ? [...existingEvents, ...events] : existingEvents;

    const finalWatched = Math.max(session.totalWatchedSec, watchedSec);

    // Also log END in attendance record
    await this.logEnd(session.userId, session.recordingId, videoPosition, finalWatched);

    return this.prisma.watchSession.update({
      where: { id: sessionId },
      data: {
        videoEndPos: videoPosition,
        totalWatchedSec: finalWatched,
        endedAt: new Date(), status: 'ENDED',
        events: mergedEvents,
      },
    });
  }

  async getWatchHistory(userId: string) {
    return this.prisma.watchSession.findMany({
      where: { userId },
      include: {
        recording: {
          select: { title: true, thumbnail: true, duration: true, month: { select: { name: true, class: { select: { name: true } } } } },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
  }

  async getAllWatchSessions(page?: number, limit?: number) {
    const take = limit && limit > 0 ? Math.min(limit, 200) : 50;
    const skip = page && page > 1 ? (page - 1) * take : 0;

    const [data, total] = await Promise.all([
      this.prisma.watchSession.findMany({
        include: {
          user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true } } } },
          recording: { select: { title: true, month: { select: { name: true, class: { select: { name: true } } } } } },
        },
        orderBy: { startedAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.watchSession.count(),
    ]);

    return { data, total, page: page || 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  async getRecordingWatchHistory(recordingId: string) {
    return this.prisma.watchSession.findMany({
      where: { recordingId },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true } } } },
      },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
  }

  async getSessionsByRecording(userId: string, recordingId: string) {
    return this.prisma.watchSession.findMany({
      where: { userId, recordingId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getWatchSessionsByClass(classId: string) {
    return this.prisma.watchSession.findMany({
      where: { recording: { month: { classId } } },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true } } } },
        recording: { select: { title: true, month: { select: { name: true } } } },
      },
      orderBy: { startedAt: 'desc' },
      take: 500,
    });
  }

  // ─── Class Attendance (Physical / Date-based) ──────────

  /**
   * Resolve a student identifier (userId, instituteId, or barcode) to a userId.
   */
  async resolveStudentId(identifier: string): Promise<string> {
    // Try direct userId
    const byId = await this.prisma.user.findUnique({ where: { id: identifier } });
    if (byId) return byId.id;

    // Try instituteId
    const byInstituteId = await this.prisma.profile.findUnique({
      where: { instituteId: identifier },
      select: { userId: true },
    });
    if (byInstituteId) return byInstituteId.userId;

    // Try barcodeId
    const byBarcode = await this.prisma.profile.findUnique({
      where: { barcodeId: identifier },
      select: { userId: true },
    });
    if (byBarcode) return byBarcode.userId;

    // Try email
    const byEmail = await this.prisma.user.findUnique({ where: { email: identifier } });
    if (byEmail) return byEmail.id;

    throw new NotFoundException(`Student not found for identifier: ${identifier}`);
  }

  private normalizeClassAttendanceDate(date: string): Date {
    const raw = (date || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) {
      throw new BadRequestException('Invalid class attendance date');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const dateObj = new Date(Date.UTC(year, month - 1, day));

    if (
      dateObj.getUTCFullYear() !== year
      || dateObj.getUTCMonth() !== month - 1
      || dateObj.getUTCDate() !== day
    ) {
      throw new BadRequestException('Invalid class attendance date');
    }

    return dateObj;
  }

  private normalizeSessionTime(sessionTime?: string): string {
    const raw = (sessionTime || '').trim();
    if (!raw) return '00:00';
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(raw)) {
      throw new BadRequestException('sessionTime must be in HH:mm format');
    }
    return raw;
  }

  private normalizeSessionCode(sessionCode?: string): string | null {
    const raw = (sessionCode || '').trim();
    return raw || null;
  }

  private normalizeClassAttendanceStatus(status?: string): string {
    const normalized = (status || 'PRESENT').trim().toUpperCase();
    if (normalized === 'PRESENT' || normalized === 'ABSENT' || normalized === 'LATE' || normalized === 'EXCUSED') {
      return normalized as string;
    }
    throw new BadRequestException('status must be PRESENT, ABSENT, LATE, or EXCUSED');
  }

  private resolveSessionAt(date: string, sessionTime: string, sessionAt?: string): Date | null {
    const raw = (sessionAt || '').trim();
    if (raw) {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid sessionAt');
      }
      return parsed;
    }

    if (sessionTime === '00:00') return null;
    const parsed = new Date(`${date}T${sessionTime}:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private normalizeSessionMeta(data: { date: string; sessionTime?: string; sessionCode?: string; sessionAt?: string }) {
    const sessionTime = this.normalizeSessionTime(data.sessionTime);
    const sessionCode = this.normalizeSessionCode(data.sessionCode);
    const sessionAt = this.resolveSessionAt(data.date, sessionTime, data.sessionAt);
    return { sessionTime, sessionCode, sessionAt };
  }

  private getIsoWeekLabel(dateIso: string): string {
    const date = new Date(`${dateIso}T00:00:00Z`);
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  private normalizeAttendanceWeekName(name: string): string {
    const value = (name || '').trim();
    if (!value) {
      throw new BadRequestException('Week name is required');
    }
    if (value.length > 120) {
      throw new BadRequestException('Week name must be 120 characters or less');
    }
    return value;
  }

  private parseClassAttendanceSessionKey(sessionKey: string) {
    const raw = (sessionKey || '').trim();
    const [rawDate = '', rawTime = '00:00'] = raw.split('|');
    const date = rawDate.trim();

    if (!date) {
      throw new BadRequestException(`Invalid session key: ${sessionKey}`);
    }

    const dateObj = this.normalizeClassAttendanceDate(date);
    const sessionTime = this.normalizeSessionTime(rawTime.trim() || '00:00');

    return {
      key: `${date}|${sessionTime}`,
      date,
      dateObj,
      sessionTime,
    };
  }

  private buildClassAttendanceSessionRow(data: {
    sessionId?: string | null;
    date: string;
    sessionTime: string;
    sessionCode: string | null;
    sessionAt: string | null;
    recordsCount: number;
    source: 'CREATED' | 'ATTENDANCE' | 'BOTH';
    weekId?: string | null;
    weekName?: string | null;
  }) {
    const timeSuffix = data.sessionTime === '00:00' ? '' : ` ${data.sessionTime}`;
    const labelCore = data.sessionCode || `${data.date}${timeSuffix}`;

    return {
      sessionId: data.sessionId || null,
      key: `${data.date}|${data.sessionTime}`,
      date: data.date,
      sessionTime: data.sessionTime,
      sessionCode: data.sessionCode,
      sessionAt: data.sessionAt,
      label: data.sessionCode ? `${labelCore} (${data.date}${timeSuffix})` : labelCore,
      recordsCount: data.recordsCount,
      source: data.source,
      weekId: data.weekId || null,
      weekName: data.weekName || null,
    };
  }

  // ─── Shared upsert helper for class attendance ────────────

  private async doUpsertClassAttendance(
    userId: string,
    data: {
      classId: string;
      date: string;
      status: string;
      sessionTime?: string;
      sessionCode?: string;
      sessionAt?: string;
      method?: string;
      note?: string;
      markedBy?: string;
    },
  ) {
    const dateObj = this.normalizeClassAttendanceDate(data.date);
    const { sessionTime, sessionCode, sessionAt } = this.normalizeSessionMeta(data);

    return this.prisma.classAttendance.upsert({
      where: {
        userId_classId_date_sessionTime: {
          userId,
          classId: data.classId,
          date: dateObj,
          sessionTime,
        },
      },
      update: {
        status: data.status as any,
        method: data.method || undefined,
        note: data.note || undefined,
        markedBy: data.markedBy || undefined,
        sessionCode: sessionCode || undefined,
        sessionAt: sessionAt || undefined,
      },
      create: {
        userId,
        classId: data.classId,
        date: dateObj,
        sessionTime,
        sessionCode,
        sessionAt,
        status: data.status as any,
        method: data.method || null,
        note: data.note || null,
        markedBy: data.markedBy || null,
      },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true } } } },
      },
    });
  }

  private async getClassAttendanceSessionForPublicImport(sessionId: string) {
    const session = await this.prisma.classAttendanceSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        classId: true,
        date: true,
        sessionTime: true,
        sessionCode: true,
        sessionAt: true,
        class: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Class attendance session not found: ${sessionId}`);
    }

    return {
      id: session.id,
      classId: session.classId,
      className: session.class?.name || null,
      date: session.date.toISOString().split('T')[0],
      sessionTime: this.normalizeSessionTime(session.sessionTime),
      sessionCode: (session.sessionCode || '').trim() || null,
      sessionAt: session.sessionAt ? session.sessionAt.toISOString() : null,
    };
  }

  private async assertStudentEnrolledForSessionClass(userId: string, classId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_classId: {
          userId,
          classId,
        },
      },
      select: { id: true },
    });

    if (!enrollment) {
      throw new BadRequestException('Student is not enrolled in the class for this session');
    }
  }

  async importPublicClassAttendanceBySessionBarcode(data: {
    sessionId: string;
    barcode: string;
    status: string;
    sessionAt?: string;
    note?: string;
  }) {
    const [session, profile] = await Promise.all([
      this.getClassAttendanceSessionForPublicImport(data.sessionId),
      this.prisma.profile.findUnique({
        where: { barcodeId: data.barcode },
        select: {
          userId: true,
          fullName: true,
          instituteId: true,
          barcodeId: true,
        },
      }),
    ]);

    if (!profile) {
      throw new NotFoundException(`No student found for barcode: ${data.barcode}`);
    }

    await this.assertStudentEnrolledForSessionClass(profile.userId, session.classId);

    const markedAt = (data.sessionAt || '').trim() ? data.sessionAt : new Date().toISOString();
    const record = await this.doUpsertClassAttendance(profile.userId, {
      classId: session.classId,
      date: session.date,
      sessionTime: session.sessionTime,
      sessionCode: session.sessionCode || undefined,
      sessionAt: markedAt,
      status: data.status,
      note: data.note,
      method: 'public_import_barcode',
    });

    return {
      session,
      student: {
        userId: profile.userId,
        fullName: profile.fullName || null,
        instituteId: profile.instituteId || null,
        barcodeId: profile.barcodeId || null,
      },
      attendance: {
        id: record.id,
        status: record.status,
        date: record.date.toISOString().split('T')[0],
        sessionTime: record.sessionTime,
        sessionCode: record.sessionCode || null,
        sessionAt: record.sessionAt ? record.sessionAt.toISOString() : null,
        method: record.method || null,
        note: record.note || null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    };
  }

  async importPublicClassAttendanceBySessionInstituteId(data: {
    sessionId: string;
    instituteId: string;
    status: string;
    sessionAt?: string;
    note?: string;
  }) {
    const [session, profile] = await Promise.all([
      this.getClassAttendanceSessionForPublicImport(data.sessionId),
      this.prisma.profile.findUnique({
        where: { instituteId: data.instituteId },
        select: {
          userId: true,
          fullName: true,
          instituteId: true,
          barcodeId: true,
        },
      }),
    ]);

    if (!profile) {
      throw new NotFoundException(`No student found for institute ID: ${data.instituteId}`);
    }

    await this.assertStudentEnrolledForSessionClass(profile.userId, session.classId);

    const markedAt = (data.sessionAt || '').trim() ? data.sessionAt : new Date().toISOString();
    const record = await this.doUpsertClassAttendance(profile.userId, {
      classId: session.classId,
      date: session.date,
      sessionTime: session.sessionTime,
      sessionCode: session.sessionCode || undefined,
      sessionAt: markedAt,
      status: data.status,
      note: data.note,
      method: 'public_import_institute_id',
    });

    return {
      session,
      student: {
        userId: profile.userId,
        fullName: profile.fullName || null,
        instituteId: profile.instituteId || null,
        barcodeId: profile.barcodeId || null,
      },
      attendance: {
        id: record.id,
        status: record.status,
        date: record.date.toISOString().split('T')[0],
        sessionTime: record.sessionTime,
        sessionCode: record.sessionCode || null,
        sessionAt: record.sessionAt ? record.sessionAt.toISOString() : null,
        method: record.method || null,
        note: record.note || null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    };
  }

  async importPublicClassAttendanceBulkBySessionInstituteId(data: {
    sessionId: string;
    classId: string;
    records: Array<{
      studentInstituteId: string;
      date?: string;
      checkInTime?: string;
      checkInAt?: string;
      status?: string;
      note?: string;
    }>;
  }) {
    const session = await this.getClassAttendanceSessionForPublicImport(data.sessionId);
    const requestedClassId = (data.classId || '').trim();

    if (!requestedClassId) {
      throw new BadRequestException('classId is required');
    }

    if (session.classId !== requestedClassId) {
      throw new BadRequestException('sessionId does not belong to the provided classId');
    }

    const successful: Array<{
      index: number;
      studentInstituteId: string;
      userId: string;
      attendanceId: string;
      status: string;
      sessionAt: string | null;
    }> = [];
    const failed: Array<{
      index: number;
      studentInstituteId: string;
      reason: string;
    }> = [];

    for (let i = 0; i < data.records.length; i += 1) {
      const row = data.records[i];
      const index = i + 1;
      const studentInstituteId = (row.studentInstituteId || '').trim();

      if (!studentInstituteId) {
        failed.push({
          index,
          studentInstituteId: '',
          reason: 'studentInstituteId is required',
        });
        continue;
      }

      try {
        const status = this.normalizeClassAttendanceStatus(row.status);

        const checkInAtRaw = (row.checkInAt || '').trim();
        let rowSessionAtIso = '';

        if (checkInAtRaw) {
          const parsed = new Date(checkInAtRaw);
          if (Number.isNaN(parsed.getTime())) {
            throw new BadRequestException('Invalid checkInAt');
          }
          rowSessionAtIso = parsed.toISOString();
        } else {
          const rowDate = (row.date || session.date || '').trim() || session.date;
          this.normalizeClassAttendanceDate(rowDate);
          if (rowDate !== session.date) {
            throw new BadRequestException(`date must match session date ${session.date}`);
          }

          const rowCheckInTimeRaw = (row.checkInTime || '').trim();
          const rowCheckInTime = rowCheckInTimeRaw
            ? this.normalizeSessionTime(rowCheckInTimeRaw)
            : this.normalizeSessionTime(session.sessionTime);

          if (rowCheckInTime === '00:00') {
            rowSessionAtIso = new Date().toISOString();
          } else {
            const parsed = new Date(`${rowDate}T${rowCheckInTime}:00`);
            if (Number.isNaN(parsed.getTime())) {
              throw new BadRequestException('Invalid checkInTime');
            }
            rowSessionAtIso = parsed.toISOString();
          }
        }

        const profile = await this.prisma.profile.findUnique({
          where: { instituteId: studentInstituteId },
          select: {
            userId: true,
          },
        });

        if (!profile) {
          throw new NotFoundException(`No student found for institute ID: ${studentInstituteId}`);
        }

        await this.assertStudentEnrolledForSessionClass(profile.userId, session.classId);

        const attendance = await this.doUpsertClassAttendance(profile.userId, {
          classId: session.classId,
          date: session.date,
          sessionTime: session.sessionTime,
          sessionCode: session.sessionCode || undefined,
          sessionAt: rowSessionAtIso,
          status,
          note: row.note,
          method: 'public_import_institute_id_bulk',
        });

        successful.push({
          index,
          studentInstituteId,
          userId: profile.userId,
          attendanceId: attendance.id,
          status: attendance.status,
          sessionAt: attendance.sessionAt ? attendance.sessionAt.toISOString() : null,
        });
      } catch (error: any) {
        const message = error?.message;
        const reason = Array.isArray(message)
          ? message.join(', ')
          : (typeof message === 'string' && message.trim()
            ? message
            : 'Failed to import attendance');

        failed.push({
          index,
          studentInstituteId,
          reason,
        });
      }
    }

    const totalRecords = data.records.length;
    const successCount = successful.length;
    const failedCount = failed.length;

    return {
      session,
      classId: session.classId,
      summary: {
        totalRecords,
        successCount,
        failedCount,
      },
      successful,
      failed,
    };
  }

  /** Mark by barcodeId — single index lookup, fastest path (used by QR/barcode scanner) */
  async markByBarcode(data: {
    classId: string;
    barcode: string;
    date: string;
    status: string;
    sessionTime?: string;
    sessionCode?: string;
    sessionAt?: string;
    note?: string;
    markedBy?: string;
  }) {
    const profile = await this.prisma.profile.findUnique({
      where: { barcodeId: data.barcode },
      select: { userId: true },
    });
    if (!profile) throw new NotFoundException(`No student found for barcode: ${data.barcode}`);
    return this.doUpsertClassAttendance(profile.userId, { ...data, method: 'barcode' });
  }

  /** Mark by instituteId — single unique index lookup */
  async markByInstituteId(data: {
    classId: string;
    instituteId: string;
    date: string;
    status: string;
    sessionTime?: string;
    sessionCode?: string;
    sessionAt?: string;
    note?: string;
    markedBy?: string;
  }) {
    const profile = await this.prisma.profile.findUnique({
      where: { instituteId: data.instituteId },
      select: { userId: true },
    });
    if (!profile) throw new NotFoundException(`No student found for institute ID: ${data.instituteId}`);
    return this.doUpsertClassAttendance(profile.userId, { ...data, method: 'institute_id' });
  }

  /** Mark by phone number — single index lookup */
  async markByPhone(data: {
    classId: string;
    phone: string;
    date: string;
    status: string;
    sessionTime?: string;
    sessionCode?: string;
    sessionAt?: string;
    note?: string;
    markedBy?: string;
  }) {
    const profile = await this.prisma.profile.findFirst({
      where: { phone: data.phone },
      select: { userId: true },
    });
    if (!profile) throw new NotFoundException(`No student found for phone: ${data.phone}`);
    return this.doUpsertClassAttendance(profile.userId, { ...data, method: 'phone' });
  }

  /**
   * Mark class attendance for a single student (by identifier).
   * Generic fallback — resolves in up to 4 queries. Prefer specific endpoints above.
   */
  async markClassAttendance(data: {
    classId: string;
    identifier: string;
    date: string;
    status: string;
    sessionTime?: string;
    sessionCode?: string;
    sessionAt?: string;
    method?: string;
    note?: string;
    markedBy?: string;
  }) {
    const userId = await this.resolveStudentId(data.identifier);
    return this.doUpsertClassAttendance(userId, data);
  }

  /**
   * Bulk mark class attendance for a date.
   */
  async bulkMarkClassAttendance(data: {
    classId: string;
    date: string;
    records: Array<{ userId: string; status: string; note?: string }>;
    sessionTime?: string;
    sessionCode?: string;
    sessionAt?: string;
    method?: string;
    markedBy?: string;
  }) {
    const dateObj = this.normalizeClassAttendanceDate(data.date);
    const { sessionTime, sessionCode, sessionAt } = this.normalizeSessionMeta(data);

    return this.prisma.$transaction(
      data.records.map((rec) =>
        this.prisma.classAttendance.upsert({
          where: {
            userId_classId_date_sessionTime: {
              userId: rec.userId,
              classId: data.classId,
              date: dateObj,
              sessionTime,
            },
          },
          update: {
            status: rec.status as any,
            method: data.method || undefined,
            note: rec.note || undefined,
            markedBy: data.markedBy || undefined,
            sessionCode: sessionCode || undefined,
            sessionAt: sessionAt || undefined,
          },
          create: {
            userId: rec.userId,
            classId: data.classId,
            date: dateObj,
            sessionTime,
            sessionCode,
            sessionAt,
            status: rec.status as any,
            method: data.method || 'bulk',
            note: rec.note || null,
            markedBy: data.markedBy || null,
          },
        }),
      ),
    );
  }

  /**
   * Get class attendance for a specific date.
   */
  async getClassAttendanceByDate(classId: string, date: string, sessionTime?: string) {
    const where: any = {
      classId,
      date: this.normalizeClassAttendanceDate(date),
    };

    if (sessionTime && sessionTime.trim()) {
      where.sessionTime = this.normalizeSessionTime(sessionTime);
    }

    return this.prisma.classAttendance.findMany({
      where,
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true, barcodeId: true, phone: true } } } },
      },
      orderBy: [
        { sessionTime: 'asc' },
        { user: { profile: { fullName: 'asc' } } },
      ],
    });
  }

  /**
   * Get class attendance for a month (all dates in month).
   */
  async getClassAttendanceByMonth(classId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // last day of month

    return this.prisma.classAttendance.findMany({
      where: {
        classId,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true, barcodeId: true } } } },
      },
      orderBy: [
        { date: 'asc' },
        { sessionTime: 'asc' },
        { user: { profile: { fullName: 'asc' } } },
      ],
    });
  }

  /**
   * Get class attendance for a full year.
   */
  async getClassAttendanceByYear(classId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    return this.prisma.classAttendance.findMany({
      where: {
        classId,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true, barcodeId: true } } } },
      },
      orderBy: [
        { date: 'asc' },
        { sessionTime: 'asc' },
        { user: { profile: { fullName: 'asc' } } },
      ],
    });
  }

  /**
   * Get a specific student's class attendance history.
   */
  async getStudentClassAttendance(userId: string, classId?: string) {
    const where: any = { userId };
    if (classId) where.classId = classId;

    return this.prisma.classAttendance.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'desc' }, { sessionTime: 'desc' }],
    });
  }

  /**
   * Monitor: attendance grid for a class in a date range.
   * Returns only dates that have at least one record, plus all enrolled students.
   */
  async getClassAttendanceMonitor(
    classId: string,
    from: string,
    to: string,
    sessionTime?: string,
  ) {
    const startDate = this.normalizeClassAttendanceDate(from);
    const endDate = this.normalizeClassAttendanceDate(to);
    const attendanceWhere: any = { classId, date: { gte: startDate, lte: endDate } };

    if (sessionTime && sessionTime.trim()) {
      attendanceWhere.sessionTime = this.normalizeSessionTime(sessionTime);
    }

    const [enrollments, records] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { classId },
        include: {
          user: {
            include: {
              profile: {
                select: {
                  fullName: true,
                  instituteId: true,
                  avatarUrl: true,
                  barcodeId: true,
                  phone: true,
                },
              },
            },
          },
        },
        orderBy: { user: { profile: { fullName: 'asc' } } },
      }),
      this.prisma.classAttendance.findMany({
        where: attendanceWhere,
        select: {
          userId: true,
          date: true,
          status: true,
          sessionTime: true,
          sessionCode: true,
          sessionAt: true,
        },
        orderBy: [{ date: 'asc' }, { sessionTime: 'asc' }],
      }),
    ]);

    const dateSet = new Set<string>();
    const slotMap = new Map<string, {
      key: string;
      date: string;
      sessionTime: string;
      sessionCode: string | null;
      sessionAt: string | null;
      week: string;
      label: string;
    }>();
    const grid: Record<string, Record<string, string>> = {};

    for (const rec of records) {
      const ds = rec.date.toISOString().split('T')[0];
      dateSet.add(ds);

      const sessionTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(rec.sessionTime || '') ? rec.sessionTime : '00:00';
      const sessionCode = (rec.sessionCode || '').trim() || null;
      const slotKey = `${ds}|${sessionTime}`;

      if (!slotMap.has(slotKey)) {
        const week = this.getIsoWeekLabel(ds);
        const displayCore = sessionCode || (sessionTime === '00:00' ? ds : sessionTime);
        const timeSuffix = sessionTime === '00:00' ? '' : ` ${sessionTime}`;
        slotMap.set(slotKey, {
          key: slotKey,
          date: ds,
          sessionTime,
          sessionCode,
          sessionAt: rec.sessionAt ? rec.sessionAt.toISOString() : null,
          week,
          label: `${displayCore} (${ds}${timeSuffix})`,
        });
      }

      if (!grid[rec.userId]) grid[rec.userId] = {};
      grid[rec.userId][slotKey] = rec.status;
    }

    const dates = Array.from(dateSet).sort();
    const slots = Array.from(slotMap.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.sessionTime.localeCompare(b.sessionTime);
    });

    const students = enrollments.map(e => {
      const statuses = grid[e.userId] || {};
      let present = 0;
      let late = 0;
      let absent = 0;
      let excused = 0;
      for (const slot of slots) {
        const s = statuses[slot.key];
        if (s === 'PRESENT') present++;
        else if (s === 'LATE') late++;
        else if (s === 'ABSENT') absent++;
        else if (s === 'EXCUSED') excused++;
      }
      const attended = present + late;
      const pct = slots.length > 0 ? Math.round((attended / slots.length) * 100) : 0;

      return {
        userId: e.userId,
        fullName: e.user?.profile?.fullName || e.user?.email || '—',
        instituteId: e.user?.profile?.instituteId || '',
        avatarUrl: e.user?.profile?.avatarUrl || null,
        phone: e.user?.profile?.phone || null,
        barcodeId: e.user?.profile?.barcodeId || null,
        statuses,
        present,
        late,
        absent,
        excused,
        percentage: pct,
      };
    });

    return { dates, slots, students };
  }

  /**
   * Delete a class attendance record.
   */
  async deleteClassAttendance(id: string) {
    return this.prisma.classAttendance.delete({ where: { id } });
  }

  /**
   * Get all distinct dates that have at least one attendance record for a class.
   * Used by the frontend calendar to highlight class-held days.
   */
  async getClassAttendanceDates(classId: string): Promise<string[]> {
    const records = await this.prisma.classAttendance.findMany({
      where: { classId },
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'asc' },
    });
    return records.map(r => r.date.toISOString().split('T')[0]);
  }

  /**
   * Create or update a class attendance session definition without attendance rows.
   */
  async createClassAttendanceSession(
    classId: string,
    data: { date: string; sessionTime?: string; sessionCode?: string; sessionAt?: string },
    createdBy?: string,
  ) {
    const dateObj = this.normalizeClassAttendanceDate(data.date);
    const { sessionTime, sessionCode, sessionAt } = this.normalizeSessionMeta(data);

    const session = await this.prisma.classAttendanceSession.upsert({
      where: {
        classId_date_sessionTime: {
          classId,
          date: dateObj,
          sessionTime,
        },
      },
      update: {
        sessionCode: sessionCode || undefined,
        sessionAt: sessionAt || undefined,
        createdBy: createdBy || undefined,
      },
      create: {
        classId,
        date: dateObj,
        sessionTime,
        sessionCode,
        sessionAt,
        createdBy: createdBy || null,
      },
    });

    const recordsCount = await this.prisma.classAttendance.count({
      where: {
        classId,
        date: dateObj,
        sessionTime,
      },
    });

    return this.buildClassAttendanceSessionRow({
      sessionId: session.id,
      date: session.date.toISOString().split('T')[0],
      sessionTime,
      sessionCode: session.sessionCode || null,
      sessionAt: session.sessionAt ? session.sessionAt.toISOString() : null,
      recordsCount,
      source: recordsCount > 0 ? 'BOTH' : 'CREATED',
      weekId: session.weekId || null,
    });
  }

  /**
   * Get distinct class attendance sessions (date + session time) for quick selection.
   * Returns newest sessions first.
   */
  async getClassAttendanceSessions(classId: string, limit = 200) {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.trunc(limit), 1), 1000)
      : 200;

    const [createdSessions, records] = await Promise.all([
      this.prisma.classAttendanceSession.findMany({
        where: { classId },
        select: {
          id: true,
          date: true,
          sessionTime: true,
          sessionCode: true,
          sessionAt: true,
          weekId: true,
          week: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [
          { date: 'desc' },
          { sessionTime: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: safeLimit * 5,
      }),
      this.prisma.classAttendance.findMany({
        where: { classId },
        select: {
          date: true,
          sessionTime: true,
          sessionCode: true,
          sessionAt: true,
        },
        orderBy: [
          { date: 'desc' },
          { sessionTime: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: safeLimit * 20,
      }),
    ]);

    const sessionMap = new Map<string, {
      sessionId: string | null;
      key: string;
      date: string;
      sessionTime: string;
      sessionCode: string | null;
      sessionAt: string | null;
      label: string;
      recordsCount: number;
      source: 'CREATED' | 'ATTENDANCE' | 'BOTH';
      weekId: string | null;
      weekName: string | null;
    }>();

    for (const session of createdSessions) {
      const date = session.date.toISOString().split('T')[0];
      const sessionTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(session.sessionTime || '')
        ? session.sessionTime
        : '00:00';
      const sessionCode = (session.sessionCode || '').trim() || null;
      const sessionAt = session.sessionAt ? session.sessionAt.toISOString() : null;

      const row = this.buildClassAttendanceSessionRow({
        sessionId: session.id,
        date,
        sessionTime,
        sessionCode,
        sessionAt,
        recordsCount: 0,
        source: 'CREATED',
        weekId: session.weekId || null,
        weekName: session.week?.name || null,
      });
      sessionMap.set(row.key, row);
    }

    for (const record of records) {
      const date = record.date.toISOString().split('T')[0];
      const sessionTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(record.sessionTime || '')
        ? record.sessionTime
        : '00:00';
      const key = `${date}|${sessionTime}`;
      const sessionCode = (record.sessionCode || '').trim() || null;
      const sessionAt = record.sessionAt ? record.sessionAt.toISOString() : null;

      const existing = sessionMap.get(key);
      if (!existing) {
        const row = this.buildClassAttendanceSessionRow({
          sessionId: null,
          date,
          sessionTime,
          sessionCode,
          sessionAt,
          recordsCount: 1,
          source: 'ATTENDANCE',
          weekId: null,
          weekName: null,
        });
        sessionMap.set(key, row);
        continue;
      }

      existing.recordsCount += 1;
      if (!existing.sessionCode && sessionCode) {
        existing.sessionCode = sessionCode;
        const timeSuffix = existing.sessionTime === '00:00' ? '' : ` ${existing.sessionTime}`;
        existing.label = `${sessionCode} (${existing.date}${timeSuffix})`;
      }
      if (!existing.sessionAt && sessionAt) {
        existing.sessionAt = sessionAt;
      }
      if (existing.source === 'CREATED') {
        existing.source = 'BOTH';
      }
    }

    return Array.from(sessionMap.values())
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.sessionTime.localeCompare(a.sessionTime);
      })
      .slice(0, safeLimit);
  }

  /**
   * Assign or clear week for a single class attendance session row.
   * Uses session key format: YYYY-MM-DD|HH:mm
   */
  async updateClassAttendanceSessionWeek(
    classId: string,
    data: { sessionKey: string; weekId?: string | null },
    updatedBy?: string,
  ) {
    const parsedSession = this.parseClassAttendanceSessionKey(data.sessionKey);
    const requestedWeekId = (typeof data.weekId === 'string' ? data.weekId.trim() : '') || null;

    const [targetWeek, existingSession, attendanceMeta, recordsCount] = await Promise.all([
      requestedWeekId
        ? this.prisma.classAttendanceWeek.findFirst({
          where: { id: requestedWeekId, classId },
          select: { id: true, name: true },
        })
        : Promise.resolve(null),
      this.prisma.classAttendanceSession.findUnique({
        where: {
          classId_date_sessionTime: {
            classId,
            date: parsedSession.dateObj,
            sessionTime: parsedSession.sessionTime,
          },
        },
        select: {
          id: true,
          date: true,
          sessionTime: true,
          sessionCode: true,
          sessionAt: true,
          weekId: true,
          week: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.classAttendance.findFirst({
        where: {
          classId,
          date: parsedSession.dateObj,
          sessionTime: parsedSession.sessionTime,
        },
        select: {
          sessionCode: true,
          sessionAt: true,
        },
        orderBy: [
          { updatedAt: 'desc' },
        ],
      }),
      this.prisma.classAttendance.count({
        where: {
          classId,
          date: parsedSession.dateObj,
          sessionTime: parsedSession.sessionTime,
        },
      }),
    ]);

    if (requestedWeekId && !targetWeek) {
      throw new NotFoundException('Week group not found');
    }

    if (!existingSession && !requestedWeekId) {
      const attendanceSessionCode = (attendanceMeta?.sessionCode || '').trim() || null;
      const attendanceSessionAt = attendanceMeta?.sessionAt
        ? attendanceMeta.sessionAt.toISOString()
        : null;

      return this.buildClassAttendanceSessionRow({
        sessionId: null,
        date: parsedSession.date,
        sessionTime: parsedSession.sessionTime,
        sessionCode: attendanceSessionCode,
        sessionAt: attendanceSessionAt,
        recordsCount,
        source: recordsCount > 0 ? 'ATTENDANCE' : 'CREATED',
        weekId: null,
        weekName: null,
      });
    }

    const attendanceSessionCode = (attendanceMeta?.sessionCode || '').trim() || null;
    const attendanceSessionAt = attendanceMeta?.sessionAt || null;

    const session = await this.prisma.classAttendanceSession.upsert({
      where: {
        classId_date_sessionTime: {
          classId,
          date: parsedSession.dateObj,
          sessionTime: parsedSession.sessionTime,
        },
      },
      update: {
        weekId: requestedWeekId,
        createdBy: updatedBy || undefined,
      },
      create: {
        classId,
        weekId: requestedWeekId,
        date: parsedSession.dateObj,
        sessionTime: parsedSession.sessionTime,
        sessionCode: attendanceSessionCode,
        sessionAt: attendanceSessionAt,
        createdBy: updatedBy || null,
      },
      select: {
        id: true,
        date: true,
        sessionTime: true,
        sessionCode: true,
        sessionAt: true,
        weekId: true,
        week: {
          select: {
            name: true,
          },
        },
      },
    });

    const sessionCode = (session.sessionCode || '').trim() || attendanceSessionCode;
    const sessionAt = session.sessionAt
      ? session.sessionAt.toISOString()
      : attendanceSessionAt
        ? attendanceSessionAt.toISOString()
        : null;

    return this.buildClassAttendanceSessionRow({
      sessionId: session.id,
      date: session.date.toISOString().split('T')[0],
      sessionTime: /^([01]\d|2[0-3]):([0-5]\d)$/.test(session.sessionTime || '')
        ? session.sessionTime
        : parsedSession.sessionTime,
      sessionCode,
      sessionAt,
      recordsCount,
      source: recordsCount > 0 ? 'BOTH' : 'CREATED',
      weekId: session.weekId || null,
      weekName: session.week?.name || targetWeek?.name || null,
    });
  }

  /**
   * Create a persisted attendance week and optionally link selected class sessions to it.
   */
  async createClassAttendanceWeek(
    classId: string,
    data: { name: string; sessionKeys?: string[] },
    createdBy?: string,
  ) {
    const name = this.normalizeAttendanceWeekName(data.name);
    const requestedSessionKeys = Array.isArray(data.sessionKeys) ? data.sessionKeys : [];
    const parsedSessions = Array.from(
      new Map(requestedSessionKeys.map((sessionKey) => {
        const parsed = this.parseClassAttendanceSessionKey(sessionKey);
        return [parsed.key, parsed] as const;
      })).values(),
    );

    const existingLinkedSessions = parsedSessions.length > 0
      ? await this.prisma.classAttendanceSession.findMany({
        where: {
          classId,
          OR: parsedSessions.map((session) => ({
            date: session.dateObj,
            sessionTime: session.sessionTime,
          })),
          NOT: { weekId: null },
        },
        select: {
          date: true,
          sessionTime: true,
          week: {
            select: {
              name: true,
            },
          },
        },
      })
      : [];

    if (existingLinkedSessions.length > 0) {
      const conflictSummary = existingLinkedSessions
        .map((session) => {
          const date = session.date.toISOString().split('T')[0];
          const weekName = session.week?.name || 'another week';
          return `${date}|${session.sessionTime} (${weekName})`;
        })
        .join(', ');
      throw new BadRequestException(`Some sessions are already assigned: ${conflictSummary}`);
    }

    let createdWeekId = '';

    try {
      const createdWeek = await this.prisma.$transaction(async (tx) => {
        const lastWeek = await tx.classAttendanceWeek.findFirst({
          where: { classId },
          orderBy: [
            { orderNo: 'desc' },
            { createdAt: 'desc' },
          ],
          select: { orderNo: true },
        });

        const week = await tx.classAttendanceWeek.create({
          data: {
            classId,
            name,
            orderNo: (lastWeek?.orderNo || 0) + 1,
            createdBy: createdBy || null,
          },
          select: { id: true },
        });

        for (const session of parsedSessions) {
          await tx.classAttendanceSession.upsert({
            where: {
              classId_date_sessionTime: {
                classId,
                date: session.dateObj,
                sessionTime: session.sessionTime,
              },
            },
            update: {
              weekId: week.id,
              createdBy: createdBy || undefined,
            },
            create: {
              classId,
              weekId: week.id,
              date: session.dateObj,
              sessionTime: session.sessionTime,
              sessionCode: null,
              sessionAt: null,
              createdBy: createdBy || null,
            },
          });
        }

        return week;
      });

      createdWeekId = createdWeek.id;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException(`Week name already exists: ${name}`);
      }
      throw error;
    }

    const weeks = await this.getClassAttendanceWeeks(classId);
    const createdWeek = weeks.find((week) => week.id === createdWeekId);
    if (!createdWeek) {
      throw new NotFoundException('Created week could not be loaded');
    }
    return createdWeek;
  }

  /**
   * List persisted attendance weeks for a class with linked sessions.
   */
  async getClassAttendanceWeeks(classId: string) {
    const [weeks, counts] = await Promise.all([
      this.prisma.classAttendanceWeek.findMany({
        where: { classId },
        select: {
          id: true,
          name: true,
          orderNo: true,
          sessions: {
            select: {
              id: true,
              date: true,
              sessionTime: true,
              sessionCode: true,
              sessionAt: true,
            },
            orderBy: [
              { date: 'asc' },
              { sessionTime: 'asc' },
            ],
          },
        },
        orderBy: [
          { orderNo: 'asc' },
          { createdAt: 'asc' },
        ],
      }),
      this.prisma.classAttendance.groupBy({
        by: ['date', 'sessionTime'],
        where: { classId },
        _count: {
          _all: true,
        },
      }),
    ]);

    const countBySessionKey = new Map<string, number>();
    counts.forEach((item) => {
      const date = item.date.toISOString().split('T')[0];
      const sessionTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(item.sessionTime || '')
        ? item.sessionTime
        : '00:00';
      countBySessionKey.set(`${date}|${sessionTime}`, item._count._all);
    });

    return weeks.map((week) => {
      const sessions = week.sessions.map((session) => {
        const date = session.date.toISOString().split('T')[0];
        const sessionTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(session.sessionTime || '')
          ? session.sessionTime
          : '00:00';
        const sessionCode = (session.sessionCode || '').trim() || null;
        const sessionAt = session.sessionAt ? session.sessionAt.toISOString() : null;
        const recordsCount = countBySessionKey.get(`${date}|${sessionTime}`) || 0;

        return this.buildClassAttendanceSessionRow({
          sessionId: session.id,
          date,
          sessionTime,
          sessionCode,
          sessionAt,
          recordsCount,
          source: recordsCount > 0 ? 'BOTH' : 'CREATED',
          weekId: week.id,
          weekName: week.name,
        });
      });

      return {
        id: week.id,
        name: week.name,
        orderNo: week.orderNo,
        sessions,
        sessionCount: sessions.length,
      };
    });
  }

  /**
   * Delete a persisted attendance week and unlink sessions from it.
   */
  async deleteClassAttendanceWeek(classId: string, weekId: string) {
    const week = await this.prisma.classAttendanceWeek.findFirst({
      where: { id: weekId, classId },
      select: { id: true, name: true },
    });

    if (!week) {
      throw new NotFoundException('Week group not found');
    }

    const unlinkedSessions = await this.prisma.$transaction(async (tx) => {
      const result = await tx.classAttendanceSession.updateMany({
        where: { classId, weekId },
        data: { weekId: null },
      });

      await tx.classAttendanceWeek.delete({ where: { id: weekId } });
      return result.count;
    });

    return {
      id: week.id,
      name: week.name,
      deleted: true,
      unlinkedSessions,
    };
  }

  /**
   * Close a class date: mark all enrolled students who have NO record for that
   * date as ABSENT. Returns the list of students marked absent.
   */
  async closeClassDate(classId: string, date: string, markedBy: string) {
    const dateObj = this.normalizeClassAttendanceDate(date);

    const [enrollments, existing] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { classId },
        select: { userId: true },
      }),
      this.prisma.classAttendance.findMany({
        where: { classId, date: dateObj },
        select: { userId: true, status: true },
      }),
    ]);

    const markedUserIds = new Set(existing.map(r => r.userId));
    const absentUserIds = enrollments
      .map(e => e.userId)
      .filter(uid => !markedUserIds.has(uid));

    if (absentUserIds.length === 0) {
      return { marked: 0, absentStudents: [] };
    }

    await this.prisma.classAttendance.createMany({
      data: absentUserIds.map(userId => ({
        userId,
        classId,
        date: dateObj,
        sessionTime: '00:00',
        sessionCode: 'AUTO_CLOSE',
        status: 'ABSENT' as any,
        method: 'auto-close',
        markedBy,
      })),
      skipDuplicates: true,
    });

    // Return the newly marked absent students with profile info
    const absentStudents = await this.prisma.classAttendance.findMany({
      where: { classId, date: dateObj, userId: { in: absentUserIds } },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true, phone: true } } } },
      },
      orderBy: { user: { profile: { fullName: 'asc' } } },
    });

    return { marked: absentUserIds.length, absentStudents };
  }

  /**
   * Close a specific class attendance session (date + session time).
   * Marks ABSENT for enrolled students who have no record in this session.
   */
  async closeClassSession(
    classId: string,
    data: { date: string; sessionTime?: string; sessionCode?: string; sessionAt?: string },
    markedBy: string,
  ) {
    const dateObj = this.normalizeClassAttendanceDate(data.date);
    const sessionTime = this.normalizeSessionTime(data.sessionTime);
    const sessionCode = this.normalizeSessionCode(data.sessionCode);
    const sessionAt = this.resolveSessionAt(data.date, sessionTime, data.sessionAt);

    const [enrollments, existing] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { classId },
        select: { userId: true },
      }),
      this.prisma.classAttendance.findMany({
        where: {
          classId,
          date: dateObj,
          sessionTime,
        },
        select: { userId: true },
      }),
    ]);

    const markedUserIds = new Set(existing.map((row) => row.userId));
    const absentUserIds = enrollments
      .map((row) => row.userId)
      .filter((userId) => !markedUserIds.has(userId));

    if (absentUserIds.length === 0) {
      return {
        marked: 0,
        session: {
          date: data.date,
          sessionTime,
          sessionCode: sessionCode || null,
        },
        absentStudents: [],
      };
    }

    await this.prisma.classAttendance.createMany({
      data: absentUserIds.map((userId) => ({
        userId,
        classId,
        date: dateObj,
        sessionTime,
        sessionCode: sessionCode || 'AUTO_CLOSE',
        sessionAt: sessionAt || null,
        status: 'ABSENT' as any,
        method: 'auto-close-session',
        markedBy,
      })),
      skipDuplicates: true,
    });

    const absentStudents = await this.prisma.classAttendance.findMany({
      where: {
        classId,
        date: dateObj,
        sessionTime,
        userId: { in: absentUserIds },
      },
      include: {
        user: {
          include: {
            profile: {
              select: {
                fullName: true,
                instituteId: true,
                avatarUrl: true,
                phone: true,
                barcodeId: true,
              },
            },
          },
        },
      },
      orderBy: { user: { profile: { fullName: 'asc' } } },
    });

    return {
      marked: absentUserIds.length,
      session: {
        date: data.date,
        sessionTime,
        sessionCode: sessionCode || null,
      },
      absentStudents,
    };
  }

  /**
   * Get enrolled students for a class (for bulk attendance marking).
   */
  async getEnrolledStudentsForClass(classId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true, barcodeId: true, phone: true, status: true } } } },
      },
      orderBy: { user: { profile: { fullName: 'asc' } } },
    });

    return enrollments.map(e => ({
      userId: e.userId,
      fullName: e.user.profile?.fullName || e.user.email,
      instituteId: e.user.profile?.instituteId || '-',
      barcodeId: e.user.profile?.barcodeId || null,
      phone: e.user.profile?.phone || null,
      status: e.user.profile?.status || null,
      avatarUrl: e.user.profile?.avatarUrl || null,
    }));
  }

  /**
   * Get class-wise student payment status with submissions.
   */
  /** Student: get my attendance for selected recordings (1 or more), grouped by month */
  async getMyRecordingsAttendance(userId: string, recordingIds: string[]) {
    if (!recordingIds.length) {
      throw new BadRequestException('Provide at least one recording ID');
    }

    const [user, recordings, attendances, sessions] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true,
          profile: {
            select: {
              fullName: true, instituteId: true, avatarUrl: true,
              phone: true, status: true,
            },
          },
        },
      }),
      this.prisma.recording.findMany({
        where: { id: { in: recordingIds } },
        select: {
          id: true, title: true, duration: true, thumbnail: true,
          topic: true, isLive: true, order: true, videoType: true,
          month: {
            select: {
              id: true, name: true, year: true, month: true,
              class: { select: { id: true, name: true, subject: true } },
            },
          },
        },
      }),
      this.prisma.attendance.findMany({
        where: { userId, recordingId: { in: recordingIds } },
        select: {
          recordingId: true, status: true, watchedSec: true,
          liveJoinedAt: true, updatedAt: true, details: true,
        },
      }),
      this.prisma.watchSession.findMany({
        where: { userId, recordingId: { in: recordingIds } },
        select: {
          recordingId: true, totalWatchedSec: true,
          startedAt: true, endedAt: true, status: true,
          videoStartPos: true, videoEndPos: true, events: true,
        },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    const attMap = new Map(attendances.map(a => [a.recordingId!, a]));

    // Group sessions by recordingId
    const sessionMap = new Map<string, typeof sessions>();
    for (const s of sessions) {
      if (!sessionMap.has(s.recordingId)) sessionMap.set(s.recordingId, []);
      sessionMap.get(s.recordingId)!.push(s);
    }

    const monthMap = new Map<string, {
      month: { id: string; name: string; year: number; month: number; class: any };
      recordings: any[];
    }>();

    for (const rec of recordings) {
      const m = rec.month;
      if (!monthMap.has(m.id)) {
        monthMap.set(m.id, { month: m, recordings: [] });
      }
      const att = attMap.get(rec.id) || null;
      const recSessions = sessionMap.get(rec.id) || [];
      const totalWatchedSec = recSessions.reduce((sum, s) => sum + (s.totalWatchedSec || 0), 0);

      monthMap.get(m.id)!.recordings.push({
        id: rec.id,
        title: rec.title,
        duration: rec.duration,
        thumbnail: rec.thumbnail,
        topic: rec.topic,
        isLive: rec.isLive,
        order: rec.order,
        videoType: rec.videoType,
        attendance: att
          ? {
              status: att.status,
              watchedSec: att.watchedSec,
              liveJoinedAt: att.liveJoinedAt,
              completedAt: att.status === 'COMPLETED' ? att.updatedAt : null,
              details: att.details,
            }
          : null,
        sessionCount: recSessions.length,
        totalWatchedSec,
        lastWatchedAt: recSessions[0]?.startedAt || null,
        sessions: recSessions.map(s => ({
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          videoStartPos: s.videoStartPos,
          videoEndPos: s.videoEndPos,
          totalWatchedSec: s.totalWatchedSec,
          status: s.status,
          events: s.events,
        })),
      });
    }

    const result = Array.from(monthMap.values());
    for (const entry of result) {
      entry.recordings.sort((a, b) => a.order - b.order);
    }
    result.sort((a, b) => {
      if (a.month.year !== b.month.year) return a.month.year - b.month.year;
      return a.month.month - b.month.month;
    });

    return { user, months: result };
  }

  /** Student: get my own class (physical) attendance, optionally filtered by classId */
  async getMyClassAttendance(userId: string, classId?: string) {
    const where: any = { userId };
    if (classId) where.classId = classId;

    const records = await this.prisma.classAttendance.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, subject: true } },
      },
      orderBy: { date: 'desc' },
    });

    // Group records by class
    const classMap = new Map<string, { class: { id: string; name: string; subject: string | null }; records: any[]; summary: any }>();

    for (const rec of records) {
      const cid = rec.class.id;
      if (!classMap.has(cid)) {
        classMap.set(cid, { class: rec.class, records: [], summary: { total: 0, present: 0, late: 0, absent: 0, excused: 0 } });
      }
      const entry = classMap.get(cid)!;
      entry.records.push({
        id: rec.id,
        date: rec.date,
        sessionTime: rec.sessionTime,
        sessionCode: rec.sessionCode,
        sessionAt: rec.sessionAt,
        status: rec.status,
        method: rec.method,
        note: rec.note,
      });
      entry.summary.total++;
      if (rec.status === 'PRESENT') entry.summary.present++;
      else if (rec.status === 'LATE') entry.summary.late++;
      else if (rec.status === 'ABSENT') entry.summary.absent++;
      else if (rec.status === 'EXCUSED') entry.summary.excused++;
    }

    const classes = Array.from(classMap.values()).map(c => ({
      ...c,
      summary: {
        ...c.summary,
        attendancePercentage: c.summary.total > 0
          ? Math.round(((c.summary.present + c.summary.late) / c.summary.total) * 100)
          : 0,
      },
    }));

    return {
      userId,
      totalClasses: classes.length,
      classes,
    };
  }

  /** Student: get my attendance for all recordings in a specific class month */
  async getMyMonthAttendance(userId: string, monthId: string) {
    const [month, attendances, sessionAgg] = await Promise.all([
      this.prisma.month.findUnique({
        where: { id: monthId },
        select: {
          id: true, name: true, year: true, month: true,
          class: { select: { id: true, name: true, subject: true } },
          recordings: {
            where: { status: { not: 'INACTIVE' } },
            orderBy: { order: 'asc' },
            select: {
              id: true, title: true, duration: true, thumbnail: true,
              topic: true, isLive: true, order: true, videoType: true, status: true,
            },
          },
        },
      }),
      this.prisma.attendance.findMany({
        where: { userId, recording: { monthId } },
        select: {
          recordingId: true, status: true, watchedSec: true,
          liveJoinedAt: true, updatedAt: true, details: true,
        },
      }),
      // Lightweight aggregate: only count + sum per recording (no row data)
      this.prisma.watchSession.groupBy({
        by: ['recordingId'],
        where: { userId, recording: { monthId } },
        _count: { id: true },
        _sum: { totalWatchedSec: true },
        _max: { startedAt: true },
      }),
    ]);

    if (!month) throw new NotFoundException('Month not found');

    const attMap = new Map(attendances.map(a => [a.recordingId!, a]));

    const aggMap = new Map(sessionAgg.map(a => [a.recordingId, {
      count: a._count.id,
      totalWatchedSec: a._sum.totalWatchedSec || 0,
      lastWatchedAt: a._max.startedAt,
    }]));

    const recordings = month.recordings.map(rec => {
      const att = attMap.get(rec.id) || null;
      const agg = aggMap.get(rec.id) || { count: 0, totalWatchedSec: 0, lastWatchedAt: null };
      return {
        id: rec.id,
        title: rec.title,
        duration: rec.duration,
        thumbnail: rec.thumbnail,
        topic: rec.topic,
        isLive: rec.isLive,
        order: rec.order,
        videoType: rec.videoType,
        status: rec.status,
        attendance: att
          ? {
              status: att.status,
              watchedSec: att.watchedSec,
              liveJoinedAt: att.liveJoinedAt,
              completedAt: att.status === 'COMPLETED' ? att.updatedAt : null,
              details: att.details,
            }
          : null,
        sessionCount: agg.count,
        totalWatchedSec: agg.totalWatchedSec,
        lastWatchedAt: agg.lastWatchedAt,
      };
    });

    const completed = recordings.filter(r => r.attendance?.status === 'COMPLETED').length;
    const total = recordings.length;

    return {
      month: { id: month.id, name: month.name, year: month.year, month: month.month, class: month.class },
      recordings,
      summary: { total, completed, incomplete: recordings.filter(r => r.attendance?.status === 'INCOMPLETE').length, notWatched: recordings.filter(r => !r.attendance).length },
    };
  }

  /** Student: get my watch sessions for a single recording (lazy-loaded) */
  async getMyRecordingSessions(userId: string, recordingId: string) {
    const sessions = await this.prisma.watchSession.findMany({
      where: { userId, recordingId },
      select: {
        startedAt: true, endedAt: true, status: true,
        videoStartPos: true, videoEndPos: true, totalWatchedSec: true,
      },
      orderBy: { startedAt: 'desc' },
    });
    return sessions;
  }

  /**
   * Admin: get all students' attendance for 1–3 selected recordings, grouped by month.
   * Each student row shows per-recording attendance + watch sessions, same shape as getRecordingStudentStats.
   */
  async getRecordingsUsersAttendance(recordingIds: string[], page?: number, limit?: number) {
    if (!recordingIds.length) {
      throw new BadRequestException('Provide at least one recording ID');
    }

    // Load recordings + their months/classes
    const recordings = await this.prisma.recording.findMany({
      where: { id: { in: recordingIds } },
      select: {
        id: true, title: true, duration: true, thumbnail: true,
        topic: true, isLive: true, order: true, videoType: true,
        monthId: true,
        month: {
          select: {
            id: true, name: true, year: true, month: true, status: true,
            classId: true,
            class: { select: { id: true, name: true, subject: true } },
          },
        },
      },
    });

    if (!recordings.length) return { months: [], students: [] };

    // Collect all unique classIds and monthIds across the selected recordings
    const classIds = [...new Set(recordings.map(r => r.month.classId))];
    const monthIds = [...new Set(recordings.map(r => r.monthId))];

    const [enrollments, attendances, sessions, payments] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { classId: { in: classIds } },
        include: {
          user: {
            include: {
              profile: { select: { fullName: true, instituteId: true, avatarUrl: true, phone: true, status: true } },
            },
          },
        },
        orderBy: { user: { profile: { fullName: 'asc' } } },
      }),
      this.prisma.attendance.findMany({
        where: { recordingId: { in: recordingIds } },
      }),
      this.prisma.watchSession.findMany({
        where: { recordingId: { in: recordingIds } },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.paymentSlip.findMany({
        where: { monthId: { in: monthIds } },
        select: { id: true, userId: true, monthId: true, status: true, type: true, createdAt: true },
      }),
    ]);

    // att keyed by userId+recordingId
    const attMap = new Map<string, (typeof attendances)[0]>();
    for (const a of attendances) attMap.set(`${a.userId}:${a.recordingId}`, a);

    // sessions keyed by userId+recordingId
    const sessionMap = new Map<string, (typeof sessions)>();
    for (const s of sessions) {
      const key = `${s.userId}:${s.recordingId}`;
      if (!sessionMap.has(key)) sessionMap.set(key, []);
      sessionMap.get(key)!.push(s);
    }

    // payment keyed by userId+monthId (best status wins)
    const payMap = new Map<string, (typeof payments)[0]>();
    for (const p of payments) {
      const key = `${p.userId}:${p.monthId}`;
      const ex = payMap.get(key);
      if (!ex || p.status === 'VERIFIED' || (p.status === 'PENDING' && ex.status !== 'VERIFIED')) {
        payMap.set(key, p);
      }
    }

    // isFree map per monthId
    const isFreeMap = new Map<string, boolean>();
    for (const r of recordings) isFreeMap.set(r.monthId, r.month.status === 'ANYONE');

    const buildRecordingRow = (uid: string, rec: (typeof recordings)[0]) => {
      const att = attMap.get(`${uid}:${rec.id}`) || null;
      const userSessions = sessionMap.get(`${uid}:${rec.id}`) || [];
      const totalWatchedSec = userSessions.reduce((sum, s) => sum + (s.totalWatchedSec || 0), 0);
      const isFree = isFreeMap.get(rec.monthId) ?? false;
      const pay = payMap.get(`${uid}:${rec.monthId}`) || null;

      return {
        recordingId: rec.id,
        attendanceStatus: att?.status || null,
        attendanceWatchedSec: att?.watchedSec || 0,
        liveJoinedAt: att?.liveJoinedAt || null,
        completedAt: att?.status === 'COMPLETED' ? att.updatedAt : null,
        sessionCount: userSessions.length,
        totalWatchedSec,
        lastWatchedAt: userSessions[0]?.startedAt || null,
        paymentStatus: isFree ? 'FREE' : (pay?.status || 'NOT_PAID'),
        sessions: userSessions.map(s => ({
          id: s.id,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          totalWatchedSec: s.totalWatchedSec,
          status: s.status,
        })),
      };
    };

    // Build student list from enrollments + anyone who has attendance/session but isn't enrolled
    const seen = new Set<string>();
    const students: any[] = [];

    for (const enr of enrollments) {
      if (seen.has(enr.userId)) continue;
      seen.add(enr.userId);
      students.push({
        userId: enr.userId,
        user: enr.user,
        enrolled: true,
        recordings: recordings.map(rec => buildRecordingRow(enr.userId, rec)),
      });
    }

    const extraIds = new Set<string>();
    for (const a of attendances) if (!seen.has(a.userId)) extraIds.add(a.userId);
    for (const s of sessions) if (!seen.has(s.userId)) extraIds.add(s.userId);

    if (extraIds.size > 0) {
      const extraUsers = await this.prisma.user.findMany({
        where: { id: { in: [...extraIds] } },
        include: {
          profile: { select: { fullName: true, instituteId: true, avatarUrl: true, phone: true, status: true } },
        },
      });
      const userMap = new Map(extraUsers.map(u => [u.id, u]));
      for (const uid of extraIds) {
        seen.add(uid);
        students.push({
          userId: uid,
          user: userMap.get(uid) || null,
          enrolled: false,
          recordings: recordings.map(rec => buildRecordingRow(uid, rec)),
        });
      }
    }

    // Build months metadata grouped by month (recordings sorted by order)
    const monthMap = new Map<string, { month: any; recordings: any[] }>();
    for (const rec of recordings) {
      const m = rec.month;
      if (!monthMap.has(m.id)) {
        monthMap.set(m.id, {
          month: { id: m.id, name: m.name, year: m.year, month: m.month, class: m.class },
          recordings: [],
        });
      }
      monthMap.get(m.id)!.recordings.push({
        id: rec.id, title: rec.title, duration: rec.duration,
        thumbnail: rec.thumbnail, topic: rec.topic, isLive: rec.isLive,
        order: rec.order, videoType: rec.videoType,
      });
    }
    for (const entry of monthMap.values()) {
      entry.recordings.sort((a, b) => a.order - b.order);
    }
    const months = Array.from(monthMap.values()).sort((a, b) => {
      if (a.month.year !== b.month.year) return a.month.year - b.month.year;
      return a.month.month - b.month.month;
    });

    const take = limit && limit > 0 ? Math.min(limit, 200) : 50;
    const skip = page && page > 1 ? (page - 1) * take : 0;
    const total = students.length;
    const paginated = students.slice(skip, skip + take);

    return {
      months,
      students: paginated,
      total,
      page: page || 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async getClassStudentPayments(classId: string) {
    // Get all months for this class
    const months = await this.prisma.month.findMany({
      where: { classId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    // Get enrolled students
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true, barcodeId: true, phone: true, status: true } } } },
      },
      orderBy: { user: { profile: { fullName: 'asc' } } },
    });

    // Get all payments for these months
    const monthIds = months.map(m => m.id);
    const payments = await this.prisma.paymentSlip.findMany({
      where: { monthId: { in: monthIds } },
      select: {
        id: true, userId: true, monthId: true, status: true, type: true, createdAt: true, amount: true,
        month: { select: { id: true, name: true, year: true, month: true } },
      },
    });

    // Build student payment map
    const studentPayments = enrollments.map(e => {
      const studentPaymentsByMonth = months.map(m => {
        const slips = payments.filter(p => p.userId === e.userId && p.monthId === m.id);
        const verified = slips.find(s => s.status === 'VERIFIED');
        const pending = slips.find(s => s.status === 'PENDING');
        const latest = slips[0];
        return {
          monthId: m.id,
          monthName: m.name,
          year: m.year,
          month: m.month,
          status: verified ? 'PAID' : pending ? 'PENDING' : 'UNPAID',
          slipCount: slips.length,
          latestSlipId: latest?.id || null,
          latestSlipStatus: latest?.status || null,
        };
      });

      const paidCount = studentPaymentsByMonth.filter(p => p.status === 'PAID').length;
      const pendingCount = studentPaymentsByMonth.filter(p => p.status === 'PENDING').length;
      const unpaidCount = studentPaymentsByMonth.filter(p => p.status === 'UNPAID').length;

      return {
        userId: e.userId,
        fullName: e.user.profile?.fullName || e.user.email,
        instituteId: e.user.profile?.instituteId || '-',
        barcodeId: e.user.profile?.barcodeId || null,
        phone: e.user.profile?.phone || null,
        avatarUrl: e.user.profile?.avatarUrl || null,
        studentStatus: e.user.profile?.status || null,
        months: studentPaymentsByMonth,
        paidCount,
        pendingCount,
        unpaidCount,
      };
    });

    return { months, students: studentPayments };
  }
}
