import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, IsEnum } from 'class-validator';

enum MonthStatus { ANYONE = 'ANYONE', STUDENTS_ONLY = 'STUDENTS_ONLY', PAID_ONLY = 'PAID_ONLY', PRIVATE = 'PRIVATE', INACTIVE = 'INACTIVE' }

export class CreateMonthDto {
  @IsString() @IsNotEmpty() name: string;
  @IsInt() year: number;
  @IsInt() @Min(1) @Max(12) month: number;
  @IsOptional() @IsEnum(MonthStatus) status?: MonthStatus;
}

export class UpdateMonthDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() year?: number;
  @IsOptional() @IsInt() @Min(1) @Max(12) month?: number;
  @IsOptional() @IsEnum(MonthStatus) status?: MonthStatus;
}
