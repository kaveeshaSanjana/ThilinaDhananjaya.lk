import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsIn, IsNumber, Min, IsBoolean } from 'class-validator';

export const ENROLLMENT_PAYMENT_TYPES = ['FULL', 'HALF', 'FREE'] as const;

export class EnrollDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsOptional()
  @IsString()
  @IsIn(ENROLLMENT_PAYMENT_TYPES)
  paymentType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  customMonthlyFee?: number;
}

export class EnrollByPhoneDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsOptional()
  @IsString()
  @IsIn(ENROLLMENT_PAYMENT_TYPES)
  paymentType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  customMonthlyFee?: number;
}

export class UpdateEnrollmentPricingDto {
  @IsOptional()
  @IsString()
  @IsIn(ENROLLMENT_PAYMENT_TYPES)
  paymentType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  customMonthlyFee?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  clearCustomFee?: boolean;
}
