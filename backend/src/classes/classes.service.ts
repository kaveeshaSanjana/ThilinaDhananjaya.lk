import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async createClass(data: {
    name: string; subject?: string; description?: string; monthlyFee?: number;
    thumbnail?: string; vision?: string; mission?: string; introVideoUrl?: string; status?: any; orgId?: string;
  }) {
    return this.prisma.class.create({ data });
  }

  async findAll(orgId?: string) {
    return this.prisma.class.findMany({
      where: orgId ? { orgId } : undefined,
      include: { _count: { select: { months: true, enrollments: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        months: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          include: { _count: { select: { recordings: true } } },
        },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }

  async updateClass(id: string, data: {
    name?: string; subject?: string; description?: string; monthlyFee?: number;
    thumbnail?: string; vision?: string; mission?: string; introVideoUrl?: string; status?: any;
  }) {
    return this.prisma.class.update({ where: { id }, data });
  }

  async deleteClass(id: string) {
    return this.prisma.class.delete({ where: { id } });
  }

  /** Check if a user is enrolled in an ENROLLED_ONLY class */
  async checkClassAccess(classId: string, userId: string): Promise<{ enrolled: boolean }> {
    const cls = await this.prisma.class.findUnique({ where: { id: classId }, select: { status: true } });
    if (!cls) throw new NotFoundException('Class not found');
    if (cls.status !== 'ENROLLED_ONLY') return { enrolled: true };

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_classId: { userId, classId } },
      select: { id: true },
    });
    return { enrolled: !!enrollment };
  }

  /** Get all recordings for a class (aggregated from all months) */
  async getRecordingsForClass(classId: string) {
    return this.prisma.recording.findMany({
      where: { month: { classId } },
      include: { month: { select: { id: true, name: true, year: true, month: true, classId: true, status: true, class: { select: { name: true, status: true } } } } },
      orderBy: [{ month: { year: 'desc' } }, { month: { month: 'desc' } }, { order: 'asc' }],
    });
  }

  // ─── Months ──────────────────────────────────────────

  async createMonth(classId: string, data: { name: string; year: number; month: number; status?: any }) {
    return this.prisma.month.create({
      data: { ...data, classId },
    });
  }

  async findAllMonths() {
    return this.prisma.month.findMany({
      include: { class: { select: { id: true, name: true } }, _count: { select: { recordings: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async findMonthsByClass(classId: string) {
    return this.prisma.month.findMany({
      where: { classId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        _count: { select: { recordings: true } },
        recordings: {
          orderBy: { order: 'asc' },
          select: {
            id: true, title: true, duration: true, thumbnail: true,
            topic: true, icon: true, isLive: true, order: true,
            videoType: true, status: true, createdAt: true,
          },
        },
      },
    });
  }

  async findMonth(id: string) {
    const m = await this.prisma.month.findUnique({
      where: { id },
      include: {
        recordings: { orderBy: { order: 'asc' } },
        class: true,
      },
    });
    if (!m) throw new NotFoundException('Month not found');
    return m;
  }

  async updateMonth(id: string, data: { name?: string; year?: number; month?: number; status?: any }) {
    return this.prisma.month.update({ where: { id }, data });
  }

  async deleteMonth(id: string) {
    return this.prisma.month.delete({ where: { id } });
  }

  /** Assign months to a class from a list of month IDs */
  async assignMonthsToClass(classId: string, monthNames: { name: string; year: number; month: number }[]) {
    return this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const m of monthNames) {
        const existing = await tx.month.findUnique({
          where: { classId_year_month: { classId, year: m.year, month: m.month } },
        });
        if (!existing) {
          results.push(await tx.month.create({ data: { ...m, classId } }));
        } else {
          results.push(existing);
        }
      }
      return results;
    });
  }
}
