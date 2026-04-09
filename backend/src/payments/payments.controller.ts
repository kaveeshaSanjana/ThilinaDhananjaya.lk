import {
  Controller, Post, Get, Patch, Param, Body, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SubmitSlipDto, AdminNoteDto, VerifySlipDto, RejectSlipDto, SetPaymentStatusDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  /** Student: submit payment slip */
  @UseGuards(JwtAuthGuard)
  @Post('submit')
  submitSlip(
    @Request() req: any,
    @Body() body: SubmitSlipDto,
  ) {
    return this.paymentsService.submitSlip({
      userId: req.user.sub,
      ...body,
    });
  }

  /** Student: my payments */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyPayments(@Request() req: any) {
    return this.paymentsService.getMyPayments(req.user.sub);
  }

  /** Admin: pending slips */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('pending')
  getPendingSlips() {
    return this.paymentsService.getPendingSlips();
  }

  /** Admin: all slips, optional status filter */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('all')
  getAllSlips(
    @Query('status') status?: any,
    @Query('monthId') monthId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.getAllSlips(status, monthId, page ? +page : undefined, limit ? +limit : undefined);
  }

  /** Admin: verify slip */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/verify')
  verifySlip(@Param('id') id: string, @Body() body: VerifySlipDto) {
    return this.paymentsService.verifySlip(id, body.transactionId, body.adminNote, body.paidDate, body.paymentMethod as any, body.paymentPortion as any);
  }

  /** Admin: reject slip */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/reject')
  rejectSlip(@Param('id') id: string, @Body() body: RejectSlipDto) {
    return this.paymentsService.rejectSlip(id, body.rejectReason, body.adminNote);
  }

  /** Admin: payments for specific student */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('student/:userId')
  getStudentPayments(@Param('userId') userId: string) {
    return this.paymentsService.getStudentPayments(userId);
  }

  /**
   * Admin: Get all enrolled students for a class+month with payment status.
   * GET /api/payments/class/:classId/month/:monthId
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('class/:classId/month/:monthId')
  getClassMonthPaymentStatus(
    @Param('classId') classId: string,
    @Param('monthId') monthId: string,
  ) {
    return this.paymentsService.getClassMonthPaymentStatus(classId, monthId);
  }

  /**
   * Admin: Same as above but only needs the monthId — no classId required.
   * GET /api/payments/month/:monthId
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('month/:monthId')
  getMonthPaymentStatus(@Param('monthId') monthId: string) {
    return this.paymentsService.getMonthPaymentStatus(monthId);
  }

  /**
   * Admin: Manually set a student's payment status for a month.
   * PATCH /api/payments/student/:userId/month/:monthId/status
   * Body: { status: 'PAID' | 'LATE' | 'UNPAID', adminNote?: string }
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('student/:userId/month/:monthId/status')
  setStudentPaymentStatus(
    @Param('userId') userId: string,
    @Param('monthId') monthId: string,
    @Body() body: SetPaymentStatusDto,
  ) {
    return this.paymentsService.setStudentPaymentStatus(
      userId,
      monthId,
      body.status,
      body.adminNote,
      body.paidDate,
    );
  }
}
