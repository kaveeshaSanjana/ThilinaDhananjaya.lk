import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

type LectureStatus = 'ANYONE' | 'STUDENTS_ONLY' | 'PAID_ONLY' | 'PRIVATE' | 'INACTIVE';
type LectureMode = 'ONLINE' | 'OFFLINE';

@Injectable()
export class LecturesService {
  constructor(private prisma: PrismaService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db() { return this.prisma as any; }

  /** Admin: create a lecture for a class month */
  async create(monthId: string, data: {
    title: string;
    description?: string;
    mode?: LectureMode;
    platform?: string;
    startTime: string;
    endTime: string;
    sessionLink?: string;
    meetingId?: string;
    meetingPassword?: string;
    maxParticipants?: number;
    welcomeMessage?: string;
    status?: LectureStatus;
  }) {
    const month = await this.prisma.month.findUnique({
      where: { id: monthId },
      select: { id: true },
    });
    if (!month) throw new NotFoundException('Month not found');

    return this.db.lecture.create({
      data: {
        monthId,
        title: data.title,
        description: data.description,
        mode: data.mode ?? 'ONLINE',
        platform: data.platform,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        sessionLink: data.sessionLink,
        meetingId: data.meetingId,
        meetingPassword: data.meetingPassword,
        maxParticipants: data.maxParticipants,
        welcomeMessage: data.welcomeMessage,
        status: data.status ?? 'STUDENTS_ONLY',
      },
      include: {
        month: {
          select: {
            id: true, name: true, year: true, month: true,
            class: { select: { id: true, name: true, subject: true } },
          },
        },
      },
    });
  }

  /** All users: get lectures for a month (visibility-filtered by status) */
  async getByMonth(monthId: string, userRole?: string) {
    const month = await this.prisma.month.findUnique({
      where: { id: monthId },
      select: {
        id: true, name: true, year: true, month: true,
        class: { select: { id: true, name: true, subject: true } },
      },
    });
    if (!month) throw new NotFoundException('Month not found');

    const statusFilter = userRole === 'ADMIN'
      ? { not: 'INACTIVE' as LectureStatus }
      : { in: ['ANYONE', 'STUDENTS_ONLY', 'PAID_ONLY'] as LectureStatus[] };

    const lectures = await this.db.lecture.findMany({
      where: { monthId, status: statusFilter },
      orderBy: { startTime: 'asc' },
    });

    return { month, lectures };
  }

  /** Get a single lecture by ID */
  async findOne(id: string) {
    const lecture = await this.db.lecture.findUnique({
      where: { id },
      include: {
        month: {
          select: {
            id: true, name: true, year: true, month: true,
            class: { select: { id: true, name: true, subject: true } },
          },
        },
      },
    });
    if (!lecture) throw new NotFoundException('Lecture not found');
    return lecture;
  }

  /** Admin: update a lecture */
  async update(id: string, data: {
    title?: string;
    description?: string;
    mode?: LectureMode;
    platform?: string;
    startTime?: string;
    endTime?: string;
    sessionLink?: string;
    meetingId?: string;
    meetingPassword?: string;
    maxParticipants?: number;
    welcomeMessage?: string;
    status?: LectureStatus;
  }) {
    await this.findOne(id);
    return this.db.lecture.update({
      where: { id },
      data: {
        ...data,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
      },
      include: {
        month: {
          select: {
            id: true, name: true, year: true, month: true,
            class: { select: { id: true, name: true, subject: true } },
          },
        },
      },
    });
  }

  /** Admin: delete a lecture */
  async delete(id: string) {
    await this.findOne(id);
    return this.db.lecture.delete({ where: { id } });
  }

  /** Admin: get all lectures across all months (with optional filters) */
  async getAll(monthId?: string, status?: LectureStatus, page?: number, limit?: number) {
    const where: any = {};
    if (monthId) where.monthId = monthId;
    if (status) where.status = status;

    const take = limit && limit > 0 ? Math.min(limit, 200) : 50;
    const skip = page && page > 1 ? (page - 1) * take : 0;

    const [data, total] = await Promise.all([
      this.db.lecture.findMany({
        where,
        include: {
          month: {
            select: {
              id: true, name: true, year: true, month: true,
              class: { select: { id: true, name: true, subject: true } },
            },
          },
        },
        orderBy: { startTime: 'asc' },
        take,
        skip,
      }),
      this.db.lecture.count({ where }),
    ]);

    return { data, total, page: page || 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  /** Admin: generate (or regenerate) a shareable live token for a lecture */
  async generateLiveToken(lectureId: string) {
    await this.findOne(lectureId);
    const token = randomBytes(12).toString('hex'); // 24 hex chars
    return this.db.lecture.update({
      where: { id: lectureId },
      data: { liveToken: token },
      select: { id: true, title: true, liveToken: true },
    });
  }

  /** Public: resolve live token → lecture info (hides sessionLink) */
  async findByLiveToken(token: string) {
    const lecture = await this.db.lecture.findUnique({
      where: { liveToken: token },
      include: {
        month: {
          select: {
            id: true, name: true, year: true, month: true,
            class: { select: { id: true, name: true, subject: true } },
          },
        },
      },
    });
    if (!lecture) throw new NotFoundException('Invalid or expired live link.');

    // Strip sessionLink / meetingPassword from public response
    const { sessionLink: _s, meetingPassword: _p, ...safe } = lecture;
    return safe;
  }

  /** Authenticated: mark attendance and return sessionLink */
  async joinByLiveToken(token: string, userId: string) {
    const lecture = await this.db.lecture.findUnique({
      where: { liveToken: token },
      include: {
        month: {
          select: {
            id: true, name: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!lecture) throw new NotFoundException('Invalid or expired live link.');

    const classId = lecture.month?.class?.id;
    if (classId) {
      // Upsert ClassAttendance for today (date-only, UTC midnight)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      await this.db.classAttendance.upsert({
        where: { userId_classId_date: { userId, classId, date: today } },
        create: { userId, classId, date: today, status: 'PRESENT', method: 'live_lecture_link' },
        update: { status: 'PRESENT', method: 'live_lecture_link' },
      });
    }

    // Upsert LectureAttendance for per-lecture tracking
    await this.db.lectureAttendance.upsert({
      where: { lectureId_userId: { lectureId: lecture.id, userId } },
      create: { lectureId: lecture.id, userId },
      update: { joinedAt: new Date() },
    });

    return {
      lectureId: lecture.id,
      title: lecture.title,
      sessionLink: lecture.sessionLink,
      meetingId: lecture.meetingId,
      meetingPassword: lecture.meetingPassword,
      startTime: lecture.startTime,
      endTime: lecture.endTime,
      platform: lecture.platform,
    };
  }

  /** Public: guest join for ANYONE lectures (no auth required) */
  async joinByLiveTokenGuest(token: string, data: {
    fullName: string;
    phone: string;
    email?: string;
    note?: string;
  }) {
    const lecture = await this.db.lecture.findUnique({
      where: { liveToken: token },
    });
    if (!lecture) throw new NotFoundException('Invalid or expired live link.');
    if (lecture.status !== 'ANYONE') {
      throw new ForbiddenException('This lecture requires an account to join.');
    }

    await this.db.guestLectureJoin.create({
      data: {
        lectureId: lecture.id,
        fullName: data.fullName,
        phone: data.phone,
        email: data.email ?? null,
        note: data.note ?? null,
      },
    });

    return {
      lectureId: lecture.id,
      title: lecture.title,
      sessionLink: lecture.sessionLink,
      meetingId: lecture.meetingId,
      meetingPassword: lecture.meetingPassword,
      startTime: lecture.startTime,
      endTime: lecture.endTime,
      platform: lecture.platform,
    };
  }

  /** Admin: get join statistics for a lecture */
  async getLectureStats(lectureId: string) {
    const lecture = await this.findOne(lectureId);

    const [registeredJoins, guestJoins] = await Promise.all([
      this.db.lectureAttendance.findMany({
        where: { lectureId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { fullName: true, phone: true, instituteId: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      this.db.guestLectureJoin.findMany({
        where: { lectureId },
        orderBy: { joinedAt: 'asc' },
      }),
    ]);

    return {
      lecture: {
        id: lecture.id,
        title: lecture.title,
        startTime: lecture.startTime,
        endTime: lecture.endTime,
        status: lecture.status,
      },
      registeredCount: registeredJoins.length,
      guestCount: guestJoins.length,
      totalCount: registeredJoins.length + guestJoins.length,
      registeredJoins,
      guestJoins,
    };
  }
}
