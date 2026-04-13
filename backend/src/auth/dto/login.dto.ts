import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined))
  @ValidateIf((o) => !o.email)
  @IsString()
  @MinLength(1)
  identifier?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined))
  @ValidateIf((o) => !o.identifier)
  @IsString()
  @MinLength(1)
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;
}
