import { Controller, Post, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsDateString, IsEnum } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

class PublicRegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

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
}

@Controller('public')
export class PublicController {
  constructor(private usersService: UsersService) {}

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
    const hashed = await bcrypt.hash(body.password, 12);
    const user = await this.usersService.create({
      email: body.email,
      password: hashed,
      fullName: body.fullName,
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

    return {
      message: 'Student registered successfully',
      student: {
        id: user.id,
        email: user.email,
        instituteId: user.profile?.instituteId,
        barcodeId: user.profile?.barcodeId,
        fullName: user.profile?.fullName,
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
    };
  }
}
