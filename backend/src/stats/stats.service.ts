import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [students, classes, pendingPayments, recordings] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.class.count(),
      this.prisma.paymentSlip.count({ where: { status: 'PENDING' } }),
      this.prisma.recording.count(),
    ]);

    return { students, classes, pendingPayments, recordings };
  }
}
