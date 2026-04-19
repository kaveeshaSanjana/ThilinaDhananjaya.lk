import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentPaymentType } from '@prisma/client';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  private normalizePaymentType(paymentType?: string): EnrollmentPaymentType {
    const normalized = (paymentType || 'FULL').trim().toUpperCase();
    if (normalized === 'FULL' || normalized === 'HALF' || normalized === 'FREE') {
      return normalized;
    }
    throw new BadRequestException('paymentType must be FULL, HALF, or FREE');
  }

  private normalizeCustomMonthlyFee(customMonthlyFee?: number): number | null {
    if (customMonthlyFee == null) return null;
    if (!Number.isFinite(customMonthlyFee) || customMonthlyFee < 0) {
      throw new BadRequestException('customMonthlyFee must be a non-negative number');
    }
    return Math.round(customMonthlyFee * 100) / 100;
  }

  private resolveEffectiveMonthlyFee(
    defaultMonthlyFee: number | null | undefined,
    paymentType: EnrollmentPaymentType,
    customMonthlyFee: number | null,
  ): number | null {
    if (typeof customMonthlyFee === 'number') return customMonthlyFee;

    const classFee = typeof defaultMonthlyFee === 'number' ? defaultMonthlyFee : null;

    if (paymentType === 'FREE') return 0;
    if (paymentType === 'HALF') {
      if (classFee == null) return null;
      return Math.round((classFee / 2) * 100) / 100;
    }
    return classFee;
  }

  private withPricing<T extends {
    paymentType: EnrollmentPaymentType;
    customMonthlyFee: number | null;
    class?: { monthlyFee?: number | null };
  }>(enrollment: T) {
    const defaultMonthlyFee = enrollment.class?.monthlyFee ?? null;
    return {
      ...enrollment,
      defaultMonthlyFee,
      effectiveMonthlyFee: this.resolveEffectiveMonthlyFee(
        defaultMonthlyFee,
        enrollment.paymentType,
        enrollment.customMonthlyFee,
      ),
      hasCustomMonthlyFee: typeof enrollment.customMonthlyFee === 'number',
    };
  }

  async enroll(userId: string, classId: string, paymentType?: string, customMonthlyFee?: number) {
    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_classId: { userId, classId } },
    });
    if (existing) throw new ConflictException('Already enrolled');

    const normalizedPaymentType = this.normalizePaymentType(paymentType);
    const normalizedCustomMonthlyFee = this.normalizeCustomMonthlyFee(customMonthlyFee);

    const enrollment = await this.prisma.enrollment.create({
      data: {
        userId,
        classId,
        paymentType: normalizedPaymentType,
        customMonthlyFee: normalizedCustomMonthlyFee,
      },
      include: {
        class: { select: { id: true, name: true, subject: true, monthlyFee: true } },
      },
    });

    return this.withPricing(enrollment);
  }

  async getEnrollmentsForUser(userId: string) {
    const rows = await this.prisma.enrollment.findMany({
      where: { userId },
      include: { class: true },
    });

    return rows.map((row) => this.withPricing(row));
  }

  async getEnrollmentsForClass(
    classId: string,
    filters?: { paymentType?: string; customOnly?: string; search?: string },
  ) {
    const where: any = { classId };

    if (filters?.paymentType && filters.paymentType.trim()) {
      where.paymentType = this.normalizePaymentType(filters.paymentType);
    }

    if (filters?.customOnly === 'true') {
      where.customMonthlyFee = { not: null };
    } else if (filters?.customOnly === 'false') {
      where.customMonthlyFee = null;
    }

    const search = (filters?.search || '').trim();
    if (search) {
      where.OR = [
        { user: { email: { contains: search } } },
        { user: { profile: { fullName: { contains: search } } } },
        { user: { profile: { instituteId: { contains: search } } } },
        { user: { profile: { phone: { contains: search } } } },
      ];
    }

    const rows = await this.prisma.enrollment.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, subject: true, monthlyFee: true } },
        user: {
          include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true } } },
        },
      },
      orderBy: [{ paymentType: 'asc' }, { user: { profile: { fullName: 'asc' } } }],
    });

    return rows.map((row) => this.withPricing(row));
  }

  async enrollByPhone(phone: string, classId: string, paymentType?: string, customMonthlyFee?: number) {
    const profile = await this.prisma.profile.findFirst({
      where: { phone },
    });
    if (!profile) {
      throw new NotFoundException(`Student with phone number "${phone}" not found`);
    }
    return this.enroll(profile.userId, classId, paymentType, customMonthlyFee);
  }

  async updateEnrollmentPricing(
    userId: string,
    classId: string,
    data: { paymentType?: string; customMonthlyFee?: number; clearCustomFee?: boolean },
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_classId: { userId, classId } },
      include: {
        class: { select: { id: true, name: true, subject: true, monthlyFee: true } },
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true } } } },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found for this student and class');
    }

    const nextPaymentType = data.paymentType
      ? this.normalizePaymentType(data.paymentType)
      : enrollment.paymentType;

    let nextCustomMonthlyFee = enrollment.customMonthlyFee;
    if (data.clearCustomFee) {
      nextCustomMonthlyFee = null;
    }
    if (typeof data.customMonthlyFee === 'number') {
      nextCustomMonthlyFee = this.normalizeCustomMonthlyFee(data.customMonthlyFee);
    }

    const updated = await this.prisma.enrollment.update({
      where: { userId_classId: { userId, classId } },
      data: {
        paymentType: nextPaymentType,
        customMonthlyFee: nextCustomMonthlyFee,
      },
      include: {
        class: { select: { id: true, name: true, subject: true, monthlyFee: true } },
        user: { include: { profile: { select: { fullName: true, instituteId: true, avatarUrl: true } } } },
      },
    });

    return this.withPricing(updated);
  }

  async unenroll(userId: string, classId: string) {
    return this.prisma.enrollment.delete({
      where: { userId_classId: { userId, classId } },
    });
  }
}
