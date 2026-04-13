import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export enum StudentGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export class CreateStudentDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ValidateIf((o: CreateStudentDto) => !o.instituteId)
  @IsString()
  @IsNotEmpty()
  instituteUserId?: string;

  @IsOptional()
  @IsString()
  instituteId?: string;

  @IsString()
  @IsNotEmpty()
  barcodeId: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsappPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  school?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(StudentGender)
  gender?: StudentGender;
}
