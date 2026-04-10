import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AttendanceStatus, ClassAttendanceStatus } from '@prisma/client';

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
      this.prisma.paymentSlip.findMany({ where: { monthId: recording.monthId } }),
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

  // ─── Shared upsert helper for class attendance ────────────

  private async doUpsertClassAttendance(
    userId: string,
    data: { classId: string; date: string; status: string; method?: string; note?: string; markedBy?: string },
  ) {
    return this.prisma.classAttendance.upsert({
      where: {
        userId_classId_date: { userId, classId: data.classId, date: new Date(data.date) },
      },
      update: {
        status: data.status as ClassAttendanceStatus,
        method: data.method || undefined,
        note: data.note || undefined,
        markedBy: data.markedBy || undefined,
      },
      create: {
        userId,
        classId: data.classId,
        date: new Date(data.date),
        status: data.status as ClassAttendanceStatus,
        method: data.method || null,
        note: data.note || null,
        markedBy: data.markedBy || null,
      },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true } } } },
      },
    });
  }

  /** Mark by barcodeId — single index lookup, fastest path (used by QR/barcode scanner) */
  async markByBarcode(data: { classId: string; barcode: string; date: string; status: string; note?: string; markedBy?: string }) {
    const profile = await this.prisma.profile.findUnique({
      where: { barcodeId: data.barcode },
      select: { userId: true },
    });
    if (!profile) throw new NotFoundException(`No student found for barcode: ${data.barcode}`);
    return this.doUpsertClassAttendance(profile.userId, { ...data, method: 'barcode' });
  }

  /** Mark by instituteId — single unique index lookup */
  async markByInstituteId(data: { classId: string; instituteId: string; date: string; status: string; note?: string; markedBy?: string }) {
    const profile = await this.prisma.profile.findUnique({
      where: { instituteId: data.instituteId },
      select: { userId: true },
    });
    if (!profile) throw new NotFoundException(`No student found for institute ID: ${data.instituteId}`);
    return this.doUpsertClassAttendance(profile.userId, { ...data, method: 'institute_id' });
  }

  /** Mark by phone number — single index lookup */
  async markByPhone(data: { classId: string; phone: string; date: string; status: string; note?: string; markedBy?: string }) {
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
    method?: string;
    markedBy?: string;
  }) {
    const dateObj = new Date(data.date);

    return this.prisma.$transaction(
      data.records.map((rec) =>
        this.prisma.classAttendance.upsert({
          where: {
            userId_classId_date: {
              userId: rec.userId,
              classId: data.classId,
              date: dateObj,
            },
          },
          update: {
            status: rec.status as ClassAttendanceStatus,
            method: data.method || undefined,
            note: rec.note || undefined,
            markedBy: data.markedBy || undefined,
          },
          create: {
            userId: rec.userId,
            classId: data.classId,
            date: dateObj,
            status: rec.status as ClassAttendanceStatus,
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
  async getClassAttendanceByDate(classId: string, date: string) {
    return this.prisma.classAttendance.findMany({
      where: {
        classId,
        date: new Date(date),
      },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true, barcodeId: true, phone: true } } } },
      },
      orderBy: { user: { profile: { fullName: 'asc' } } },
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
      orderBy: [{ date: 'asc' }, { user: { profile: { fullName: 'asc' } } }],
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
      orderBy: [{ date: 'asc' }, { user: { profile: { fullName: 'asc' } } }],
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
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Monitor: attendance grid for a class in a date range.
   * Returns only dates that have at least one record, plus all enrolled students.
   */
  async getClassAttendanceMonitor(classId: string, from: string, to: string) {
    const startDate = new Date(from);
    const endDate = new Date(to);

    const [enrollments, records] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { classId },
        include: { user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true } } } } },
        orderBy: { user: { profile: { fullName: 'asc' } } },
      }),
      this.prisma.classAttendance.findMany({
        where: { classId, date: { gte: startDate, lte: endDate } },
        select: { userId: true, date: true, status: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Unique dates that have at least one record
    const dateSet = new Set<string>();
    const grid: Record<string, Record<string, string>> = {}; // userId -> { dateStr -> status }
    for (const rec of records) {
      const ds = rec.date.toISOString().split('T')[0];
      dateSet.add(ds);
      if (!grid[rec.userId]) grid[rec.userId] = {};
      grid[rec.userId][ds] = rec.status;
    }

    const dates = Array.from(dateSet).sort();

    const students = enrollments.map(e => {
      const statuses = grid[e.userId] || {};
      let present = 0;
      let late = 0;
      let absent = 0;
      let excused = 0;
      for (const d of dates) {
        const s = statuses[d];
        if (s === 'PRESENT') present++;
        else if (s === 'LATE') late++;
        else if (s === 'ABSENT') absent++;
        else if (s === 'EXCUSED') excused++;
      }
      const attended = present + late;
      const pct = dates.length > 0 ? Math.round((attended / dates.length) * 100) : 0;

      return {
        userId: e.userId,
        fullName: e.user?.profile?.fullName || e.user?.email || '—',
        instituteId: e.user?.profile?.instituteId || '',
        avatarUrl: e.user?.profile?.avatarUrl || null,
        statuses,
        present,
        late,
        absent,
        excused,
        percentage: pct,
      };
    });

    return { dates, students };
  }

  /**
   * Delete a class attendance record.
   */
  async deleteClassAttendance(id: string) {
    return this.prisma.classAttendance.delete({ where: { id } });
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
      include: { month: { select: { id: true, name: true, year: true, month: true } } },
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
