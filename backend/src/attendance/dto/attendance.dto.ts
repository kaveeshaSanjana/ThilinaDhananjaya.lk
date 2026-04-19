import { IsString, IsNotEmpty, IsInt, IsOptional, IsNumber, IsArray, IsDateString, ValidateNested, Min, IsIn, Matches } from 'class-validator';
import { Type } from 'class-transformer';

const ATTENDANCE_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

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

  @IsOptional()
  @IsString()
  @Matches(ATTENDANCE_TIME_REGEX, { message: 'sessionTime must be in HH:mm format' })
  sessionTime?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sessionCode?: string; // e.g. cls002sub1

  @IsOptional()
  @IsDateString()
  sessionAt?: string;

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

  @IsOptional()
  @IsString()
  @Matches(ATTENDANCE_TIME_REGEX, { message: 'sessionTime must be in HH:mm format' })
  sessionTime?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sessionCode?: string;

  @IsOptional()
  @IsDateString()
  sessionAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkClassAttendanceItemDto)
  records: BulkClassAttendanceItemDto[];

  @IsOptional()
  @IsString()
  method?: string;
}

// ─── Specific identifier DTOs (one lookup each) ──────────

export class MarkByBarcodeDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsString()
  @IsNotEmpty()
  barcode: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsString()
  @Matches(ATTENDANCE_TIME_REGEX, { message: 'sessionTime must be in HH:mm format' })
  sessionTime?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sessionCode?: string;

  @IsOptional()
  @IsDateString()
  sessionAt?: string;

  @IsString()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class MarkByInstituteIdDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsString()
  @IsNotEmpty()
  instituteId: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsString()
  @Matches(ATTENDANCE_TIME_REGEX, { message: 'sessionTime must be in HH:mm format' })
  sessionTime?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sessionCode?: string;

  @IsOptional()
  @IsDateString()
  sessionAt?: string;

  @IsString()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class MarkByPhoneDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsString()
  @Matches(ATTENDANCE_TIME_REGEX, { message: 'sessionTime must be in HH:mm format' })
  sessionTime?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sessionCode?: string;

  @IsOptional()
  @IsDateString()
  sessionAt?: string;

  @IsString()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CloseClassAttendanceSessionDto {
  @IsString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsString()
  @Matches(ATTENDANCE_TIME_REGEX, { message: 'sessionTime must be in HH:mm format' })
  sessionTime?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sessionCode?: string;

  @IsOptional()
  @IsDateString()
  sessionAt?: string;
}
