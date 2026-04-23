import { Controller, Post, Body, Headers, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsDateString, IsEnum, ValidateIf, IsIn, IsArray, ArrayMinSize, ValidateNested, Matches, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AttendanceService } from '../attendance/attendance.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { PrismaService } from '../prisma/prisma.service';

const ATTENDANCE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ATTENDANCE_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

class PublicRegisterDto {
  @IsOptional()
  @IsEmail()
  email?: string; // Optional - can register with instituteUserId/barcodeId alone

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
  telephone?: string;

  @IsOptional()
  @IsString()
  whatsappPhone?: string;

  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @IsOptional()
  @IsString()
  guardianTelephone?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

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

  @IsOptional()
  @IsString()
  @IsIn(['FULL', 'HALF', 'FREE'])
  paymentType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  customMonthlyFee?: number;
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
  classId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'NOTMARKED'])
  status?: string;

  @IsOptional()
  @IsDateString()
  sessionAt?: string;

  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

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
  classId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'NOTMARKED'])
  status?: string;

  @IsOptional()
  @IsDateString()
  sessionAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class PublicBulkImportAttendanceByInstituteIdItemDto {
  @IsString()
  @IsNotEmpty()
  studentInstituteId: string;

  @IsOptional()
  @IsString()
  @Matches(ATTENDANCE_DATE_REGEX, { message: 'date must be in YYYY-MM-DD format' })
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(ATTENDANCE_TIME_REGEX, { message: 'checkInTime must be in HH:mm format' })
  checkInTime?: string;

  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @IsOptional()
  @IsString()
  @Matches(ATTENDANCE_TIME_REGEX, { message: 'checkOutTime must be in HH:mm format' })
  checkOutTime?: string;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'NOTMARKED'])
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class PublicBulkImportAttendanceByInstituteIdDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PublicBulkImportAttendanceByInstituteIdItemDto)
  records: PublicBulkImportAttendanceByInstituteIdItemDto[];
}

class PublicSessionAttendanceCheckDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  instituteId: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsDateString()
  checkInAt: string; // ISO datetime of student check-in

  @IsOptional()
  @IsDateString()
  checkOutAt?: string; // ISO datetime of student check-out

  @IsOptional()
  @IsString()
  note?: string;
}

class PublicBulkSessionAttendanceCheckDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PublicSessionAttendanceCheckItemDto)
  records: PublicSessionAttendanceCheckItemDto[];
}

class PublicSessionAttendanceCheckItemDto {
  @IsString()
  @IsNotEmpty()
  studentInstituteId: string;

  @IsDateString()
  checkInAt: string;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class PublicBulkRegisterStudentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PublicRegisterDto)
  students: PublicRegisterDto[];
}

@Controller('public')
export class PublicController {
  constructor(
    private usersService: UsersService,
    private attendanceService: AttendanceService,
    private enrollmentsService: EnrollmentsService,
    private prisma: PrismaService,
  ) {}

  private formatPublicStudentPayload(user: any) {
    return {
      id: user.id,
      email: user.email,
      instituteId: user.orgId,
      instituteUserId: user.profile?.instituteId,
      barcodeId: user.profile?.barcodeId,
      fullName: user.profile?.fullName,
      avatarUrl: user.profile?.avatarUrl,
      phone: user.profile?.phone,
      telephone: user.profile?.telephone,
      whatsappPhone: user.profile?.whatsappPhone,
      guardianPhone: user.profile?.guardianPhone,
      guardianTelephone: user.profile?.guardianTelephone,
      emergencyContactPhone: user.profile?.emergencyContactPhone,
      emergencyContactName: user.profile?.emergencyContactName,
      school: user.profile?.school,
      address: user.profile?.address,
      occupation: user.profile?.occupation,
      gender: user.profile?.gender,
      dateOfBirth: user.profile?.dateOfBirth,
      guardianName: user.profile?.guardianName,
      relationship: user.profile?.relationship,
      status: user.profile?.status,
      enrolledDate: user.profile?.enrolledDate,
      createdAt: user.createdAt,
    };
  }

  private formatPublicEnrollmentPayload(enrollment: any) {
    if (!enrollment) return null;

    return {
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
    };
  }

  private resolvePublicErrorMessage(error: any) {
    const errorMessage = error?.response?.message;
    if (Array.isArray(errorMessage)) {
      return errorMessage.join(', ');
    }
    if (typeof errorMessage === 'string' && errorMessage.trim()) {
      return errorMessage;
    }
    if (typeof error?.message === 'string' && error.message.trim()) {
      return error.message;
    }
    return 'Failed to register student';
  }

