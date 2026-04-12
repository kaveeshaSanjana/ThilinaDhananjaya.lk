import { IsString, MinLength } from 'class-validator';

export class UpdateStudentPasswordDto {
  @IsString()
  @MinLength(6)
  newPassword: string;
}
