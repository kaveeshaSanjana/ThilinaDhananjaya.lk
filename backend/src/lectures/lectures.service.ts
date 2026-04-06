import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
