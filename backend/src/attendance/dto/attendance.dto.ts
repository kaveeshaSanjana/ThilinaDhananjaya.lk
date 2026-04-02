import { IsString, IsNotEmpty, IsInt, IsOptional, IsNumber, IsArray, IsEnum, IsDateString, ValidateNested, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

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

// ─── Class Attendance (Physical) DTOs ────────────────────

export class MarkClassAttendanceDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsString()
  @IsNotEmpty()
  identifier: string; // userId, instituteId, or barcode

  @IsString()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD

  @IsString()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status: string;

  @IsOptional()
  @IsString()
  method?: string; // "barcode", "manual", "institute_id"

  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkClassAttendanceItemDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkClassAttendanceDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsString()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkClassAttendanceItemDto)
  records: BulkClassAttendanceItemDto[];

  @IsOptional()
  @IsString()
  method?: string;
}
