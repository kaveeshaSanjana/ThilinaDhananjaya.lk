import {
  Controller, Post, Get, Patch, Param, Body, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SubmitSlipDto, AdminNoteDto } from './dto/payment.dto';
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
  getAllSlips(@Query('status') status?: any, @Query('monthId') monthId?: string) {
    return this.paymentsService.getAllSlips(status, monthId);
  }

  /** Admin: verify slip */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/verify')
  verifySlip(@Param('id') id: string, @Body() body: AdminNoteDto) {
    return this.paymentsService.verifySlip(id, body.adminNote);
  }

  /** Admin: reject slip */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/reject')
  rejectSlip(@Param('id') id: string, @Body() body: AdminNoteDto) {
    return this.paymentsService.rejectSlip(id, body.adminNote);
  }

  /** Admin: payments for specific student */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('student/:userId')
  getStudentPayments(@Param('userId') userId: string) {
    return this.paymentsService.getStudentPayments(userId);
  }
}
