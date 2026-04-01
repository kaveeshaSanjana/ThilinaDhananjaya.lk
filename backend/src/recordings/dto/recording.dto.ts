import { IsString, IsNotEmpty, IsOptional, IsInt, IsEnum, Min } from 'class-validator';

enum RecordingStatus { ANYONE = 'ANYONE', STUDENTS_ONLY = 'STUDENTS_ONLY', PAID_ONLY = 'PAID_ONLY', PRIVATE = 'PRIVATE', INACTIVE = 'INACTIVE' }

export class CreateRecordingDto {
  @IsString() @IsNotEmpty() monthId: string;
  @IsString() @IsNotEmpty() title: string;
  @IsOptional() @IsString() description?: string;
  @IsString() @IsNotEmpty() videoUrl: string;
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @IsString() topic?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() materials?: string;
  @IsOptional() @IsInt() @Min(0) duration?: number;
  @IsOptional() @IsEnum(RecordingStatus) status?: RecordingStatus;
  @IsOptional() @IsInt() @Min(0) order?: number;
}

export class UpdateRecordingDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @IsString() topic?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() materials?: string;
  @IsOptional() @IsInt() @Min(0) duration?: number;
  @IsOptional() @IsEnum(RecordingStatus) status?: RecordingStatus;
  @IsOptional() @IsInt() @Min(0) order?: number;
}
