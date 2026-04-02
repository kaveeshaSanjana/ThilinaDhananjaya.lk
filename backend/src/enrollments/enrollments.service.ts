import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  async enroll(userId: string, classId: string) {
    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_classId: { userId, classId } },
    });
    if (existing) throw new ConflictException('Already enrolled');

    return this.prisma.enrollment.create({
      data: { userId, classId },
      include: { class: true },
    });
  }

  async getEnrollmentsForUser(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: { class: true },
    });
  }

  async getEnrollmentsForClass(classId: string) {
    return this.prisma.enrollment.findMany({
      where: { classId },
      include: {
        user: {
          include: { profile: { select: { fullName: true, instituteId: true } } },
        },
      },
    });
  }

  async enrollByPhone(phone: string, classId: string) {
    const profile = await this.prisma.profile.findFirst({
      where: { phone },
    });
    if (!profile) {
      throw new NotFoundException(`Student with phone number "${phone}" not found`);
    }
    return this.enroll(profile.userId, classId);
  }

  async unenroll(userId: string, classId: string) {
    return this.prisma.enrollment.delete({
      where: { userId_classId: { userId, classId } },
    });
  }
}
