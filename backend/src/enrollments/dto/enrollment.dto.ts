import { IsString, IsNotEmpty } from 'class-validator';

export class EnrollDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  classId: string;
}

export class EnrollByPhoneDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  classId: string;
}
