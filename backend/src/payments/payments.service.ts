import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentType, PaymentSlipStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  /** Student: submit a payment slip */
  async submitSlip(data: {
    userId: string;
    monthId: string;
    type: PaymentType;
    reason?: string;
    slipUrl: string;
  }) {
    return this.prisma.paymentSlip.create({
      data: {
        userId: data.userId,
        monthId: data.monthId,
        type: data.type,
        reason: data.reason,
        slipUrl: data.slipUrl,
      },
      include: { month: { include: { class: true } } },
    });
  }

  /** Student: my payment history */
  async getMyPayments(userId: string) {
    return this.prisma.paymentSlip.findMany({
      where: { userId },
      include: { month: { include: { class: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin: list all pending slips */
  async getPendingSlips() {
    return this.prisma.paymentSlip.findMany({
      where: { status: 'PENDING' },
      include: {
        user: {
          include: { profile: { select: { fullName: true, instituteId: true } } },
        },
        month: { include: { class: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Admin: list all slips with optional status/month filter */
  async getAllSlips(status?: PaymentSlipStatus, monthId?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (monthId) where.monthId = monthId;
    return this.prisma.paymentSlip.findMany({
      where,
      include: {
        user: {
          include: { profile: { select: { fullName: true, instituteId: true } } },
        },
        month: { include: { class: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin: verify a slip — if MONTHLY, this unlocks the month for the student */
  async verifySlip(slipId: string, adminNote?: string) {
    const slip = await this.prisma.paymentSlip.findUnique({ where: { id: slipId } });
    if (!slip) throw new NotFoundException('Payment slip not found');

    return this.prisma.paymentSlip.update({
      where: { id: slipId },
      data: {
        status: 'VERIFIED',
        adminNote,
      },
      include: { month: { include: { class: true } }, user: true },
    });
    // Note: No extra "unlock" table needed — the Access Resolver checks for
    // VERIFIED MONTHLY payment on-the-fly when filtering recordings.
  }

  /** Admin: reject a slip */
  async rejectSlip(slipId: string, adminNote?: string) {
    return this.prisma.paymentSlip.update({
      where: { id: slipId },
      data: {
        status: 'REJECTED',
        adminNote,
      },
    });
  }

  /** Get payment history for a specific student (Admin view) */
  async getStudentPayments(userId: string) {
    return this.prisma.paymentSlip.findMany({
      where: { userId },
      include: { month: { include: { class: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
