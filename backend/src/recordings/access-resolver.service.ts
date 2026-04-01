import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordingStatus } from '@prisma/client';

/**
 * Access Resolver — determines which recordings a user can see
 * based on cascading visibility across Class → Month → Recording.
 *
 * Visibility levels:
 *   ANYONE        — Guest (no auth needed). Class + Month must also be ANYONE.
 *   STUDENTS_ONLY — Enrolled students (any enrollment).
 *   PAID_ONLY     — Enrolled + paid for that month.
 *   PRIVATE       — Admin only.
 *   INACTIVE      — Hidden from everyone (including admin listings by default).
 */
@Injectable()
export class AccessResolverService {
  constructor(private prisma: PrismaService) {}

  async getVisibleRecordingsForMonth(monthId: string, userId?: string, userRole?: string) {
    // Load month with class
    const month = await this.prisma.month.findUnique({
      where: { id: monthId },
      include: { class: true },
    });
    if (!month) return [];

    // Admin sees everything except INACTIVE
    if (userRole === 'ADMIN') {
      return this.prisma.recording.findMany({
        where: { monthId, status: { not: 'INACTIVE' } },
        orderBy: { order: 'asc' },
      });
    }

    // If class or month is INACTIVE or PRIVATE, non-admin sees nothing
    if (['INACTIVE', 'PRIVATE'].includes(month.class.status) ||
        ['INACTIVE', 'PRIVATE'].includes(month.status)) {
      return [];
    }

    // Determine the user's access level for this month
    const accessLevel = await this.getUserAccessLevel(userId, month.classId, monthId);

    // Build allowed statuses based on access level
    const allowedStatuses = this.getAllowedStatuses(accessLevel);

    // Also filter by class/month visibility cascading
    // If month is PAID_ONLY, only paid users see anything  
    // If month is STUDENTS_ONLY, only enrolled users see anything
    const monthAccess = this.getStatusRank(month.status);
    const classAccess = this.getStatusRank(month.class.status);
    const parentMinAccess = Math.max(monthAccess, classAccess);

    if (accessLevel < parentMinAccess) {
      return [];
    }

    return this.prisma.recording.findMany({
      where: {
        monthId,
        status: { in: allowedStatuses },
      },
      orderBy: { order: 'asc' },
    });
  }

  /** Check if a specific user can access a specific recording */
  async canAccessRecording(recordingId: string, userId?: string, userRole?: string): Promise<boolean> {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      include: { month: { include: { class: true } } },
    });

    if (!recording) return false;

    // INACTIVE — hidden from everyone
    if (recording.status === 'INACTIVE') return false;

    // Admin can access anything not INACTIVE
    if (userRole === 'ADMIN') return true;

    // Check parent visibility — if class or month is INACTIVE/PRIVATE, block
    if (['INACTIVE', 'PRIVATE'].includes(recording.month.class.status) ||
        ['INACTIVE', 'PRIVATE'].includes(recording.month.status)) {
      return false;
    }

    // PRIVATE recording — admin only (handled above)
    if (recording.status === 'PRIVATE') return false;

    // Determine user's access level
    const accessLevel = await this.getUserAccessLevel(userId, recording.month.classId, recording.monthId);

    // Check cascading: user must meet the highest requirement across class, month, recording
    const requiredLevel = Math.max(
      this.getStatusRank(recording.month.class.status),
      this.getStatusRank(recording.month.status),
      this.getStatusRank(recording.status),
    );

    return accessLevel >= requiredLevel;
  }

  /**
   * Get user's access level:
   *   0 = guest (ANYONE)
   *   1 = enrolled student (STUDENTS_ONLY)
   *   2 = paid student (PAID_ONLY)
   */
  private async getUserAccessLevel(userId: string | undefined, classId: string, monthId: string): Promise<number> {
    if (!userId) return 0; // guest

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_classId: { userId, classId } },
    });

    if (!enrollment) return 0; // not enrolled = guest level

    // Check if paid for this month
    const payment = await this.prisma.paymentSlip.findFirst({
      where: {
        userId,
        monthId,
        type: 'MONTHLY',
        status: 'VERIFIED',
      },
    });

    return payment ? 2 : 1; // paid=2, enrolled-only=1
  }

  /**
   * Convert status to numeric rank for comparison:
   *   ANYONE=0, STUDENTS_ONLY=1, PAID_ONLY=2, PRIVATE=3, INACTIVE=4
   */
  private getStatusRank(status: string): number {
    const ranks: Record<string, number> = {
      ANYONE: 0,
      STUDENTS_ONLY: 1,
      PAID_ONLY: 2,
      PRIVATE: 3,
      INACTIVE: 4,
    };
    return ranks[status] ?? 4;
  }

  /** Get allowed recording statuses for a given access level */
  private getAllowedStatuses(accessLevel: number): RecordingStatus[] {
    const statuses: RecordingStatus[] = ['ANYONE'];
    if (accessLevel >= 1) statuses.push('STUDENTS_ONLY');
    if (accessLevel >= 2) statuses.push('PAID_ONLY');
    return statuses;
  }
}
