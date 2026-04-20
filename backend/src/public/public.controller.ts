import { Controller, Post, Body, Headers, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsDateString, IsEnum, ValidateIf, IsIn } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AttendanceService } from '../attendance/attendance.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { PrismaService } from '../prisma/prisma.service';

enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

class PublicRegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ValidateIf((o: PublicRegisterDto) => !o.instituteId)
  @IsString()
  @IsNotEmpty()
  instituteUserId?: string;

  @IsOptional()
  @IsString()
  instituteId?: string;

  @IsString()
  @IsNotEmpty()
  barcodeId: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsappPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  school?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  orgId?: string; // Institute ID to assign the student to

  @IsOptional()
  @IsString()
  classId?: string; // Optional class id to auto-enroll after registration
}

class PublicImportAttendanceByBarcodeDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  barcodeId: string;

  @IsOptional()
  @IsString()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status?: string;

  @IsOptional()
  @IsDateString()
  sessionAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class PublicImportAttendanceByInstituteIdDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  instituteId: string;

  @IsOptional()
  @IsString()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status?: string;

  @IsOptional()
  @IsDateString()
  sessionAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

@Controller('public')
export class PublicController {
  constructor(
    private usersService: UsersService,
    private attendanceService: AttendanceService,
    private enrollmentsService: EnrollmentsService,
    private prisma: PrismaService,
  ) {}

  /**
   * Public endpoint — no authentication required.
   * Registers a new student. Accepts requests from any origin.
   * Use this for bulk-registration scripts.
   *
   * POST /api/public/register-student
   */
  @Post('register-student')
  @HttpCode(HttpStatus.CREATED)
  async registerStudent(
    @Body() body: PublicRegisterDto,
    @Headers('x-institute-id') headerOrgId?: string,
  ) {
    const classId = (body.classId || '').trim();

    if (classId) {
      const targetClass = await this.prisma.class.findUnique({
        where: { id: classId },
        select: { id: true },
      });

      if (!targetClass) {
        throw new NotFoundException(`Class not found: ${classId}`);
      }
    }

    const hashed = await bcrypt.hash(body.password, 12);
    const instituteUserId = body.instituteUserId || body.instituteId;

    const user = await this.usersService.create({
      email: body.email,
      password: hashed,
      fullName: body.fullName,
      instituteUserId,
      barcodeId: body.barcodeId,
      phone: body.phone,
      whatsappPhone: body.whatsappPhone,
      address: body.address,
      school: body.school,
      dateOfBirth: body.dateOfBirth,
      guardianName: body.guardianName,
      guardianPhone: body.guardianPhone,
      relationship: body.relationship,
      occupation: body.occupation,
      avatarUrl: body.avatarUrl,
      gender: body.gender,
      orgId: body.orgId || headerOrgId || undefined,
    });

    let enrollment: any = null;
    if (classId) {
      try {
        enrollment = await this.enrollmentsService.enroll(user.id, classId);
      } catch (error) {
        await this.usersService.delete(user.id).catch(() => null);
        throw error;
      }
    }

    return {
      message: 'Student registered successfully',
      student: {
        id: user.id,
        email: user.email,
        instituteId: user.orgId,
        instituteUserId: user.profile?.instituteId,
        barcodeId: user.profile?.barcodeId,
        fullName: user.profile?.fullName,
        avatarUrl: user.profile?.avatarUrl,
        phone: user.profile?.phone,
        whatsappPhone: user.profile?.whatsappPhone,
        school: user.profile?.school,
        address: user.profile?.address,
        occupation: user.profile?.occupation,
        gender: user.profile?.gender,
        dateOfBirth: user.profile?.dateOfBirth,
        guardianName: user.profile?.guardianName,
        guardianPhone: user.profile?.guardianPhone,
        relationship: user.profile?.relationship,
        status: user.profile?.status,
        enrolledDate: user.profile?.enrolledDate,
        createdAt: user.createdAt,
      },
      enrollment: enrollment
        ? {
          id: enrollment.id,
          classId: enrollment.classId,
          paymentType: enrollment.paymentType,
          customMonthlyFee: enrollment.customMonthlyFee,
          defaultMonthlyFee: enrollment.defaultMonthlyFee,
          effectiveMonthlyFee: enrollment.effectiveMonthlyFee,
          hasCustomMonthlyFee: enrollment.hasCustomMonthlyFee,
          class: enrollment.class
            ? {
              id: enrollment.class.id,
              name: enrollment.class.name,
              subject: enrollment.class.subject,
              monthlyFee: enrollment.class.monthlyFee,
            }
            : null,
          createdAt: enrollment.createdAt,
          updatedAt: enrollment.updatedAt,
        }
        : null,
    };
  }

  /**
   * Public endpoint for external systems:
   * Import one class attendance entry by barcode for a given attendance session id.
   */
  @Post('attendance/import/by-barcode')
  @HttpCode(HttpStatus.OK)
  async importAttendanceByBarcode(@Body() body: PublicImportAttendanceByBarcodeDto) {
    const result = await this.attendanceService.importPublicClassAttendanceBySessionBarcode({
      sessionId: body.sessionId,
      barcode: body.barcodeId,
      status: body.status || 'PRESENT',
      sessionAt: body.sessionAt,
      note: body.note,
    });

    return {
      message: 'Attendance imported successfully',
      ...result,
    };
  }

  /**
   * Public endpoint for external systems:
   * Import one class attendance entry by institute student id for a given attendance session id.
   */
  @Post('attendance/import/by-institute-id')
  @HttpCode(HttpStatus.OK)
  async importAttendanceByInstituteId(@Body() body: PublicImportAttendanceByInstituteIdDto) {
    const result = await this.attendanceService.importPublicClassAttendanceBySessionInstituteId({
      sessionId: body.sessionId,
      instituteId: body.instituteId,
      status: body.status || 'PRESENT',
      sessionAt: body.sessionAt,
      note: body.note,
    });

    return {
      message: 'Attendance imported successfully',
      ...result,
    };
  }
}
