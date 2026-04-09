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

enum PaymentMethod {
  ONLINE = 'ONLINE',
  PHYSICAL = 'PHYSICAL',
}

enum PaymentPortion {
  FULL = 'FULL',
  HALF = 'HALF',
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

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentPortion)
  paymentPortion?: PaymentPortion;
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
  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentPortion)
  paymentPortion?: PaymentPortion;
}

export class RejectSlipDto {
  @IsOptional()
  @IsString()
  rejectReason?: string;

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
