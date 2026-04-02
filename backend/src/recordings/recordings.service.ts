import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class RecordingsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    monthId: string;
    title: string;
    description?: string;
    videoUrl?: string;
    videoType?: any;
    thumbnail?: string;
    topic?: string;
    icon?: string;
    materials?: string;
    duration?: number;
    status?: any;
    order?: number;
    welcomeMessage?: string;
    isLive?: boolean;
    liveUrl?: string;
  }) {
    // Auto-generate a unique live token if creating a live lecture
    let liveToken: string | undefined;
    if (data.isLive) {
      liveToken = randomBytes(24).toString('hex');
    }
    return this.prisma.recording.create({
      data: {
        ...data,
        liveToken,
        liveStartedAt: data.isLive ? new Date() : undefined,
      },
    });
  }

  async findAll() {
    return this.prisma.recording.findMany({
      include: { month: { include: { class: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rec = await this.prisma.recording.findUnique({
      where: { id },
      include: { month: { include: { class: true } } },
    });
    if (!rec) throw new NotFoundException('Recording not found');
    return rec;
  }

  async update(id: string, data: {
    title?: string;
    description?: string;
    videoUrl?: string;
    videoType?: any;
    thumbnail?: string;
    topic?: string;
    icon?: string;
    materials?: string;
    duration?: number;
    status?: any;
    order?: number;
    welcomeMessage?: string;
    isLive?: boolean;
    liveUrl?: string;
  }) {
    return this.prisma.recording.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.recording.delete({ where: { id } });
  }

  /** Admin: get watch history for a specific recording */
  async getWatchHistory(recordingId: string) {
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

  // ─── Live Lecture Methods ──────────────────────────────

  /** Find a recording by its unique live token */
  async findByLiveToken(token: string) {
    const rec = await this.prisma.recording.findUnique({
      where: { liveToken: token },
      include: { month: { include: { class: true } } },
    });
    if (!rec) throw new NotFoundException('Live lecture not found');
    return rec;
  }

  /** Admin: start a live session (set isLive + generate token if needed) */
  async goLive(id: string) {
    const rec = await this.prisma.recording.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Recording not found');

    const liveToken = rec.liveToken || randomBytes(24).toString('hex');
    return this.prisma.recording.update({
      where: { id },
      data: {
        isLive: true,
        liveToken,
        liveStartedAt: new Date(),
        liveEndedAt: null,
      },
    });
  }

  /** Admin: end a live session (keep the token for reference, clear isLive) */
  async endLive(id: string) {
    return this.prisma.recording.update({
      where: { id },
      data: {
        isLive: false,
        liveEndedAt: new Date(),
      },
    });
  }

  /** Get live attendance for a recording */
  async getLiveAttendance(recordingId: string) {
    return this.prisma.attendance.findMany({
      where: { recordingId, eventName: 'LIVE_JOIN' },
      include: {
        user: {
          include: { profile: { select: { fullName: true, instituteId: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Mark live attendance — upserts the single attendance record per user+recording */
  async markLiveAttendance(userId: string, recordingId: string) {
    const existing = await this.prisma.attendance.findUnique({
      where: { userId_recordingId: { userId, recordingId } },
    });

    const event = { type: 'LIVE_JOIN', at: new Date().toISOString() };
    const details = Array.isArray(existing?.details) ? [...(existing.details as any[]), event] : [event];

    if (existing) {
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: 'COMPLETED',
          liveJoinedAt: existing.liveJoinedAt ?? new Date(),
          eventName: 'LIVE_JOIN',
          details,
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
        details: [event],
      },
    });
  }
}
