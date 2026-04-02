import { IsString, IsNotEmpty, IsOptional, IsInt, IsEnum, IsBoolean, Min } from 'class-validator';

enum RecordingStatus { ANYONE = 'ANYONE', STUDENTS_ONLY = 'STUDENTS_ONLY', PAID_ONLY = 'PAID_ONLY', PRIVATE = 'PRIVATE', INACTIVE = 'INACTIVE' }
enum VideoType { DRIVE = 'DRIVE', YOUTUBE = 'YOUTUBE', ZOOM = 'ZOOM', OTHER = 'OTHER' }

export class CreateRecordingDto {
  @IsString() @IsNotEmpty() monthId: string;
  @IsString() @IsNotEmpty() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsEnum(VideoType) videoType?: VideoType;
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @IsString() topic?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() materials?: string;
  @IsOptional() @IsInt() @Min(0) duration?: number;
  @IsOptional() @IsEnum(RecordingStatus) status?: RecordingStatus;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsString() welcomeMessage?: string;
  @IsOptional() @IsBoolean() isLive?: boolean;
  @IsOptional() @IsString() liveUrl?: string;
}

export class UpdateRecordingDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsEnum(VideoType) videoType?: VideoType;
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @IsString() topic?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() materials?: string;
  @IsOptional() @IsInt() @Min(0) duration?: number;
  @IsOptional() @IsEnum(RecordingStatus) status?: RecordingStatus;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsString() welcomeMessage?: string;
  @IsOptional() @IsBoolean() isLive?: boolean;
  @IsOptional() @IsString() liveUrl?: string;
}
