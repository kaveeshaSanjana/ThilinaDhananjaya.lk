import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards, UploadedFile, UseInterceptors, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { UploadService } from '../upload/upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import * as bcrypt from 'bcrypt';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentPasswordDto } from './dto/update-student-password.dto';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private uploadService: UploadService,
  ) {}

  /** Admin: list all users */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Headers('x-institute-id') orgId?: string) {
    return this.usersService.findAllStudents(undefined, page ? +page : undefined, limit ? +limit : undefined, orgId);
  }

  /** Admin: list all students, searchable by instituteId/barcodeId/name/email */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('students')
  findAllStudents(
    @Query('search') search?: string,
    @Query('instituteUserId') instituteUserId?: string,
    @Query('institute_user_id') instituteUserIdSnake?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Headers('x-institute-id') orgId?: string,
  ) {
    return this.usersService.findAllStudents(
      search,
      page ? +page : undefined,
      limit ? +limit : undefined,
      orgId,
      instituteUserId || instituteUserIdSnake,
    );
  }

  /** Admin: get student data for ID card generation */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('students/id-card-data')
  getIdCardData(
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
    @Query('enrolledFrom') enrolledFrom?: string,
    @Query('enrolledTo') enrolledTo?: string,
    @Headers('x-institute-id') orgId?: string,
  ) {
    return this.usersService.getIdCardData({ classId, studentId, enrolledFrom, enrolledTo, orgId });
  }

  /** Admin: create a student */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('students')
  async createStudent(@Headers('x-institute-id') orgId: string | undefined, @Body() body: CreateStudentDto) {
    const hashed = await bcrypt.hash(body.password, 12);
    const instituteUserId = body.instituteUserId || body.instituteId;

    return this.usersService.create({
      email: body.email, password: hashed, fullName: body.fullName,
      instituteUserId,
      barcodeId: body.barcodeId,
      phone: body.phone, whatsappPhone: body.whatsappPhone, address: body.address,
      school: body.school, dateOfBirth: body.dateOfBirth, guardianName: body.guardianName,
      guardianPhone: body.guardianPhone, relationship: body.relationship,
      occupation: body.occupation, avatarUrl: body.avatarUrl, gender: body.gender,
      orgId: orgId || undefined,
    });
  }

  /** Admin: assign/reset a student's password */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('students/:id/password')
  @HttpCode(HttpStatus.OK)
  setStudentPassword(@Param('id') id: string, @Body() body: UpdateStudentPasswordDto) {
    return this.usersService.setStudentPassword(id, body.newPassword);
  }

  /** Admin: delete a student */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('students/:id')
  deleteStudent(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  /** Admin: get single student detail */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('students/:id')
  findStudent(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  /** Admin: update student profile / status */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('students/:id/profile')
  updateProfile(@Param('id') id: string, @Body() body: any) {
    return this.usersService.updateProfile(id, body);
  }

  /** Admin: update student phone number */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('students/:id/phone')
  updatePhone(
    @Param('id') id: string,
    @Body() body: { phone: string; whatsappPhone?: string },
  ) {
    return this.usersService.updatePhone(id, body.phone, body.whatsappPhone);
  }

  /** Admin: get student avatar URL */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('students/:id/avatar')
  async getAvatar(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return { avatarUrl: user?.profile?.avatarUrl ?? null };
  }

  /**
   * POST /users/students/:id/avatar
   * Upload a profile avatar for a student to S3 and update the profile.
   * Form field name: "file"
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('students/:id/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.uploadService.uploadImage(file, 'avatars');
    await this.usersService.updateProfile(id, { avatarUrl: url });
    return { avatarUrl: url };
  }
}
