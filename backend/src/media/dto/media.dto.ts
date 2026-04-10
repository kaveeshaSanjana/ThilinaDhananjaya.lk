import { IsString, IsOptional, IsEnum, IsInt, IsUrl, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum MediaType {
  PDF = 'PDF',
  IMAGE = 'IMAGE',
  LINK = 'LINK',
  DOCUMENT = 'DOCUMENT',
  OTHER = 'OTHER',
}

export enum MediaStatus {
  ANYONE = 'ANYONE',
  STUDENTS_ONLY = 'STUDENTS_ONLY',
  PAID_ONLY = 'PAID_ONLY',
  PRIVATE = 'PRIVATE',
  INACTIVE = 'INACTIVE',
}

export class CreateMediaDto {
  @IsString()
  monthId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsEnum(MediaType)
  mediaType?: MediaType;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  size?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  order?: number;

  @IsOptional()
  @IsEnum(MediaStatus)
  status?: MediaStatus;
}

export class UpdateMediaDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsEnum(MediaType)
  mediaType?: MediaType;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  size?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  order?: number;

  @IsOptional()
  @IsEnum(MediaStatus)
  status?: MediaStatus;
}
