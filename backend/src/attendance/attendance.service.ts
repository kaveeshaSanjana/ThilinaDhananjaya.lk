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

  /** Get the required push duration from env */
  getPushDuration(): number {
    return parseInt(this.config.get('ATTENDANCE_PUSH_DURATION_SECONDS', '60'), 10);
  }

  /** Get the heartbeat interval from env (default 120 seconds / 2 minutes) */
  getHeartbeatInterval(): number {
    return parseInt(this.config.get('HEARTBEAT_INTERVAL_SECONDS', '120'), 10);
  }

  /**
   * The "Push" event — called once from frontend when student reaches the threshold.
   * Records a COMPLETED attendance entry.
   */
  async markCompleted(userId: string, recordingId: string, watchedSec: number) {
    // Prevent duplicate completions for same recording
    const existing = await this.prisma.attendance.findFirst({
      where: { userId, recordingId, status: 'COMPLETED' },
    });
    if (existing) return existing;

    return this.prisma.attendance.create({
      data: {
        userId,
        recordingId,
        status: 'COMPLETED',
        watchedSec,
      },
    });
  }

  /**
   * Log an INCOMPLETE attempt (user navigated away before push).
   * Called from frontend via beacon/unload.
   */
  async markIncomplete(userId: string, recordingId: string, watchedSec: number) {
    return this.prisma.attendance.create({
      data: {
        userId,
        recordingId,
        status: 'INCOMPLETE',
        watchedSec,
      },
    });
  }

  /**
   * Admin: manually mark attendance for a student.
   * Can be for a recording or a custom event name.
   */
  async manualMark(data: {
    userId: string;
    recordingId?: string;
    eventName?: string;
  }) {
    return this.prisma.attendance.create({
      data: {
        userId: data.userId,
        recordingId: data.recordingId || null,
        eventName: data.eventName || null,
        status: 'MANUAL',
      },
    });
  }

  /** Admin: get all attendance records */
  async getAll() {
    return this.prisma.attendance.findMany({
      include: {
        user: { include: { profile: { select: { fullName: true, instituteId: true } } } },
        recording: { select: { title: true, month: { select: { name: true, class: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Get attendance records for a specific user */
  async getByUser(userId: string) {
    return this.prisma.attendance.findMany({
      where: { userId },
      include: {
        recording: { select: { title: true, month: { select: { name: true, class: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get attendance records for a specific recording */
  async getByRecording(recordingId: string) {
    return this.prisma.attendance.findMany({
      where: { recordingId },
      include: {
        user: {
          include: { profile: { select: { fullName: true, instituteId: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Watch Session Methods ──────────────────────────────

  /** Start a new watch session */
  async startSession(userId: string, recordingId: string, videoPosition: number, events?: any[]) {
    // End any currently-active sessions for this user+recording
    await this.prisma.watchSession.updateMany({
      where: { userId, recordingId, status: 'WATCHING' },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    return this.prisma.watchSession.create({
      data: {
        userId,
        recordingId,
        videoStartPos: videoPosition,
        videoEndPos: videoPosition,
        totalWatchedSec: 0,
        status: 'WATCHING',
        events: events || [],
      },
    });
  }

  /** Heartbeat: update session with current video position and watched time */
  async heartbeat(userId: string, sessionId: string, videoPosition: number, watchedSec: number, events?: any[]) {
    const session = await this.prisma.watchSession.findFirst({
      where: { id: sessionId, userId, status: 'WATCHING' },
    });
    if (!session) return null;

    // Merge events
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

  /** End a watch session */
  async endSession(userId: string, sessionId: string, videoPosition: number, watchedSec: number, events?: any[]) {
    const session = await this.prisma.watchSession.findFirst({
      where: { id: sessionId, userId },
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
        status: 'ENDED',
        events: mergedEvents,
      },
    });
  }

  /** End a watch session by session ID only (for sendBeacon — no auth available) */
  async endSessionBySessionId(sessionId: string, videoPosition: number, watchedSec: number, events?: any[]) {
    const session = await this.prisma.watchSession.findFirst({
      where: { id: sessionId, status: 'WATCHING' },
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
        status: 'ENDED',
        events: mergedEvents,
      },
    });
  }

  /** Get watch history for a user (all sessions across all recordings) */
  async getWatchHistory(userId: string) {
    return this.prisma.watchSession.findMany({
      where: { userId },
      include: {
        recording: {
          select: {
            title: true,
            thumbnail: true,
            duration: true,
            month: { select: { name: true, class: { select: { name: true } } } },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
  }

  /** Admin: get all watch sessions */
  async getAllWatchSessions() {
    return this.prisma.watchSession.findMany({
      include: {
        user: {
          include: { profile: { select: { fullName: true, instituteId: true } } },
        },
        recording: {
          select: {
            title: true,
            month: { select: { name: true, class: { select: { name: true } } } },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
  }

  /** Get watch history for a specific recording (admin) */
  async getRecordingWatchHistory(recordingId: string) {
    return this.prisma.watchSession.findMany({
      where: { recordingId },
      include: {
        user: {
          include: { profile: { select: { fullName: true, instituteId: true } } },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
  }

  /** Get watch sessions for a user on a specific recording */
  async getSessionsByRecording(userId: string, recordingId: string) {
    return this.prisma.watchSession.findMany({
      where: { userId, recordingId },
      orderBy: { startedAt: 'desc' },
    });
  }
}
