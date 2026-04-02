import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { UploadService } from '../upload/upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import * as bcrypt from 'bcrypt';

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
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.usersService.findAllStudents(undefined, page ? +page : undefined, limit ? +limit : undefined);
  }

  /** Admin: list all students, searchable by instituteId/school/name */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('students')
  findAllStudents(@Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.usersService.findAllStudents(search, page ? +page : undefined, limit ? +limit : undefined);
  }

  /** Admin: create a student */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('students')
  async createStudent(@Body() body: {
    email: string; password: string; fullName: string;
    phone?: string; whatsappPhone?: string; address?: string; school?: string;
    dateOfBirth?: string; guardianName?: string; guardianPhone?: string;
    relationship?: string; occupation?: string; avatarUrl?: string;
  }) {
    const hashed = await bcrypt.hash(body.password, 12);
    return this.usersService.create({
      email: body.email, password: hashed, fullName: body.fullName,
      phone: body.phone, whatsappPhone: body.whatsappPhone, address: body.address,
      school: body.school, dateOfBirth: body.dateOfBirth, guardianName: body.guardianName,
      guardianPhone: body.guardianPhone, relationship: body.relationship,
      occupation: body.occupation, avatarUrl: body.avatarUrl,
    });
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
