import { Controller, Post, Get, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { EnrollDto } from './dto/enrollment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private enrollmentsService: EnrollmentsService) {}

  /** Admin: enroll a student in a class */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  enroll(@Body() body: EnrollDto) {
    return this.enrollmentsService.enroll(body.userId, body.classId);
  }

  /** Student: see my enrollments */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyEnrollments(@Request() req: any) {
    return this.enrollmentsService.getEnrollmentsForUser(req.user.sub);
  }

  /** Admin: see all enrollments for a class */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('class/:classId')
  getClassEnrollments(@Param('classId') classId: string) {
    return this.enrollmentsService.getEnrollmentsForClass(classId);
  }

  /** Admin: unenroll */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':userId/:classId')
  unenroll(@Param('userId') userId: string, @Param('classId') classId: string) {
    return this.enrollmentsService.unenroll(userId, classId);
  }
}
