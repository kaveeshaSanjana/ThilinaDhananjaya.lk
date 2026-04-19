import { Controller, Post, Get, Delete, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { EnrollDto, EnrollByPhoneDto, UpdateEnrollmentPricingDto } from './dto/enrollment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private enrollmentsService: EnrollmentsService) {}

  /** Admin: enroll a student in a class by userId */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  enroll(@Body() body: EnrollDto) {
    return this.enrollmentsService.enroll(
      body.userId,
      body.classId,
      body.paymentType,
      body.customMonthlyFee,
    );
  }

  /** Admin: enroll a student by phone number */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('by-phone')
  enrollByPhone(@Body() body: EnrollByPhoneDto) {
    return this.enrollmentsService.enrollByPhone(
      body.phone,
      body.classId,
      body.paymentType,
      body.customMonthlyFee,
    );
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
  getClassEnrollments(
    @Param('classId') classId: string,
    @Query('paymentType') paymentType?: string,
    @Query('customOnly') customOnly?: string,
    @Query('search') search?: string,
  ) {
    return this.enrollmentsService.getEnrollmentsForClass(classId, {
      paymentType,
      customOnly,
      search,
    });
  }

  /** Admin: update payment type/custom fee for an enrolled student */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':userId/:classId/pricing')
  updateEnrollmentPricing(
    @Param('userId') userId: string,
    @Param('classId') classId: string,
    @Body() body: UpdateEnrollmentPricingDto,
  ) {
    return this.enrollmentsService.updateEnrollmentPricing(userId, classId, body);
  }

  /** Admin: unenroll */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':userId/:classId')
  unenroll(@Param('userId') userId: string, @Param('classId') classId: string) {
    return this.enrollmentsService.unenroll(userId, classId);
  }
}
