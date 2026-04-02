import { Injectable } from '@nestjs/common';
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
}
