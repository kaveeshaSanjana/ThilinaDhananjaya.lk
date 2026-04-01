import { IsString, IsOptional, IsNotEmpty, IsNumber, IsEnum } from 'class-validator';

enum ClassStatus { ANYONE = 'ANYONE', STUDENTS_ONLY = 'STUDENTS_ONLY', PAID_ONLY = 'PAID_ONLY', PRIVATE = 'PRIVATE', INACTIVE = 'INACTIVE' }

export class CreateClassDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() monthlyFee?: number;
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @IsString() vision?: string;
  @IsOptional() @IsString() mission?: string;
  @IsOptional() @IsString() introVideoUrl?: string;
  @IsOptional() @IsEnum(ClassStatus) status?: ClassStatus;
}

export class UpdateClassDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() monthlyFee?: number;
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @IsString() vision?: string;
  @IsOptional() @IsString() mission?: string;
  @IsOptional() @IsString() introVideoUrl?: string;
  @IsOptional() @IsEnum(ClassStatus) status?: ClassStatus;
}
