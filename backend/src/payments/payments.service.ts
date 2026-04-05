import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
    // Resolve the class monthlyFee to auto-fill amount
    const month = await this.prisma.month.findUnique({
      where: { id: data.monthId },
      include: { class: { select: { monthlyFee: true } } },
    });
    if (!month) throw new NotFoundException('Month not found');

    const amount = month.class.monthlyFee ?? null;

    return this.prisma.paymentSlip.create({
      data: {
        userId: data.userId,
        monthId: data.monthId,
        type: data.type,
        reason: data.reason,
        slipUrl: data.slipUrl,
        amount,
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
      select: {
        id: true, type: true, slipUrl: true, amount: true, status: true,
        adminNote: true, rejectReason: true, transactionId: true, createdAt: true, paidDate: true,
        user: {
          select: {
            id: true, email: true,
            profile: { select: { fullName: true, instituteId: true } },
          },
        },
        month: {
          select: {
            id: true, name: true, year: true, month: true,
            class: { select: { id: true, name: true, subject: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Admin: list all slips with optional status/month filter */
  async getAllSlips(status?: PaymentSlipStatus, monthId?: string, page?: number, limit?: number) {
    const where: any = {};
    if (status) where.status = status;
    if (monthId) where.monthId = monthId;

    const take = limit && limit > 0 ? Math.min(limit, 200) : 50;
    const skip = page && page > 1 ? (page - 1) * take : 0;

    const [data, total] = await Promise.all([
      this.prisma.paymentSlip.findMany({
        where,
        include: {
          user: {
            include: { profile: { select: { fullName: true, instituteId: true } } },
          },
          month: { include: { class: { select: { id: true, name: true, subject: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.paymentSlip.count({ where }),
    ]);

    return { data, total, page: page || 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  /** Admin: verify a slip — if MONTHLY, this unlocks the month for the student */
  async verifySlip(slipId: string, transactionId: string, adminNote?: string, paidDate?: string) {
    const slip = await this.prisma.paymentSlip.findUnique({
      where: { id: slipId },
      include: {
        month: { include: { class: { select: { monthlyFee: true } } } },
        user: { include: { profile: { select: { fullName: true, instituteId: true } } } },
      },
    });
    if (!slip) throw new NotFoundException('Payment slip not found');

    // Check for duplicate transactionId
    const existing = await this.prisma.paymentSlip.findFirst({
      where: { transactionId, NOT: { id: slipId } },
      include: { user: { include: { profile: { select: { fullName: true, instituteId: true } } } } },
    });
    if (existing) {
      const name = existing.user?.profile?.fullName || existing.user?.email || 'Unknown';
      const iid = existing.user?.profile?.instituteId || '';
      throw new ConflictException(
        `This transaction ID has already been used for ${name}${iid ? ` (${iid})` : ''}`,
      );
    }

    // Use existing amount if already set, otherwise pull from class.monthlyFee
    const amount = slip.amount ?? slip.month.class.monthlyFee ?? null;
    const resolvedPaidDate = paidDate ? new Date(paidDate) : new Date();

    return this.prisma.paymentSlip.update({
      where: { id: slipId },
      data: { status: 'VERIFIED', transactionId, adminNote, amount, paidDate: resolvedPaidDate },
      include: { month: { include: { class: true } }, user: { include: { profile: true } } },
    });
  }

  /** Admin: reject a slip */
  async rejectSlip(slipId: string, rejectReason: string, adminNote?: string) {
    return this.prisma.paymentSlip.update({
      where: { id: slipId },
      data: { status: 'REJECTED', rejectReason, adminNote },
      include: { month: { include: { class: true } } },
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

  /**
   * Admin: Get all enrolled students for a class+month with their payment status.
   * Returns one row per student showing: PAID | LATE | PENDING | UNPAID
   */
  async getClassMonthPaymentStatus(classId: string, monthId: string) {
    // Verify the month belongs to the class
    const month = await this.prisma.month.findFirst({
      where: { id: monthId, classId },
      include: { class: { select: { id: true, name: true, subject: true } } },
    });
    if (!month) throw new NotFoundException('Month not found for this class');
    return this.buildPaymentStatusResult(month);
  }

  /**
   * Admin: Same as above but only requires monthId — classId is resolved automatically.
   */
  async getMonthPaymentStatus(monthId: string) {
    const month = await this.prisma.month.findUnique({
      where: { id: monthId },
      include: { class: { select: { id: true, name: true, subject: true } } },
    });
    if (!month) throw new NotFoundException('Month not found');
    return this.buildPaymentStatusResult(month);
  }

  private async buildPaymentStatusResult(month: {
    id: string; name: string; year: number; month: number; classId: string;
    class: { id: string; name: string; subject: string | null };
  }) {
    const { classId } = month;

    // All students enrolled in this class
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId },
      select: {
        userId: true,
        user: {
          select: {
            id: true, email: true,
            profile: { select: { fullName: true, instituteId: true, avatarUrl: true, phone: true } },
          },
        },
      },
    });

    // All payment slips for this month — only needed fields
    const slips = await this.prisma.paymentSlip.findMany({
      where: { monthId: month.id },
      select: {
        id: true, userId: true, status: true, type: true, slipUrl: true,
        amount: true, paidDate: true, adminNote: true, rejectReason: true,
        transactionId: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map slips by userId — keep the most recent one per student
    const slipMap = new Map<string, typeof slips[0]>();
    for (const slip of slips) {
      if (!slipMap.has(slip.userId)) {
        slipMap.set(slip.userId, slip);
      }
    }

    const students = enrollments.map((e) => {
      const slip = slipMap.get(e.userId) ?? null;
      let paymentStatus: 'PAID' | 'LATE' | 'PENDING' | 'UNPAID';

      if (!slip) {
        paymentStatus = 'UNPAID';
      } else if (slip.status === 'VERIFIED') {
        paymentStatus = 'PAID';
      } else if (slip.status === 'LATE') {
        paymentStatus = 'LATE';
      } else if (slip.status === 'PENDING') {
        paymentStatus = 'PENDING';
      } else {
        // REJECTED — treat as unpaid
        paymentStatus = 'UNPAID';
      }

      return {
        userId: e.userId,
        profile: e.user.profile,
        email: e.user.email,
        paymentStatus,
        slip: slip
          ? {
              id: slip.id,
              status: slip.status,
              type: slip.type,
              slipUrl: slip.slipUrl,
              amount: slip.amount,
              paidDate: slip.paidDate,
              adminNote: slip.adminNote,
              createdAt: slip.createdAt,
            }
          : null,
      };
    });

    return {
      class: month.class,
      month: { id: month.id, name: month.name, year: month.year, month: month.month },
      monthlyFee: (month.class as any).monthlyFee ?? null,
      students,
      summary: {
        total: students.length,
        paid: students.filter((s) => s.paymentStatus === 'PAID').length,
        late: students.filter((s) => s.paymentStatus === 'LATE').length,
        pending: students.filter((s) => s.paymentStatus === 'PENDING').length,
        unpaid: students.filter((s) => s.paymentStatus === 'UNPAID').length,
      },
    };
  }

  /**
   * Admin: Manually set a student's payment status for a month.
   * PAID   → marks/creates slip as VERIFIED
   * LATE   → marks/creates slip as LATE
   * UNPAID → rejects all existing slips for this student+month
   */
  async setStudentPaymentStatus(
    userId: string,
    monthId: string,
    status: 'PAID' | 'LATE' | 'UNPAID',
    adminNote?: string,
    paidDate?: string,
  ) {
    // Verify user and month exist
    const [user, month] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
      this.prisma.month.findUnique({ where: { id: monthId }, include: { class: true } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!month) throw new NotFoundException('Month not found');

    if (status === 'UNPAID') {
      // Reject all existing slips for this student+month
      await this.prisma.paymentSlip.updateMany({
        where: { userId, monthId },
        data: { status: 'REJECTED', adminNote: adminNote ?? 'Marked unpaid by admin' },
      });
      return {
        userId,
        monthId,
        paymentStatus: 'UNPAID',
        message: 'Student marked as unpaid. All existing slips rejected.',
      };
    }

    const slipStatus = status === 'PAID' ? 'VERIFIED' : 'LATE';
    const amount = (month as any).class?.monthlyFee ?? null;
    const resolvedPaidDate = paidDate ? new Date(paidDate) : new Date();

    // Find the most recent slip for this student+month
    const existingSlip = await this.prisma.paymentSlip.findFirst({
      where: { userId, monthId },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSlip) {
      const updated = await this.prisma.paymentSlip.update({
        where: { id: existingSlip.id },
        data: { status: slipStatus, adminNote, amount: existingSlip.amount ?? amount, paidDate: resolvedPaidDate },
        include: { month: { include: { class: true } } },
      });
      return { paymentStatus: status, slip: updated };
    }

    // No existing slip — create a manual record
    const created = await this.prisma.paymentSlip.create({
      data: {
        userId,
        monthId,
        type: 'MONTHLY',
        slipUrl: 'MANUAL_ENTRY',
        amount,
        paidDate: resolvedPaidDate,
        status: slipStatus,
        adminNote: adminNote ?? `Manually marked as ${status} by admin`,
      },
      include: { month: { include: { class: true } } },
    });
    return { paymentStatus: status, slip: created };
  }
}