  private async registerSinglePublicStudent(
    body: PublicRegisterDto,
    headerOrgId?: string,
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
      telephone: body.telephone,
      whatsappPhone: body.whatsappPhone,
      guardianPhone: body.guardianPhone,
      guardianTelephone: body.guardianTelephone,
      emergencyContactPhone: body.emergencyContactPhone,
      emergencyContactName: body.emergencyContactName,
      address: body.address,
      school: body.school,
      dateOfBirth: body.dateOfBirth,
      guardianName: body.guardianName,
      relationship: body.relationship,
      occupation: body.occupation,
      avatarUrl: body.avatarUrl,
      gender: body.gender,
      orgId: body.orgId || headerOrgId || undefined,
    });

    let enrollment: any = null;
    if (classId) {
      try {
        enrollment = await this.enrollmentsService.enroll(
          user.id,
          classId,
          body.paymentType,
          body.customMonthlyFee,
        );
      } catch (error) {
        await this.usersService.delete(user.id).catch(() => null);
        throw error;
      }
    }

    return {
      student: this.formatPublicStudentPayload(user),
      enrollment: this.formatPublicEnrollmentPayload(enrollment),
    };
  }

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
    const result = await this.registerSinglePublicStudent(body, headerOrgId);

    return {
      message: 'Student registered successfully',
      ...result,
    };
  }

  /**
   * Public endpoint:
   * Bulk create students with optional class enrollment/fees per row.
   */
  @Post('register-students/bulk')
  @HttpCode(HttpStatus.OK)
  async registerStudentsBulk(
    @Body() body: PublicBulkRegisterStudentDto,
    @Headers('x-institute-id') headerOrgId?: string,
  ) {
    const successful: Array<{
      index: number;
      status: 'SUCCESS';
      email: string | null;
      studentId: string;
      instituteUserId: string | null;
      classId: string | null;
      enrollmentStatus: 'ENROLLED' | 'NOT_ENROLLED';
      student: any;
      enrollment: any;
    }> = [];

    const failed: Array<{
      index: number;
      status: 'FAILED';
      email: string | null;
      instituteUserId: string | null;
      classId: string | null;
      reason: string;
    }> = [];

    for (let i = 0; i < body.students.length; i += 1) {
      const index = i + 1;
      const row = body.students[i];
      const email = (row.email || '').trim();
      const instituteUserId = ((row.instituteUserId || row.instituteId || '') as string).trim() || null;
      const classId = (row.classId || '').trim() || null;

      try {
        const result = await this.registerSinglePublicStudent(row, headerOrgId);
        successful.push({
          index,
          status: 'SUCCESS',
          email: result.student.email,
          studentId: result.student.id,
          instituteUserId: result.student.instituteUserId || null,
          classId,
          enrollmentStatus: result.enrollment ? 'ENROLLED' : 'NOT_ENROLLED',
          student: result.student,
          enrollment: result.enrollment,
        });
      } catch (error: any) {
        failed.push({
          index,
          status: 'FAILED',
          email,
          instituteUserId,
          classId,
          reason: this.resolvePublicErrorMessage(error),
        });
      }
    }

    const totalRecords = body.students.length;
    const successCount = successful.length;
    const failedCount = failed.length;

    return {
      message: 'Bulk student registration processed',
      summary: {
        totalRecords,
        successCount,
        failedCount,
      },
      successful,
      failed,
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
      classId: body.classId,
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
      classId: body.classId,
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

  /**
   * Public endpoint for external systems:
   * Bulk import class attendance by institute student IDs for one session.
   */
  @Post('attendance/import/bulk/by-institute-id')
  @HttpCode(HttpStatus.OK)
  async importAttendanceBulkByInstituteId(@Body() body: PublicBulkImportAttendanceByInstituteIdDto) {
    const result = await this.attendanceService.importPublicClassAttendanceBulkBySessionInstituteId({
      sessionId: body.sessionId,
      classId: body.classId,
      records: body.records,
    });

    return {
      message: 'Bulk attendance import processed',
      ...result,
    };
  }

  /**
   * Public endpoint for session attendance checking:
   * Check and record a single student's attendance with time validation.
   * Validates that check-in/check-out times are within or match the session time window.
   */
  @Post('attendance/session/check')
  @HttpCode(HttpStatus.OK)
  async checkSessionAttendance(@Body() body: PublicSessionAttendanceCheckDto) {
    const result = await this.attendanceService.recordSessionAttendanceWithTimeCheck({
      sessionId: body.sessionId,
      classId: body.classId,
      instituteId: body.instituteId,
      checkInAt: body.checkInAt,
      checkOutAt: body.checkOutAt,
      note: body.note,
    });

    return {
      message: 'Session attendance recorded successfully',
      ...result,
    };
  }

  /**
   * Public endpoint for bulk session attendance checking:
   * Record multiple students' attendance for a session with time validation.
   */
  @Post('attendance/session/bulk-check')
  @HttpCode(HttpStatus.OK)
  async checkBulkSessionAttendance(@Body() body: PublicBulkSessionAttendanceCheckDto) {
    const result = await this.attendanceService.recordBulkSessionAttendanceWithTimeCheck({
      sessionId: body.sessionId,
      classId: body.classId,
      records: body.records.map(r => ({
        studentInstituteId: r.studentInstituteId,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
        note: r.note,
      })),
    });

    return {
      message: 'Bulk session attendance recorded successfully',
      ...result,
    };
  }
}











