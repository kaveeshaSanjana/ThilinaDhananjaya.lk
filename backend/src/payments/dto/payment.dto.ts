import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

enum PaymentType {
  MONTHLY = 'MONTHLY',
  ADMISSION = 'ADMISSION',
  OTHER = 'OTHER',
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
}
