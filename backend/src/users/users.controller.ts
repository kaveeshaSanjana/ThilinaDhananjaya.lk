import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import * as bcrypt from 'bcrypt';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  /** Admin: list all users */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  findAll() {
    return this.usersService.findAllStudents();
  }

  /** Admin: list all students, searchable by instituteId/school/name */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('students')
  findAllStudents(@Query('search') search?: string) {
    return this.usersService.findAllStudents(search);
  }

  /** Admin: create a student */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('students')
  async createStudent(@Body() body: {
    email: string; password: string; fullName: string;
    phone?: string; whatsappPhone?: string; address?: string; school?: string;
    dateOfBirth?: string; guardianName?: string; guardianPhone?: string;
    relationship?: string; occupation?: string;
  }) {
    const hashed = await bcrypt.hash(body.password, 12);
    return this.usersService.create({
      email: body.email, password: hashed, fullName: body.fullName,
      phone: body.phone, whatsappPhone: body.whatsappPhone, address: body.address,
      school: body.school, dateOfBirth: body.dateOfBirth, guardianName: body.guardianName,
      guardianPhone: body.guardianPhone, relationship: body.relationship, occupation: body.occupation,
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
}
