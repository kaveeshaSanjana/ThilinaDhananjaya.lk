import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';

enum PaymentType {
  MONTHLY = 'MONTHLY',
  ADMISSION = 'ADMISSION',
  OTHER = 'OTHER',
}

enum ManualPaymentStatus {
  PAID = 'PAID',
  LATE = 'LATE',
  UNPAID = 'UNPAID',
}

export class SubmitSlipDto {
  @IsString()
  @IsNotEmpty()
  monthId: string;

  @IsEnum(PaymentType)
  type: PaymentType;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsString()
  @IsNotEmpty()
  slipUrl: string;
}

export class AdminNoteDto {
  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsDateString()
  paidDate?: string;
}

export class VerifySlipDto {
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsDateString()
  paidDate?: string;
}

export class RejectSlipDto {
  @IsString()
  @IsNotEmpty()
  rejectReason: string;

  @IsOptional()
  @IsString()
  adminNote?: string;
}

export class SetPaymentStatusDto {
  @IsEnum(ManualPaymentStatus)
  status: ManualPaymentStatus;

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsDateString()
  paidDate?: string;
}
