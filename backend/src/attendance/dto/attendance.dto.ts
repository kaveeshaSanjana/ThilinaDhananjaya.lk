import { IsString, IsNotEmpty, IsInt, IsOptional, IsNumber, IsArray, Min } from 'class-validator';

export class MarkAttendanceDto {
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @IsInt()
  @Min(0)
  watchedSec: number;
}

export class ManualAttendanceDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsString()
  recordingId?: string;

  @IsOptional()
  @IsString()
  eventName?: string;
}

// ─── Watch Session DTOs ──────────────────────────────────

export class StartSessionDto {
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @IsNumber()
  @Min(0)
  videoPosition: number;

  @IsOptional()
  @IsArray()
  events?: any[];
}

export class HeartbeatDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsNumber()
  @Min(0)
  videoPosition: number;

  @IsInt()
  @Min(0)
  watchedSec: number;

  @IsOptional()
  @IsArray()
  events?: any[];
}

export class EndSessionDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsNumber()
  @Min(0)
  videoPosition: number;

  @IsInt()
  @Min(0)
  watchedSec: number;

  @IsOptional()
  @IsArray()
  events?: any[];
}
