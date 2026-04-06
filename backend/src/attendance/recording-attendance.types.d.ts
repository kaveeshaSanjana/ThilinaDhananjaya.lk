// ─── Shared primitives ────────────────────────────────────────────────────────

export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'OLD';
export type AttendanceStatus = 'COMPLETED' | 'INCOMPLETE' | 'MANUAL';
export type WatchSessionStatus = 'WATCHING' | 'PAUSED' | 'ENDED';
export type VideoType = 'DRIVE' | 'YOUTUBE' | 'ZOOM' | 'OTHER';
export type PaymentSlipStatus = 'FREE' | 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NOT_PAID';

// ─── Shared building blocks ───────────────────────────────────────────────────

export interface RecordingAttendanceClass {
  id: string;
  name: string;
  subject: string | null;
}

export interface RecordingAttendanceMonth {
  id: string;
  name: string;
  year: number;
  month: number;
  class: RecordingAttendanceClass;
}

export interface RecordingAttendanceProfile {
  fullName: string;
  instituteId: string;
  avatarUrl: string | null;
  phone: string | null;
  status: StudentStatus;
}

export interface RecordingAttendanceUser {
  id: string;
  email: string;
  profile: RecordingAttendanceProfile | null;
}

// ─── Student endpoint ─────────────────────────────────────────────────────────
// GET /attendance/my/recordings?ids=id1,id2,...

export interface MyRecordingAttendance {
  status: AttendanceStatus;
  watchedSec: number;
  liveJoinedAt: string | null;
  completedAt: string | null;
  details: unknown[];
}

export interface MyRecordingSession {
  startedAt: string;
  endedAt: string | null;
  videoStartPos: number;
  videoEndPos: number;
  totalWatchedSec: number;
  status: WatchSessionStatus;
  events: unknown[];
}

export interface MyRecordingRow {
  id: string;
  title: string;
  duration: number | null;
  thumbnail: string | null;
  topic: string | null;
  isLive: boolean;
  order: number;
  videoType: VideoType | null;
  /** null if the student has never opened this recording */
  attendance: MyRecordingAttendance | null;
  sessionCount: number;
  totalWatchedSec: number;
  lastWatchedAt: string | null;
  sessions: MyRecordingSession[];
}

export interface MyRecordingMonthGroup {
  month: RecordingAttendanceMonth;
  recordings: MyRecordingRow[];
}

/** Response shape for GET /attendance/my/recordings */
export interface MyRecordingsAttendanceResponse {
  user: RecordingAttendanceUser | null;
  months: MyRecordingMonthGroup[];
}

// ─── Admin endpoint ───────────────────────────────────────────────────────────
// GET /attendance/recordings/users?ids=id1,id2,...&page=1&limit=50

export interface AdminRecordingMeta {
  id: string;
  title: string;
  duration: number | null;
  thumbnail: string | null;
  topic: string | null;
  isLive: boolean;
  order: number;
  videoType: VideoType | null;
}

export interface AdminRecordingMonthGroup {
  month: RecordingAttendanceMonth;
  recordings: AdminRecordingMeta[];
}

export interface AdminStudentRecordingRow {
  recordingId: string;
  attendanceStatus: AttendanceStatus | null;
  attendanceWatchedSec: number;
  liveJoinedAt: string | null;
  completedAt: string | null;
  sessionCount: number;
  totalWatchedSec: number;
  lastWatchedAt: string | null;
  paymentStatus: PaymentSlipStatus;
  sessions: AdminRecordingSession[];
}

export interface AdminRecordingSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  totalWatchedSec: number;
  status: WatchSessionStatus;
}

export interface AdminStudentRow {
  userId: string;
  user: RecordingAttendanceUser | null;
  enrolled: boolean;
  /**
   * One entry per selected recording ID, in the same order as the request `ids`.
   * Safe to access by index to populate a grid column.
   */
  recordings: AdminStudentRecordingRow[];
}

/** Response shape for GET /attendance/recordings/users */
export interface AdminRecordingsUsersAttendanceResponse {
  /** Recording metadata for building table column headers */
  months: AdminRecordingMonthGroup[];
  /** Paginated student rows */
  students: AdminStudentRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
