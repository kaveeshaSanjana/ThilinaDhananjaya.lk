import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

interface CreateUserData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  whatsappPhone?: string;
  address?: string;
  school?: string;
  dateOfBirth?: string;
  guardianName?: string;
  guardianPhone?: string;
  relationship?: string;
  occupation?: string;
  avatarUrl?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  orgId?: string; // assigned institute
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async create(data: CreateUserData) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const instituteId = await this.generateInstituteId();

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        role: 'STUDENT',
        orgId: data.orgId || null,
        profile: {
          create: {
            instituteId,
            fullName: data.fullName,
            avatarUrl: data.avatarUrl,
            phone: data.phone,
            whatsappPhone: data.whatsappPhone,
            address: data.address,
            school: data.school,
            occupation: data.occupation,
            gender: data.gender as any,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            guardianName: data.guardianName,
            guardianPhone: data.guardianPhone,
            relationship: data.relationship,
          },
        },
      },
      include: { profile: true },
    });

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  async findByLoginIdentifier(identifier: string) {
    const trimmed = identifier.trim();
    if (!trimmed) {
      return null;
    }

    const normalizedEmail = trimmed.toLowerCase();

    const byEmail = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { email: trimmed }],
      },
      include: { profile: true },
    });
    if (byEmail) {
      return byEmail;
    }

    const byInstituteId = await this.prisma.user.findFirst({
      where: { profile: { instituteId: trimmed } },
      include: { profile: true },
    });
    if (byInstituteId) {
      return byInstituteId;
    }

    const byBarcodeId = await this.prisma.user.findFirst({
      where: { profile: { barcodeId: trimmed } },
      include: { profile: true },
    });
    if (byBarcodeId) {
      return byBarcodeId;
    }

    return this.prisma.user.findFirst({
      where: {
        OR: [
          { profile: { phone: trimmed } },
          { profile: { whatsappPhone: trimmed } },
        ],
      },
      include: { profile: true },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, enrollments: { include: { class: true } } },
    });
  }

  async findAllStudents(search?: string, page?: number, limit?: number, orgId?: string) {
    const where: any = { role: 'STUDENT' };
    if (orgId) where.orgId = orgId;

    if (search) {
      where.OR = [
        { profile: { instituteId: { contains: search } } },
        { profile: { fullName: { contains: search } } },
        { profile: { school: { contains: search } } },
        { email: { contains: search } },
      ];
    }

    const take = limit && limit > 0 ? Math.min(limit, 200) : 50;
    const skip = page && page > 1 ? (page - 1) * take : 0;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page: page || 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  async updateProfile(userId: string, data: Partial<{
    fullName: string;
    avatarUrl: string;
    phone: string;
    whatsappPhone: string;
    address: string;
    school: string;
    dateOfBirth: string;
    guardianName: string;
    guardianPhone: string;
    relationship: string;
    occupation: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'OLD';
  }>) {
    const updateData: any = { ...data };
    if (data.dateOfBirth) {
      updateData.dateOfBirth = new Date(data.dateOfBirth);
    }

    return this.prisma.profile.update({
      where: { userId },
      data: updateData,
    });
  }

  async updatePhone(userId: string, phone: string, whatsappPhone?: string) {
    return this.prisma.profile.update({
      where: { userId },
      data: {
        phone,
        ...(whatsappPhone !== undefined && { whatsappPhone }),
      },
    });
  }

  async delete(userId: string) {
    return this.prisma.$transaction([
      this.prisma.watchSession.deleteMany({ where: { userId } }),
      this.prisma.classAttendance.deleteMany({ where: { userId } }),
      this.prisma.attendance.deleteMany({ where: { userId } }),
      this.prisma.paymentSlip.deleteMany({ where: { userId } }),
      this.prisma.enrollment.deleteMany({ where: { userId } }),
      this.prisma.profile.deleteMany({ where: { userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
  }

  async setStudentPassword(userId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user || user.role !== 'STUDENT') {
      throw new NotFoundException('Student not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);

    return { message: 'Student password updated successfully' };
  }

  /**
   * Fetch student data for ID card generation.
   * Filters: classId, studentId (userId), enrolled date range.
   */
  async getIdCardData(filters: {
    classId?: string;
    studentId?: string;
    enrolledFrom?: string;
    enrolledTo?: string;
    orgId?: string;
  }) {
    const where: any = { role: 'STUDENT' };
    const profileWhere: any = {};
    if (filters.orgId) where.orgId = filters.orgId;

    if (filters.enrolledFrom || filters.enrolledTo) {
      profileWhere.enrolledDate = {};
      if (filters.enrolledFrom) profileWhere.enrolledDate.gte = new Date(filters.enrolledFrom);
      if (filters.enrolledTo) profileWhere.enrolledDate.lte = new Date(filters.enrolledTo);
    }

    if (Object.keys(profileWhere).length > 0) {
      where.profile = profileWhere;
    }

    if (filters.studentId) {
      where.id = filters.studentId;
    }

    if (filters.classId) {
      where.enrollments = { some: { classId: filters.classId } };
    }

    const students = await this.prisma.user.findMany({
      where,
      include: {
        profile: {
          select: {
            fullName: true,
            instituteId: true,
            barcodeId: true,
            avatarUrl: true,
            school: true,
            phone: true,
            status: true,
            enrolledDate: true,
            gender: true,
          },
        },
        enrollments: {
          include: { class: { select: { id: true, name: true, subject: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return students
      .filter((s) => s.profile)
      .map((s) => ({
        userId: s.id,
        fullName: s.profile!.fullName,
        instituteId: s.profile!.instituteId,
        barcodeId: s.profile!.barcodeId,
        avatarUrl: s.profile!.avatarUrl,
        school: s.profile!.school,
        phone: s.profile!.phone,
        gender: (s.profile! as any).gender ?? null,
        status: s.profile!.status,
        enrolledDate: s.profile!.enrolledDate,
        classes: s.enrollments.map((e) => ({
          id: e.class.id,
          name: e.class.name,
          subject: e.class.subject,
        })),
      }));
  }

  /** Generate an Institute ID like TD-2026-0001 */
  private async generateInstituteId(): Promise<string> {
    const prefix = this.config.get('INSTITUTE_ID_PREFIX', 'TD');
    const year = new Date().getFullYear();

    const lastProfile = await this.prisma.profile.findFirst({
      where: {
        instituteId: { startsWith: `${prefix}-${year}-` },
      },
      orderBy: { instituteId: 'desc' },
    });

    let sequence = 1;
    if (lastProfile) {
      const lastSeq = parseInt(lastProfile.instituteId.split('-')[2], 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
  }
}
