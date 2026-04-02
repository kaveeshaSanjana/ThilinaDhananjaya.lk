import { Injectable, NotFoundException } from '@nestjs/common';
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

  async getAll(filters?: { classId?: string; recordingId?: string; status?: string }) {
    const where: any = {};
    if (filters?.recordingId) where.recordingId = filters.recordingId;
    if (filters?.status) where.status = filters.status;
    if (filters?.classId) where.recording = { month: { classId: filters.classId } };

    return this.prisma.attendance.findMany({
      where,
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true } } } },
        recording: { select: { title: true, month: { select: { name: true, class: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
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
        user: { include: { profile: { select: { fullName: true, instituteId: true } } } },
        recording: { select: { title: true, month: { select: { name: true, class: { select: { id: true, name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getByRecording(recordingId: string) {
    return this.prisma.attendance.findMany({
      where: { recordingId },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Watch Session Methods (unchanged) ─────────────────

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
        totalWatchedSec: session.totalWatchedSec + watchedSec,
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

    // Also log END in attendance record
    await this.logEnd(userId, session.recordingId, videoPosition, session.totalWatchedSec + watchedSec);

    return this.prisma.watchSession.update({
      where: { id: sessionId },
      data: {
        videoEndPos: videoPosition,
        totalWatchedSec: session.totalWatchedSec + watchedSec,
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

    // Also log END in attendance record
    await this.logEnd(session.userId, session.recordingId, videoPosition, session.totalWatchedSec + watchedSec);

    return this.prisma.watchSession.update({
      where: { id: sessionId },
      data: {
        videoEndPos: videoPosition,
        totalWatchedSec: session.totalWatchedSec + watchedSec,
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

  async getAllWatchSessions() {
    return this.prisma.watchSession.findMany({
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true } } } },
        recording: { select: { title: true, month: { select: { name: true, class: { select: { name: true } } } } } },
      },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
  }

  async getRecordingWatchHistory(recordingId: string) {
    return this.prisma.watchSession.findMany({
      where: { recordingId },
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true } } } },
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
        user: { include: { profile: { select: { fullName: true, instituteId: true } } } },
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

  /**
   * Mark class attendance for a single student (by identifier).
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

    return this.prisma.classAttendance.upsert({
      where: {
        userId_classId_date: {
          userId,
          classId: data.classId,
          date: new Date(data.date),
        },
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
        user: { include: { profile: { select: { fullName: true, instituteId: true } } } },
      },
    });
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
    const results = [];

    for (const rec of data.records) {
      const result = await this.prisma.classAttendance.upsert({
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
      });
      results.push(result);
    }

    return results;
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
        user: { include: { profile: { select: { fullName: true, instituteId: true, barcodeId: true, phone: true } } } },
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
        user: { include: { profile: { select: { fullName: true, instituteId: true, barcodeId: true } } } },
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
        user: { include: { profile: { select: { fullName: true, instituteId: true, barcodeId: true } } } },
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
        user: { include: { profile: { select: { fullName: true, instituteId: true, barcodeId: true, phone: true, status: true } } } },
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
    }));
  }

  /**
   * Get class-wise student payment status with submissions.
   */
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
        user: { include: { profile: { select: { fullName: true, instituteId: true, barcodeId: true, phone: true, status: true } } } },
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
