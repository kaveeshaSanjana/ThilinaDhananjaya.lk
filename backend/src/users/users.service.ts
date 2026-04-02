import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

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

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, enrollments: { include: { class: true } } },
    });
  }

  async findAllStudents(search?: string) {
    const where: any = { role: 'STUDENT' };

    if (search) {
      where.OR = [
        { profile: { instituteId: { contains: search } } },
        { profile: { fullName: { contains: search } } },
        { profile: { school: { contains: search } } },
        { email: { contains: search } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
    });
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

  async delete(userId: string) {
    await this.prisma.profile.deleteMany({ where: { userId } });
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    await this.prisma.attendance.deleteMany({ where: { userId } });
    await this.prisma.paymentSlip.deleteMany({ where: { userId } });
    await this.prisma.enrollment.deleteMany({ where: { userId } });
    return this.prisma.user.delete({ where: { id: userId } });
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
