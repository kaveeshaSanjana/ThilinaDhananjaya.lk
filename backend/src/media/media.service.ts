import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMediaDto, UpdateMediaDto } from './dto/media.dto';

@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateMediaDto) {
    return this.prisma.monthMedia.create({ data });
  }

  async findByMonth(
    monthId: string,
    userId?: string,
    userRole?: string,
  ) {
    // Admin sees everything
    if (userRole === 'ADMIN') {
      return this.prisma.monthMedia.findMany({
        where: { monthId },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      });
    }

    // Determine which statuses are accessible
    const accessibleStatuses: string[] = ['ANYONE'];

    if (userId) {
      // Check enrollment for this month's class
      const month = await this.prisma.month.findUnique({
        where: { id: monthId },
        select: { classId: true },
      });

      if (month) {
        const enrollment = await this.prisma.enrollment.findUnique({
          where: { userId_classId: { userId, classId: month.classId } },
        });
        if (enrollment) {
          accessibleStatuses.push('STUDENTS_ONLY');

          // Check paid status for this month
          const payment = await this.prisma.paymentSlip.findFirst({
            where: {
              userId,
              monthId,
              status: { in: ['VERIFIED', 'LATE'] },
            },
          });
          if (payment) {
            accessibleStatuses.push('PAID_ONLY');
          }
        }
      }
    }

    return this.prisma.monthMedia.findMany({
      where: {
        monthId,
        status: { in: accessibleStatuses as any[] },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async update(id: string, data: UpdateMediaDto) {
    const media = await this.prisma.monthMedia.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Media not found');
    return this.prisma.monthMedia.update({ where: { id }, data });
  }

  async delete(id: string) {
    const media = await this.prisma.monthMedia.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Media not found');
    return this.prisma.monthMedia.delete({ where: { id } });
  }
}
