import {
  IsString, IsNotEmpty, IsOptional, IsEnum,
  IsDateString, IsInt, IsPositive, IsUrl,
} from 'class-validator';

export enum LectureStatusDto {
  ANYONE       = 'ANYONE',
  STUDENTS_ONLY = 'STUDENTS_ONLY',
  PAID_ONLY    = 'PAID_ONLY',
  PRIVATE      = 'PRIVATE',
  INACTIVE     = 'INACTIVE',
}

export enum LectureModeDto {
  ONLINE  = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export class CreateLectureDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(LectureModeDto)
  mode?: LectureModeDto;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  sessionLink?: string;

  @IsOptional()
  @IsString()
  meetingId?: string;

  @IsOptional()
  @IsString()
  meetingPassword?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxParticipants?: number;

  @IsOptional()
  @IsEnum(LectureStatusDto)
  status?: LectureStatusDto;

  @IsOptional()
  @IsString()
  welcomeMessage?: string;
}

export class UpdateLectureDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(LectureModeDto)
  mode?: LectureModeDto;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  sessionLink?: string;

  @IsOptional()
  @IsString()
  meetingId?: string;

  @IsOptional()
  @IsString()
  meetingPassword?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxParticipants?: number;

  @IsOptional()
  @IsEnum(LectureStatusDto)
  status?: LectureStatusDto;

  @IsOptional()
  @IsString()
  welcomeMessage?: string;
}
