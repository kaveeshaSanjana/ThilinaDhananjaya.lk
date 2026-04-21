import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

interface CreateUserData {
  email: string;
  password: string;
  fullName: string;
  instituteUserId?: string;
  barcodeId?: string;
  phone?: string;
  guardianPhone?: string;
  emergencyContactPhone?: string;
  emergencyContactName?: string;
  address?: string;
  school?: string;
  dateOfBirth?: string;
  guardianName?: string;
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

    const requestedInstituteUserId = (data.instituteUserId || '').trim();
    const requestedBarcodeId = (data.barcodeId || '').trim();

    if (requestedInstituteUserId) {
      const existingByInstituteUserId = await this.prisma.profile.findUnique({
        where: { instituteId: requestedInstituteUserId },
        select: { id: true },
      });
      if (existingByInstituteUserId) {
        throw new ConflictException('Institute user ID already exists');
      }
    }

    if (requestedBarcodeId) {
      const existingByBarcodeId = await this.prisma.profile.findUnique({
        where: { barcodeId: requestedBarcodeId },
        select: { id: true },
      });
      if (existingByBarcodeId) {
        throw new ConflictException('Barcode ID already exists');
      }
    }

    const instituteId = requestedInstituteUserId || await this.generateInstituteId();

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: data.email,
          password: data.password,
          role: 'STUDENT',
          orgId: data.orgId || null,
          profile: {
            create: {
              instituteId,
              barcodeId: requestedBarcodeId || null,
              fullName: data.fullName,
              avatarUrl: data.avatarUrl,
              phone: data.phone,
              guardianPhone: data.guardianPhone,
              emergencyContactPhone: data.emergencyContactPhone,
              emergencyContactName: data.emergencyContactName,
              address: data.address,
              school: data.school,
              occupation: data.occupation,
              gender: data.gender as any,
              dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
              guardianName: data.guardianName,
              relationship: data.relationship,
            },
          },
        },
        include: { profile: true },
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = String((error as any)?.meta?.target || '');
        if (target.includes('instituteId')) {
          throw new ConflictException('Institute user ID already exists');
        }
        if (target.includes('barcodeId')) {
          throw new ConflictException('Barcode ID already exists');
        }
        if (target.includes('email')) {
          throw new ConflictException('Email already registered');
        }
      }
      throw error;
    }

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

  async findAllStudents(search?: string, page?: number, limit?: number, orgId?: string, instituteUserId?: string) {
    const where: any = { role: 'STUDENT' };
    if (orgId) where.orgId = orgId;

    const exactInstituteUserId = (instituteUserId || '').trim();
    if (exactInstituteUserId) {
      where.profile = {
        ...(where.profile || {}),
        instituteId: exactInstituteUserId,
      };
    }

    if (search) {
      const query = search.trim();
      if (query) {
        where.OR = [
          { id: { contains: query } },
          { profile: { instituteId: { contains: query } } },
          { profile: { barcodeId: { contains: query } } },
          { profile: { fullName: { contains: query } } },
          { profile: { school: { contains: query } } },
          { profile: { phone: { contains: query } } },
          { profile: { whatsappPhone: { contains: query } } },
          { email: { contains: query } },
        ];
      }
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

    const dataWithAliases = data.map((student: any) => ({
      ...student,
      instituteUserId: student.profile?.instituteId || null,
      institute_user_id: student.profile?.instituteId || null,
      barcodeId: student.profile?.barcodeId || null,
      barcode_id: student.profile?.barcodeId || null,
    }));

    return {
      data: dataWithAliases,
      total,
      page: page || 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async updateProfile(userId: string, data: Partial<{
    fullName: string;
    instituteId: string;
    barcodeId: string | null;
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
    if (typeof data.instituteId === 'string') {
      updateData.instituteId = data.instituteId.trim();
    }
    if (data.barcodeId !== undefined) {
      updateData.barcodeId = data.barcodeId ? String(data.barcodeId).trim() : null;
    }
    if (data.dateOfBirth) {
      updateData.dateOfBirth = new Date(data.dateOfBirth);
    }

    try {
      return this.prisma.profile.update({
        where: { userId },
        data: updateData,
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = String((error as any)?.meta?.target || '');
        if (target.includes('instituteId')) {
          throw new ConflictException('Institute user ID already exists');
        }
        if (target.includes('barcodeId')) {
          throw new ConflictException('Barcode ID already exists');
        }
      }
      throw error;
    }
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

  async setInitialAvatar(userId: string, avatarUrl: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { userId: true, avatarUrl: true },
    });

    if (!profile) {
      throw new NotFoundException('Student profile not found');
    }

    const existingAvatar = typeof profile.avatarUrl === 'string' ? profile.avatarUrl.trim() : '';
    if (existingAvatar) {
      throw new ConflictException('Profile image already exists. Please contact admin to update it.');
    }

    return this.prisma.profile.update({
      where: { userId },
      data: { avatarUrl },
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
        instituteUserId: s.profile!.instituteId,
        institute_user_id: s.profile!.instituteId,
        barcodeId: s.profile!.barcodeId,
        barcode_id: s.profile!.barcodeId,
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
