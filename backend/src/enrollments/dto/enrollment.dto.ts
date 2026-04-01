import { IsString, IsNotEmpty } from 'class-validator';

export class EnrollDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  classId: string;
}
