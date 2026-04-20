import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { uploadImage, uploadRecordingThumbnail } from '../../lib/imageUpload';
import CropImageInput from '../../components/CropImageInput';
import StickyDataTable, { type StickyColumn } from '../../components/StickyDataTable';
import { getInstituteAdminPath } from '../../lib/instituteRoutes';
import {
  buildStudentClassReportPdf,
  createStudentClassReportFileName,
  normalizeDateLabel,
  normalizePhysicalDate,
  type RecordingReportMode,
} from '../../lib/studentClassReportPdf';

const VISIBILITY_OPTIONS = ['ANYONE', 'STUDENTS_ONLY', 'PAID_ONLY', 'PRIVATE', 'INACTIVE'];
const ENROLLMENT_PAYMENT_TYPES = ['FULL', 'HALF', 'FREE'] as const;

type EnrollmentPaymentType = typeof ENROLLMENT_PAYMENT_TYPES[number];

const PAYMENT_TYPE_META: Record<EnrollmentPaymentType, { label: string; badge: string; chipClass: string }> = {
  FULL: {
    label: 'Full',
    badge: 'bg-blue-100 text-blue-700',
    chipClass: 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100',
  },
  HALF: {
    label: 'Half',
    badge: 'bg-amber-100 text-amber-700',
    chipClass: 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100',
  },
  FREE: {
    label: 'Free Card',
    badge: 'bg-emerald-100 text-emerald-700',
    chipClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
  },
};

function formatMoney(amount: unknown) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '-';
  const rounded = Math.round(amount * 100) / 100;
  return `Rs. ${rounded.toLocaleString('en-LK', { minimumFractionDigits: rounded % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function fmtTime(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    ANYONE: 'bg-green-100 text-green-700',
    STUDENTS_ONLY: 'bg-blue-100 text-blue-700',
    PAID_ONLY: 'bg-amber-100 text-amber-700',
    PRIVATE: 'bg-purple-100 text-purple-700',
    INACTIVE: 'bg-slate-100 text-slate-500',
  };
  return map[s] || map.ANYONE;
};

type PhysicalCellStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'NOT_MARKED';
type PhysicalEditableCellStatus = PhysicalCellStatus;

const PHYSICAL_EDITABLE_STATUSES: PhysicalEditableCellStatus[] = ['PRESENT', 'ABSENT', 'NOT_MARKED', 'EXCUSED', 'LATE'];

function isPhysicalEditableStatus(value: unknown): value is PhysicalEditableCellStatus {
  return value === 'PRESENT'
    || value === 'ABSENT'
    || value === 'NOT_MARKED'
    || value === 'EXCUSED'
    || value === 'LATE';
}

interface PhysicalMonitorSlot {
  key: string;
  date: string;
  sessionTime: string;
  sessionCode: string | null;
}

interface PhysicalMonitorStudent {
  userId: string;
  fullName: string;
  instituteId: string;
  email: string;
  phone: string;
  barcodeId: string;
  avatarUrl: string | null;
  statuses: Record<string, PhysicalCellStatus>;
}

interface PhysicalReportGroup {
  id: string;
  name: string;
  slotKeys: string[];
  orderNo?: number;
}

interface PhysicalQuickSession {
  key: string;
  date: string;
  sessionTime: string;
  sessionCode: string | null;
  sessionAt: string | null;
  readableId: string;
  label: string;
  recordsCount: number;
  source: 'CREATED' | 'ATTENDANCE' | 'BOTH';
  weekId: string | null;
  weekName: string | null;
}

interface PhysicalSessionStudentRow {
  userId: string;
  fullName: string;
  instituteId: string;
  phone: string;
  barcodeId: string;
  avatarUrl: string | null;
  status: PhysicalCellStatus;
  attendanceId: string | null;
  markedAt: string | null;
}

interface PhysicalWeekPreviewStudentRow {
  userId: string;
  fullName: string;
  instituteId: string;
  phone: string;
  barcodeId: string;
  avatarUrl: string | null;
  statuses: Record<string, PhysicalCellStatus>;
}

type ClassPaymentStatus = 'PAID' | 'PENDING' | 'UNPAID';
type ClassPaymentStatusFilter = 'ALL' | ClassPaymentStatus;

interface ClassPaymentMonthRow {
  monthId: string;
  monthName: string;
  year: number;
  month: number;
  status: ClassPaymentStatus;
}

interface ClassPaymentStudentRow {
  userId: string;
  fullName: string;
  instituteId: string;
  barcodeId: string;
  phone: string;
  avatarUrl: string | null;
  paidCount: number;
  pendingCount: number;
  unpaidCount: number;
  months: ClassPaymentMonthRow[];
}

const PHYSICAL_STATUS_LABEL: Record<PhysicalCellStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  EXCUSED: 'Excused',
  NOT_MARKED: 'Not Marked',
};

const PHYSICAL_STATUS_BADGE: Record<PhysicalCellStatus, string> = {
  PRESENT: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  LATE: 'border-amber-200 bg-amber-50 text-amber-700',
  ABSENT: 'border-red-200 bg-red-50 text-red-700',
  EXCUSED: 'border-blue-200 bg-blue-50 text-blue-700',
  NOT_MARKED: 'border-slate-200 bg-slate-50 text-slate-500',
};

const CLASS_PAYMENT_STATUS_BADGE: Record<ClassPaymentStatus, string> = {
  PAID: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  UNPAID: 'border-rose-200 bg-rose-50 text-rose-700',
};

const CLASS_PAYMENT_STATUS_LABEL: Record<ClassPaymentStatus, string> = {
  PAID: 'Paid',
  PENDING: 'Pending',
  UNPAID: 'Unpaid',
};

function resolveClassPaymentOverallStatus(row: ClassPaymentStudentRow): ClassPaymentStatus {
  if (row.pendingCount > 0) return 'PENDING';
  if (row.unpaidCount > 0) return 'UNPAID';
  return 'PAID';
}

function formatPhysicalSlotLabel(slot: Pick<PhysicalMonitorSlot, 'date' | 'sessionTime' | 'sessionCode'>) {
  const code = typeof slot.sessionCode === 'string' ? slot.sessionCode.trim() : '';
  if (code) return code;

  const time = slot.sessionTime && slot.sessionTime !== '00:00' ? ` ${slot.sessionTime}` : '';
  return `${slot.date}${time}`;
}

function buildReadableSessionId(date: string, sessionTime: string, sessionCode: string | null) {
  const datePart = date.replace(/-/g, '');
  const timePart = /^([01]\d|2[0-3]):([0-5]\d)$/.test(sessionTime)
    ? sessionTime.replace(':', '')
    : '0000';
  const codePart = (sessionCode || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 10);

  return codePart
    ? `SES-${datePart}-${timePart}-${codePart}`
    : `SES-${datePart}-${timePart}`;
}

function normalizePhysicalQuickSessionItem(item: unknown): PhysicalQuickSession | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;

  const date = asIsoDate(row.date);
  if (!date) return null;

  const sessionTime = typeof row.sessionTime === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(row.sessionTime.trim())
    ? row.sessionTime.trim()
    : '00:00';

  const sessionCode = typeof row.sessionCode === 'string' && row.sessionCode.trim()
    ? row.sessionCode.trim()
    : null;
  const sessionAt = typeof row.sessionAt === 'string' && row.sessionAt.trim()
    ? row.sessionAt.trim()
    : null;
  const key = typeof row.key === 'string' && row.key.trim()
    ? row.key.trim()
    : `${date}|${sessionTime}`;
  const weekId = typeof row.weekId === 'string' && row.weekId.trim()
    ? row.weekId.trim()
    : null;
  const weekName = typeof row.weekName === 'string' && row.weekName.trim()
    ? row.weekName.trim()
    : null;
  const recordsCount = typeof row.recordsCount === 'number' && Number.isFinite(row.recordsCount)
    ? Math.max(0, Math.trunc(row.recordsCount))
    : 0;

  const rawSource = typeof row.source === 'string' ? row.source.trim().toUpperCase() : '';
  const source = rawSource === 'CREATED' || rawSource === 'ATTENDANCE' || rawSource === 'BOTH'
    ? rawSource
    : recordsCount > 0
      ? 'ATTENDANCE'
      : 'CREATED';

  const label = typeof row.label === 'string' && row.label.trim()
    ? row.label.trim()
    : formatPhysicalSlotLabel({ date, sessionTime, sessionCode });
  const readableId = typeof row.readableId === 'string' && row.readableId.trim()
    ? row.readableId.trim()
    : buildReadableSessionId(date, sessionTime, sessionCode);

  return {
    key,
    date,
    sessionTime,
    sessionCode,
    sessionAt,
    readableId,
    label,
    recordsCount,
    source,
    weekId,
    weekName,
  };
}

function normalizePhysicalWeekGroupItem(item: unknown): PhysicalReportGroup | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;

  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!id || !name) return null;

  const orderNo = typeof row.orderNo === 'number' && Number.isFinite(row.orderNo)
    ? Math.trunc(row.orderNo)
    : undefined;

  const slotKeys = Array.isArray(row.sessions)
    ? Array.from(new Set(
      row.sessions
        .map((session) => normalizePhysicalQuickSessionItem(session)?.key)
        .filter((key): key is string => Boolean(key)),
    ))
    : [];

  return {
    id,
    name,
    slotKeys,
    orderNo,
  };
}

function asIsoDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const shortIso = trimmed.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(shortIso) ? shortIso : '';
}

function toLocalDateTimeInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoDateTimeFromInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function formatDateTimeLabel(value: string | null | undefined): string {
  if (!value) return 'Not marked';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not marked';

  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizePhysicalStatuses(statuses: Record<string, PhysicalCellStatus>, slots: PhysicalMonitorSlot[]) {
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  slots.forEach((slot) => {
    const status = statuses[slot.key] || 'NOT_MARKED';
    if (status === 'PRESENT') present += 1;
    else if (status === 'LATE') late += 1;
    else if (status === 'ABSENT') absent += 1;
    else if (status === 'EXCUSED') excused += 1;
  });

  const percentage = slots.length > 0 ? Math.round(((present + late) / slots.length) * 100) : 0;

  return {
    present,
    late,
    absent,
    excused,
    percentage,
  };
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

type Tab = 'months' | 'recordings' | 'students' | 'attendance' | 'payments';

const emptyMonthForm = { name: '', year: new Date().getFullYear().toString(), month: (new Date().getMonth() + 1).toString(), status: 'ANYONE' };
const emptyRecForm = { monthId: '', title: '', description: '', videoUrl: '', thumbnail: '', topic: '', icon: '', materials: '', status: 'PAID_ONLY' };

export default function AdminClassDetail() {
  const { id, instituteId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTabParam = (searchParams.get('tab') || '').trim().toLowerCase();
  const rawAttendanceViewParam = (searchParams.get('attendanceView') || '').trim().toLowerCase();
  const rawPaymentStatusParam = (searchParams.get('paymentStatus') || '').trim().toUpperCase();
  const initialTabFromQuery: Tab = rawTabParam === 'attendance' && rawAttendanceViewParam === 'payments'
    ? 'payments'
    : rawTabParam === 'months'
    || rawTabParam === 'recordings'
    || rawTabParam === 'students'
    || rawTabParam === 'attendance'
    || rawTabParam === 'payments'
    ? rawTabParam
    : 'months';
  const initialPaymentStatusFilter: ClassPaymentStatusFilter = rawPaymentStatusParam === 'PAID'
    || rawPaymentStatusParam === 'PENDING'
    || rawPaymentStatusParam === 'UNPAID'
    ? rawPaymentStatusParam
    : 'ALL';
  const initialPaymentSearchText = (searchParams.get('paymentSearch') || '').trim();

  const [cls, setCls] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTabFromQuery);

  // Months
  const [months, setMonths] = useState<any[]>([]);
  const [showMonthForm, setShowMonthForm] = useState(false);
  const [editingMonth, setEditingMonth] = useState<any>(null);
  const [monthForm, setMonthForm] = useState({ ...emptyMonthForm });
  const [monthSaving, setMonthSaving] = useState(false);
  const [monthError, setMonthError] = useState('');

  // Recordings
  const [recordings, setRecordings] = useState<any[]>([]);
  const [showRecForm, setShowRecForm] = useState(false);
  const [editingRec, setEditingRec] = useState<any>(null);
  const [recForm, setRecForm] = useState({ ...emptyRecForm });
  const [recSaving, setRecSaving] = useState(false);
  const [recError, setRecError] = useState('');
  const [uploadingRecThumbnail, setUploadingRecThumbnail] = useState(false);
  const [filterMonth, setFilterMonth] = useState('');
  const [recordingsViewMode, setRecordingsViewMode] = useState<'LIST' | 'CARDS'>('LIST');

  // Students
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [enrollId, setEnrollId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMode, setEnrollMode] = useState<'userId' | 'phone'>('userId');
  const [enrollPhone, setEnrollPhone] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [enrollPaymentType, setEnrollPaymentType] = useState<EnrollmentPaymentType>('FULL');
  const [enrollUseCustomFee, setEnrollUseCustomFee] = useState(false);
  const [enrollCustomFee, setEnrollCustomFee] = useState('');
  const [studentsViewMode, setStudentsViewMode] = useState<'SIMPLE' | 'ADVANCED'>('SIMPLE');
  const [showEnrollPricingOptions, setShowEnrollPricingOptions] = useState(false);
  const [studentPaymentTypeFilter, setStudentPaymentTypeFilter] = useState<'ALL' | EnrollmentPaymentType>('ALL');
  const [studentCustomFeeFilter, setStudentCustomFeeFilter] = useState<'ALL' | 'CUSTOM_ONLY' | 'DEFAULT_ONLY'>('ALL');
  const [enrollmentTableSearch, setEnrollmentTableSearch] = useState('');
  const [pricingModalRow, setPricingModalRow] = useState<any>(null);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState('');
  const [pricingForm, setPricingForm] = useState<{
    paymentType: EnrollmentPaymentType;
    useCustomFee: boolean;
    customFee: string;
  }>({
    paymentType: 'FULL',
    useCustomFee: false,
    customFee: '',
  });
  const [selectedReportUserIds, setSelectedReportUserIds] = useState<string[]>([]);
  const [reportIncludePayments, setReportIncludePayments] = useState(true);
  const [reportIncludePhysicalAttendance, setReportIncludePhysicalAttendance] = useState(true);
  const [reportIncludeRecordingAttendance, setReportIncludeRecordingAttendance] = useState(true);
  const [reportRecordingMode, setReportRecordingMode] = useState<RecordingReportMode>('SUMMARY');
  const [reporting, setReporting] = useState(false);
  const [reportProgress, setReportProgress] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportWarning, setReportWarning] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');

  // Watch Sessions
  const [watchSessions, setWatchSessions] = useState<any[]>([]);
  const [recordingManageViewMode, setRecordingManageViewMode] = useState<'STUDENT' | 'SESSION'>('STUDENT');
  const [recordingManageMonthFilter, setRecordingManageMonthFilter] = useState('');
  const [recordingManageRecordingFilter, setRecordingManageRecordingFilter] = useState('');
  const [recordingManageSearch, setRecordingManageSearch] = useState('');

  // Physical attendance quick tools (class-wise)
  const [physicalAvailableDates, setPhysicalAvailableDates] = useState<string[]>([]);
  const [physicalFromDate, setPhysicalFromDate] = useState('');
  const [physicalToDate, setPhysicalToDate] = useState('');
  const [physicalLoadingPreview, setPhysicalLoadingPreview] = useState(false);
  const [physicalPreviewLoaded, setPhysicalPreviewLoaded] = useState(false);
  const [physicalPreviewError, setPhysicalPreviewError] = useState('');
  const [physicalGroupName, setPhysicalGroupName] = useState('');
  const [physicalGroupSelectedSlots, setPhysicalGroupSelectedSlots] = useState<string[]>([]);
  const [physicalGroupError, setPhysicalGroupError] = useState('');
  const [physicalWeekBuilderOpen, setPhysicalWeekBuilderOpen] = useState(false);
  const [physicalReportGroups, setPhysicalReportGroups] = useState<PhysicalReportGroup[]>([]);
  const [physicalSelectedWeekIds, setPhysicalSelectedWeekIds] = useState<string[]>([]);
  const [physicalWeeksLoading, setPhysicalWeeksLoading] = useState(false);
  const [physicalWeeksError, setPhysicalWeeksError] = useState('');
  const [physicalSavingWeekGroup, setPhysicalSavingWeekGroup] = useState(false);
  const [physicalDeletingWeekId, setPhysicalDeletingWeekId] = useState('');
  const [physicalAssigningWeekSessionKey, setPhysicalAssigningWeekSessionKey] = useState('');
  const [physicalMonitor, setPhysicalMonitor] = useState<{
    slots: PhysicalMonitorSlot[];
    students: PhysicalMonitorStudent[];
  } | null>(null);
  const [physicalSearchText, setPhysicalSearchText] = useState('');
  const [physicalFocusedSlotKey, setPhysicalFocusedSlotKey] = useState('');
  const [physicalQuickSessions, setPhysicalQuickSessions] = useState<PhysicalQuickSession[]>([]);
  const [physicalQuickSessionKey, setPhysicalQuickSessionKey] = useState('');
  const [physicalQuickSessionsLoading, setPhysicalQuickSessionsLoading] = useState(false);
  const [physicalSessionFormOpen, setPhysicalSessionFormOpen] = useState(false);
  const [physicalNewSessionDate, setPhysicalNewSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [physicalNewSessionTime, setPhysicalNewSessionTime] = useState('00:00');
  const [physicalNewSessionName, setPhysicalNewSessionName] = useState('');
  const [physicalCreatingSession, setPhysicalCreatingSession] = useState(false);
  const [physicalCreateSessionError, setPhysicalCreateSessionError] = useState('');
  const [physicalCreateSessionSuccess, setPhysicalCreateSessionSuccess] = useState('');
  const [physicalSessionRows, setPhysicalSessionRows] = useState<PhysicalSessionStudentRow[]>([]);
  const [physicalSessionLoading, setPhysicalSessionLoading] = useState(false);
  const [physicalSessionError, setPhysicalSessionError] = useState('');
  const [physicalSessionClosing, setPhysicalSessionClosing] = useState(false);
  const [physicalSessionCloseMessage, setPhysicalSessionCloseMessage] = useState('');
  const [physicalSessionManualMode, setPhysicalSessionManualMode] = useState(false);
  const [physicalSessionDraftStatus, setPhysicalSessionDraftStatus] = useState<Record<string, PhysicalEditableCellStatus>>({});
  const [physicalSessionDraftMarkedAt, setPhysicalSessionDraftMarkedAt] = useState<Record<string, string>>({});
  const [physicalSessionBatchSaving, setPhysicalSessionBatchSaving] = useState(false);
  const [physicalSessionSavingUserIds, setPhysicalSessionSavingUserIds] = useState<string[]>([]);
  const [physicalSessionEditingTimeUserIds, setPhysicalSessionEditingTimeUserIds] = useState<string[]>([]);
  const [physicalWeekPreviewRows, setPhysicalWeekPreviewRows] = useState<PhysicalWeekPreviewStudentRow[]>([]);
  const [physicalWeekPreviewLoading, setPhysicalWeekPreviewLoading] = useState(false);
  const [physicalWeekPreviewError, setPhysicalWeekPreviewError] = useState('');
  const [physicalWeekPreviewLoaded, setPhysicalWeekPreviewLoaded] = useState(false);
  const [physicalPaymentMonths, setPhysicalPaymentMonths] = useState<Array<{
    id: string;
    name: string;
    year: number;
    month: number;
  }>>([]);
  const [physicalPaymentRows, setPhysicalPaymentRows] = useState<ClassPaymentStudentRow[]>([]);
  const [physicalPaymentLoading, setPhysicalPaymentLoading] = useState(false);
  const [physicalPaymentError, setPhysicalPaymentError] = useState('');
  const [physicalPaymentExporting, setPhysicalPaymentExporting] = useState(false);
  const [physicalPaymentExportError, setPhysicalPaymentExportError] = useState('');
  const [physicalPaymentStatusFilter, setPhysicalPaymentStatusFilter] = useState<ClassPaymentStatusFilter>(initialPaymentStatusFilter);
  const [physicalPaymentSearchText, setPhysicalPaymentSearchText] = useState(initialPaymentSearchText);

  const loadClass = () => api.get(`/classes/${id}`).then(r => setCls(r.data)).catch(() => {});
  const loadMonths = () => api.get(`/classes/${id}/months`).then(r => setMonths(r.data)).catch(() => {});
  const loadRecordings = () => api.get(`/classes/${id}/recordings`).then(r => setRecordings(r.data)).catch(() => {});
  const loadEnrollments = () => api.get(`/enrollments/class/${id}`).then(r => setEnrollments(r.data || [])).catch(() => {});
  const loadStudents = () => api.get('/users/students', { params: { limit: 200 } }).then(r => {
    const res = r.data;
    setAllStudents(res?.data ? res.data : Array.isArray(res) ? res : []);
  }).catch(() => {});
  const loadWatchSessions = () => api.get(`/attendance/watch-sessions/class/${id}`).then(r => setWatchSessions(r.data || [])).catch(() => {});

  const getWatchSessionMeta = (session: any) => {
    const profile = session?.user?.profile || {};
    const userId = typeof session?.userId === 'string' && session.userId
      ? session.userId
      : typeof session?.user?.id === 'string' && session.user.id
        ? session.user.id
        : '';
    const fullName = typeof profile?.fullName === 'string' && profile.fullName.trim()
      ? profile.fullName.trim()
      : typeof session?.user?.email === 'string' && session.user.email
        ? session.user.email
        : userId || 'Student';

    const instituteId = typeof profile?.instituteId === 'string' ? profile.instituteId : '';
    const email = typeof session?.user?.email === 'string' ? session.user.email : '';
    const phone = typeof profile?.phone === 'string' ? profile.phone : '';
    const avatarUrl = typeof profile?.avatarUrl === 'string' && profile.avatarUrl.trim() ? profile.avatarUrl : null;

    const recordingId = typeof session?.recordingId === 'string' && session.recordingId
      ? session.recordingId
      : typeof session?.recording?.id === 'string' && session.recording.id
        ? session.recording.id
        : '';
    const recordingTitle = typeof session?.recording?.title === 'string' && session.recording.title.trim()
      ? session.recording.title.trim()
      : 'Recording';

    const monthId = typeof session?.recording?.monthId === 'string' && session.recording.monthId
      ? session.recording.monthId
      : typeof session?.recording?.month?.id === 'string' && session.recording.month.id
        ? session.recording.month.id
        : '';
    const monthName = typeof session?.recording?.month?.name === 'string' && session.recording.month.name.trim()
      ? session.recording.month.name.trim()
      : '-';

    const startedAt = typeof session?.startedAt === 'string' ? session.startedAt : '';
    const endedAt = typeof session?.endedAt === 'string' ? session.endedAt : '';
    const totalWatchedSec = typeof session?.totalWatchedSec === 'number'
      ? session.totalWatchedSec
      : Number(session?.totalWatchedSec || 0) || 0;
    const status = typeof session?.status === 'string' ? session.status : '-';

    return {
      id: typeof session?.id === 'string' ? session.id : `${userId}:${recordingId}:${startedAt}`,
      userId,
      fullName,
      instituteId,
      email,
      phone,
      avatarUrl,
      recordingId,
      recordingTitle,
      monthId,
      monthName,
      startedAt,
      endedAt,
      totalWatchedSec,
      status,
    };
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadClass(), loadMonths(), loadRecordings(), loadEnrollments()])
      .finally(() => setLoading(false));
  }, [id]);

  // Lazy-load students when the students tab is selected.
  useEffect(() => {
    if (tab === 'students' && allStudents.length === 0) loadStudents();
  }, [tab]);

  useEffect(() => {
    const validUserIds = new Set(enrollments.map((row: any) => row.userId));
    setSelectedReportUserIds((prev) => prev.filter((userId) => validUserIds.has(userId)));
  }, [enrollments]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    if (tab === 'attendance') {
      nextParams.set('tab', 'attendance');
      nextParams.delete('attendanceView');
      nextParams.delete('paymentStatus');
      nextParams.delete('paymentSearch');
    } else if (tab === 'payments') {
      nextParams.set('tab', 'payments');
      nextParams.delete('attendanceView');

      if (physicalPaymentStatusFilter === 'ALL') {
        nextParams.delete('paymentStatus');
      } else {
        nextParams.set('paymentStatus', physicalPaymentStatusFilter);
      }

      const trimmedSearch = physicalPaymentSearchText.trim();
      if (trimmedSearch) {
        nextParams.set('paymentSearch', trimmedSearch);
      } else {
        nextParams.delete('paymentSearch');
      }
    } else {
      nextParams.set('tab', tab);
      nextParams.delete('attendanceView');
      nextParams.delete('paymentStatus');
      nextParams.delete('paymentSearch');
    }

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    physicalPaymentSearchText,
    physicalPaymentStatusFilter,
    searchParams,
    setSearchParams,
    tab,
  ]);

  useEffect(() => {
    if ((tab !== 'attendance' && tab !== 'payments') || !id) {
      setPhysicalAvailableDates([]);
      setPhysicalFromDate('');
      setPhysicalToDate('');
      setPhysicalPreviewLoaded(false);
      setPhysicalPreviewError('');
      setPhysicalGroupName('');
      setPhysicalGroupSelectedSlots([]);
      setPhysicalGroupError('');
      setPhysicalWeekBuilderOpen(false);
      setPhysicalReportGroups([]);
      setPhysicalSelectedWeekIds([]);
      setPhysicalWeeksLoading(false);
      setPhysicalWeeksError('');
      setPhysicalSavingWeekGroup(false);
      setPhysicalDeletingWeekId('');
      setPhysicalAssigningWeekSessionKey('');
      setPhysicalMonitor(null);
      setPhysicalFocusedSlotKey('');
      setPhysicalQuickSessions([]);
      setPhysicalQuickSessionKey('');
      setPhysicalQuickSessionsLoading(false);
      setPhysicalSessionFormOpen(false);
      setPhysicalNewSessionDate(new Date().toISOString().split('T')[0]);
      setPhysicalNewSessionTime('00:00');
      setPhysicalNewSessionName('');
      setPhysicalCreatingSession(false);
      setPhysicalCreateSessionError('');
      setPhysicalCreateSessionSuccess('');
      setPhysicalSessionRows([]);
      setPhysicalSessionLoading(false);
      setPhysicalSessionError('');
      setPhysicalSessionClosing(false);
      setPhysicalSessionCloseMessage('');
      setPhysicalSessionManualMode(false);
      setPhysicalSessionDraftStatus({});
      setPhysicalSessionDraftMarkedAt({});
      setPhysicalSessionBatchSaving(false);
      setPhysicalSessionSavingUserIds([]);
      setPhysicalSessionEditingTimeUserIds([]);
      setPhysicalWeekPreviewRows([]);
      setPhysicalWeekPreviewLoading(false);
      setPhysicalWeekPreviewError('');
      setPhysicalWeekPreviewLoaded(false);
      setPhysicalPaymentMonths([]);
      setPhysicalPaymentRows([]);
      setPhysicalPaymentLoading(false);
      setPhysicalPaymentError('');
      setPhysicalPaymentExporting(false);
      setPhysicalPaymentExportError('');
      return;
    }

    let active = true;

    setPhysicalQuickSessionsLoading(true);
    api.get(`/attendance/class-attendance/class/${id}/sessions`, { params: { limit: 1000 } })
      .then((response) => {
        if (!active) return;

        const rows = Array.isArray(response.data)
          ? response.data
            .map((item: unknown) => normalizePhysicalQuickSessionItem(item))
            .filter((item: PhysicalQuickSession | null): item is PhysicalQuickSession => Boolean(item))
          : [];

        const uniqueRows = Array.from(new Map(rows.map((item) => [item.key, item])).values())
          .sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return b.sessionTime.localeCompare(a.sessionTime);
          });

        setPhysicalQuickSessions(uniqueRows);
        setPhysicalQuickSessionKey((prev) => (
          prev && uniqueRows.some((item) => item.key === prev)
            ? prev
            : uniqueRows[0]?.key || ''
        ));
        setPhysicalNewSessionDate(uniqueRows[0]?.date || new Date().toISOString().split('T')[0]);
      })
      .catch(() => {
        if (!active) return;
        setPhysicalQuickSessions([]);
        setPhysicalQuickSessionKey('');
      })
      .finally(() => {
        if (!active) return;
        setPhysicalQuickSessionsLoading(false);
      });

    setPhysicalWeeksLoading(true);
    setPhysicalWeeksError('');
    api.get(`/attendance/class-attendance/class/${id}/weeks`)
      .then((response) => {
        if (!active) return;

        const groups = Array.isArray(response.data)
          ? response.data
            .map((item: unknown) => normalizePhysicalWeekGroupItem(item))
            .filter((item: PhysicalReportGroup | null): item is PhysicalReportGroup => Boolean(item))
            .sort((a, b) => {
              const leftOrder = typeof a.orderNo === 'number' ? a.orderNo : Number.MAX_SAFE_INTEGER;
              const rightOrder = typeof b.orderNo === 'number' ? b.orderNo : Number.MAX_SAFE_INTEGER;
              if (leftOrder !== rightOrder) return leftOrder - rightOrder;
              return a.name.localeCompare(b.name);
            })
          : [];

        setPhysicalReportGroups(groups);
        setPhysicalSelectedWeekIds((prev) => {
          const valid = new Set(groups.map((group) => group.id));
          const retained = prev.filter((weekId) => valid.has(weekId));
          return retained.length > 0 ? retained : groups.map((group) => group.id);
        });
      })
      .catch(() => {
        if (!active) return;
        setPhysicalReportGroups([]);
        setPhysicalSelectedWeekIds([]);
        setPhysicalWeeksError('Failed to load saved week groups.');
      })
      .finally(() => {
        if (!active) return;
        setPhysicalWeeksLoading(false);
      });

    api.get(`/attendance/class-attendance/class/${id}/dates`)
      .then((response) => {
        if (!active) return;

        const rows = Array.isArray(response.data)
          ? response.data
            .map((item: unknown) => asIsoDate(item))
            .filter((item: string): item is string => Boolean(item))
          : [];

        const uniqueSorted = Array.from(new Set(rows)).sort();
        setPhysicalAvailableDates(uniqueSorted);
        setPhysicalFromDate((prev) => (prev && uniqueSorted.includes(prev) ? prev : uniqueSorted[0] || ''));
        setPhysicalToDate((prev) => (prev && uniqueSorted.includes(prev) ? prev : uniqueSorted[uniqueSorted.length - 1] || ''));
        setPhysicalPreviewLoaded(false);
        setPhysicalPreviewError('');
        setPhysicalGroupName('');
        setPhysicalGroupSelectedSlots([]);
        setPhysicalGroupError('');
        setPhysicalWeekBuilderOpen(false);
        setPhysicalMonitor(null);
        setPhysicalFocusedSlotKey('');
      })
      .catch(() => {
        if (!active) return;
        setPhysicalAvailableDates([]);
        setPhysicalFromDate('');
        setPhysicalToDate('');
        setPhysicalPreviewLoaded(false);
        setPhysicalPreviewError('Failed to load attendance dates.');
        setPhysicalGroupName('');
        setPhysicalGroupSelectedSlots([]);
        setPhysicalGroupError('');
        setPhysicalWeekBuilderOpen(false);
        setPhysicalMonitor(null);
        setPhysicalFocusedSlotKey('');
      });

    setPhysicalPaymentLoading(true);
    setPhysicalPaymentError('');
    setPhysicalPaymentExportError('');
    api.get(`/attendance/class-attendance/class/${id}/payments`)
      .then((response) => {
        if (!active) return;

        const payload = response?.data && typeof response.data === 'object'
          ? (response.data as Record<string, unknown>)
          : {};

        const monthsRaw = Array.isArray(payload.months) ? payload.months : [];
        const normalizedMonths = monthsRaw
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const row = item as Record<string, unknown>;
            const idValue = typeof row.id === 'string' ? row.id.trim() : '';
            const nameValue = typeof row.name === 'string' ? row.name.trim() : '';
            const yearValue = typeof row.year === 'number' && Number.isFinite(row.year)
              ? Math.trunc(row.year)
              : Number(row.year);
            const monthValue = typeof row.month === 'number' && Number.isFinite(row.month)
              ? Math.trunc(row.month)
              : Number(row.month);

            if (!idValue || !nameValue || !Number.isFinite(yearValue) || !Number.isFinite(monthValue)) {
              return null;
            }

            return {
              id: idValue,
              name: nameValue,
              year: yearValue,
              month: monthValue,
            };
          })
          .filter((item): item is { id: string; name: string; year: number; month: number } => Boolean(item));

        setPhysicalPaymentMonths(normalizedMonths);

        const studentsRaw = Array.isArray(payload.students) ? payload.students : [];
        const normalizedRows = studentsRaw
          .map((item): ClassPaymentStudentRow | null => {
            if (!item || typeof item !== 'object') return null;
            const row = item as Record<string, unknown>;

            const userId = typeof row.userId === 'string' ? row.userId.trim() : '';
            const fullName = typeof row.fullName === 'string' ? row.fullName.trim() : '';
            const instituteId = typeof row.instituteId === 'string' ? row.instituteId.trim() : '';

            if (!userId || !fullName) return null;

            const monthRows = Array.isArray(row.months)
              ? row.months
                .map((monthItem): ClassPaymentMonthRow | null => {
                  if (!monthItem || typeof monthItem !== 'object') return null;
                  const monthRow = monthItem as Record<string, unknown>;

                  const monthId = typeof monthRow.monthId === 'string' ? monthRow.monthId.trim() : '';
                  const monthName = typeof monthRow.monthName === 'string' ? monthRow.monthName.trim() : '';
                  if (!monthId || !monthName) return null;

                  const year = typeof monthRow.year === 'number' && Number.isFinite(monthRow.year)
                    ? Math.trunc(monthRow.year)
                    : Number(monthRow.year);
                  const month = typeof monthRow.month === 'number' && Number.isFinite(monthRow.month)
                    ? Math.trunc(monthRow.month)
                    : Number(monthRow.month);
                  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

                  const rawStatus = typeof monthRow.status === 'string' ? monthRow.status.trim().toUpperCase() : '';
                  const status: ClassPaymentStatus = rawStatus === 'PAID' || rawStatus === 'PENDING' || rawStatus === 'UNPAID'
                    ? rawStatus
                    : 'UNPAID';

                  return {
                    monthId,
                    monthName,
                    year,
                    month,
                    status,
                  };
                })
                .filter((monthItem): monthItem is ClassPaymentMonthRow => Boolean(monthItem))
              : [];

            const paidCount = typeof row.paidCount === 'number' && Number.isFinite(row.paidCount)
              ? Math.max(0, Math.trunc(row.paidCount))
              : monthRows.filter((monthItem) => monthItem.status === 'PAID').length;
            const pendingCount = typeof row.pendingCount === 'number' && Number.isFinite(row.pendingCount)
              ? Math.max(0, Math.trunc(row.pendingCount))
              : monthRows.filter((monthItem) => monthItem.status === 'PENDING').length;
            const unpaidCount = typeof row.unpaidCount === 'number' && Number.isFinite(row.unpaidCount)
              ? Math.max(0, Math.trunc(row.unpaidCount))
              : monthRows.filter((monthItem) => monthItem.status === 'UNPAID').length;

            return {
              userId,
              fullName,
              instituteId: instituteId || '-',
              barcodeId: typeof row.barcodeId === 'string' ? row.barcodeId.trim() : '',
              phone: typeof row.phone === 'string' ? row.phone.trim() : '',
              avatarUrl: typeof row.avatarUrl === 'string' && row.avatarUrl.trim() ? row.avatarUrl.trim() : null,
              paidCount,
              pendingCount,
              unpaidCount,
              months: monthRows,
            };
          })
          .filter((item): item is ClassPaymentStudentRow => Boolean(item))
          .sort((a, b) => a.fullName.localeCompare(b.fullName));

        setPhysicalPaymentRows(normalizedRows);
      })
      .catch(() => {
        if (!active) return;
        setPhysicalPaymentMonths([]);
        setPhysicalPaymentRows([]);
        setPhysicalPaymentError('Failed to load class payment status.');
      })
      .finally(() => {
        if (!active) return;
        setPhysicalPaymentLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, tab]);

  const physicalSlotsByDate = useMemo(() => {
    if (!physicalMonitor) return new Map<string, PhysicalMonitorSlot[]>();
    const map = new Map<string, PhysicalMonitorSlot[]>();

    physicalMonitor.slots.forEach((slot) => {
      const bucket = map.get(slot.date) || [];
      bucket.push(slot);
      map.set(slot.date, bucket);
    });

    return map;
  }, [physicalMonitor]);

  const physicalFocusedSlot = useMemo(() => {
    if (!physicalMonitor || !physicalFocusedSlotKey) return null;
    return physicalMonitor.slots.find((slot) => slot.key === physicalFocusedSlotKey) || null;
  }, [physicalFocusedSlotKey, physicalMonitor]);

  const physicalDisplaySlots = useMemo(() => {
    if (!physicalMonitor) return [] as PhysicalMonitorSlot[];
    if (physicalFocusedSlot) return [physicalFocusedSlot];
    return physicalMonitor.slots;
  }, [physicalFocusedSlot, physicalMonitor]);

  const togglePhysicalGroupSlot = (slotKey: string) => {
    setPhysicalGroupSelectedSlots((prev) => (
      prev.includes(slotKey)
        ? prev.filter((key) => key !== slotKey)
        : [...prev, slotKey]
    ));
  };

  const togglePhysicalGroupDate = (date: string) => {
    const slots = physicalSlotsByDate.get(date) || [];
    if (slots.length === 0) return;

    const slotKeys = slots.map((slot) => slot.key);
    setPhysicalGroupSelectedSlots((prev) => {
      const everySelected = slotKeys.every((slotKey) => prev.includes(slotKey));
      if (everySelected) {
        return prev.filter((slotKey) => !slotKeys.includes(slotKey));
      }

      const set = new Set([...prev, ...slotKeys]);
      return Array.from(set);
    });
  };

  const addPhysicalReportGroup = async () => {
    if (!id) return;

    const trimmedName = physicalGroupName.trim();
    const groupName = trimmedName || `Week ${physicalReportGroups.length + 1}`;

    setPhysicalSavingWeekGroup(true);
    setPhysicalGroupError('');

    try {
      const response = await api.post(`/attendance/class-attendance/class/${id}/weeks`, {
        name: groupName,
      });

      const createdGroup = normalizePhysicalWeekGroupItem(response.data);
      if (!createdGroup) {
        throw new Error('Invalid week group payload');
      }

      setPhysicalReportGroups((prev) => {
        const map = new Map(prev.map((group) => [group.id, group]));
        map.set(createdGroup.id, createdGroup);
        return Array.from(map.values()).sort((a, b) => {
          const leftOrder = typeof a.orderNo === 'number' ? a.orderNo : Number.MAX_SAFE_INTEGER;
          const rightOrder = typeof b.orderNo === 'number' ? b.orderNo : Number.MAX_SAFE_INTEGER;
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
          return a.name.localeCompare(b.name);
        });
      });

      setPhysicalSelectedWeekIds((prev) => (
        prev.includes(createdGroup.id)
          ? prev
          : [...prev, createdGroup.id]
      ));

      setPhysicalGroupName('');
      setPhysicalGroupSelectedSlots([]);
      setPhysicalGroupError('');
      setPhysicalWeeksError('');
    } catch (error: any) {
      const message = error?.response?.data?.message;
      if (Array.isArray(message)) {
        setPhysicalGroupError(message.join(', '));
      } else {
        setPhysicalGroupError(typeof message === 'string' ? message : 'Failed to save week group.');
      }
    } finally {
      setPhysicalSavingWeekGroup(false);
    }
  };

  const removePhysicalReportGroup = async (groupId: string) => {
    if (!id) return;

    const groupName = physicalReportGroups.find((group) => group.id === groupId)?.name || 'this week';
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Delete "${groupName}"? This will also clear week assignment from linked sessions.`,
      );
      if (!confirmed) return;
    }

    setPhysicalDeletingWeekId(groupId);
    setPhysicalGroupError('');

    try {
      await api.delete(`/attendance/class-attendance/class/${id}/weeks/${groupId}`);

      setPhysicalReportGroups((prev) => prev.filter((group) => group.id !== groupId));
      setPhysicalSelectedWeekIds((prev) => prev.filter((weekId) => weekId !== groupId));
      setPhysicalQuickSessions((prev) => prev.map((session) => (
        session.weekId === groupId
          ? { ...session, weekId: null, weekName: null }
          : session
      )));
      setPhysicalGroupSelectedSlots([]);
      setPhysicalWeeksError('');
    } catch (error: any) {
      const message = error?.response?.data?.message;
      if (Array.isArray(message)) {
        setPhysicalGroupError(message.join(', '));
      } else {
        setPhysicalGroupError(typeof message === 'string' ? message : 'Failed to delete week group.');
      }
    } finally {
      setPhysicalDeletingWeekId('');
    }
  };

  const loadPhysicalAttendancePreview = async () => {
    if (!id) return;

    const fallbackFrom = physicalAvailableDates[0] || '';
    const fallbackTo = physicalAvailableDates[physicalAvailableDates.length - 1] || '';
    const selectedFrom = physicalFromDate || fallbackFrom;
    const selectedTo = physicalToDate || fallbackTo;

    if (!selectedFrom || !selectedTo) {
      setPhysicalPreviewError('No marked attendance dates found for this class.');
      setPhysicalPreviewLoaded(false);
      setPhysicalMonitor(null);
      setPhysicalFocusedSlotKey('');
      return;
    }

    const from = selectedFrom <= selectedTo ? selectedFrom : selectedTo;
    const to = selectedFrom <= selectedTo ? selectedTo : selectedFrom;

    setPhysicalLoadingPreview(true);
    setPhysicalPreviewError('');
    setPhysicalGroupError('');

    try {
      const response = await api.get(`/attendance/class-attendance/class/${id}/monitor`, {
        params: {
          from,
          to,
        },
      });

      const rawSlots = Array.isArray(response.data?.slots) ? response.data.slots : [];
      let slots: PhysicalMonitorSlot[] = rawSlots
        .map((item: any, index: number) => {
          const date = asIsoDate(item?.date);
          const sessionTime = typeof item?.sessionTime === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(item.sessionTime)
            ? item.sessionTime
            : '00:00';
          const sessionCode = typeof item?.sessionCode === 'string' && item.sessionCode.trim() ? item.sessionCode.trim() : null;
          const slotKey = typeof item?.key === 'string' && item.key.trim()
            ? item.key.trim()
            : `${date}|${sessionTime}|${sessionCode || index}`;

          if (!date || date < from || date > to) return null;

          return {
            key: slotKey,
            date,
            sessionTime,
            sessionCode,
          } as PhysicalMonitorSlot;
        })
        .filter((item: PhysicalMonitorSlot | null): item is PhysicalMonitorSlot => Boolean(item));

      if (slots.length === 0) {
        const rawDates = Array.isArray(response.data?.dates) ? response.data.dates : [];
        slots = rawDates
          .map((value: unknown) => asIsoDate(value))
          .filter((value: string): value is string => Boolean(value))
          .filter((date: string) => date >= from && date <= to)
          .map((date: string) => ({
            key: `${date}|00:00|fallback`,
            date,
            sessionTime: '00:00',
            sessionCode: null,
          }));
      }

      slots.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.sessionTime !== b.sessionTime) return a.sessionTime.localeCompare(b.sessionTime);
        return formatPhysicalSlotLabel(a).localeCompare(formatPhysicalSlotLabel(b));
      });

      const rawStudents = Array.isArray(response.data?.students) ? response.data.students : [];
      const students: PhysicalMonitorStudent[] = rawStudents
        .map((item: any) => {
          const userId = typeof item?.userId === 'string' ? item.userId : '';
          if (!userId) return null;

          const rawStatuses = item?.statuses && typeof item.statuses === 'object'
            ? item.statuses as Record<string, unknown>
            : {};

          const statuses: Record<string, PhysicalCellStatus> = {};
          Object.entries(rawStatuses).forEach(([slotKey, rawStatus]) => {
            if (typeof slotKey !== 'string' || !slotKey.trim()) return;
            if (rawStatus === 'PRESENT' || rawStatus === 'ABSENT' || rawStatus === 'LATE' || rawStatus === 'EXCUSED') {
              statuses[slotKey.trim()] = rawStatus;
            }
          });

          return {
            userId,
            fullName: typeof item?.fullName === 'string' && item.fullName.trim() ? item.fullName.trim() : userId,
            instituteId: typeof item?.instituteId === 'string' ? item.instituteId : '',
            email: typeof item?.email === 'string' ? item.email : '',
            phone: typeof item?.phone === 'string' ? item.phone : '',
            barcodeId: typeof item?.barcodeId === 'string' ? item.barcodeId : '',
            avatarUrl: typeof item?.avatarUrl === 'string' && item.avatarUrl.trim() ? item.avatarUrl : null,
            statuses,
          };
        })
        .filter((item: PhysicalMonitorStudent | null): item is PhysicalMonitorStudent => Boolean(item));

      const slotKeySet = new Set(slots.map((slot) => slot.key));
      setPhysicalGroupSelectedSlots((prev) => prev.filter((slotKey) => slotKeySet.has(slotKey)));
      setPhysicalReportGroups((prev) => prev
        .map((group) => ({
          ...group,
          slotKeys: group.slotKeys.filter((slotKey) => slotKeySet.has(slotKey)),
        }))
        .filter((group) => group.slotKeys.length > 0));
      setPhysicalFocusedSlotKey((prev) => (prev && slotKeySet.has(prev) ? prev : ''));

      setPhysicalMonitor({ slots, students });
      setPhysicalPreviewLoaded(true);
      if (slots.length === 0) {
        setPhysicalPreviewError('No attendance sessions found in this date range.');
      }
    } catch {
      setPhysicalPreviewLoaded(false);
      setPhysicalMonitor(null);
      setPhysicalPreviewError('Failed to load physical attendance preview.');
      setPhysicalFocusedSlotKey('');
    } finally {
      setPhysicalLoadingPreview(false);
    }
  };

  const physicalFilteredStudents = useMemo(() => {
    if (!physicalMonitor) return [];

    const query = physicalSearchText.trim().toLowerCase();
    const rows = physicalMonitor.students.filter((student) => {
      if (!query) return true;
      return [student.fullName, student.instituteId, student.email, student.phone, student.barcodeId]
        .some((value) => value.toLowerCase().includes(query));
    });

    return rows.map((student) => {
      const groupMetrics = physicalReportGroups.reduce((acc, group) => {
        const total = group.slotKeys.length;
        let attended = 0;

        group.slotKeys.forEach((slotKey) => {
          const status = (student.statuses?.[slotKey] as PhysicalCellStatus | undefined) || 'NOT_MARKED';
          if (status === 'PRESENT' || status === 'LATE') attended += 1;
        });

        acc[group.id] = {
          attended,
          total,
          percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
        };

        return acc;
      }, {} as Record<string, { attended: number; total: number; percentage: number }>);

      return {
        ...student,
        ...summarizePhysicalStatuses(student.statuses, physicalDisplaySlots),
        groupMetrics,
      };
    });
  }, [physicalDisplaySlots, physicalMonitor, physicalReportGroups, physicalSearchText]);

  const physicalSummary = useMemo(() => {
    const summary = {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      totalCells: 0,
      avgAttendance: 0,
    };

    if (!physicalMonitor || physicalFilteredStudents.length === 0) return summary;

    physicalFilteredStudents.forEach((student: any) => {
      summary.present += student.present || 0;
      summary.late += student.late || 0;
      summary.absent += student.absent || 0;
      summary.excused += student.excused || 0;
    });

    summary.totalCells = physicalFilteredStudents.length * physicalDisplaySlots.length;
    const attended = summary.present + summary.late;
    summary.avgAttendance = summary.totalCells > 0
      ? Math.round((attended / summary.totalCells) * 100)
      : 0;

    return summary;
  }, [physicalDisplaySlots.length, physicalFilteredStudents, physicalMonitor]);

  const physicalQuickSelectedSession = useMemo(
    () => physicalQuickSessions.find((session) => session.key === physicalQuickSessionKey) || null,
    [physicalQuickSessionKey, physicalQuickSessions],
  );
  const selectedPhysicalSessionKey = physicalQuickSelectedSession?.key || '';
  const selectedPhysicalSessionDate = physicalQuickSelectedSession?.date || '';
  const selectedPhysicalSessionTime = physicalQuickSelectedSession?.sessionTime || '00:00';

  const selectedPhysicalSessionDefaultMarkedAtInput = useMemo(() => {
    if (physicalQuickSelectedSession?.sessionAt) {
      return toLocalDateTimeInputValue(physicalQuickSelectedSession.sessionAt);
    }
    if (selectedPhysicalSessionDate && selectedPhysicalSessionTime && selectedPhysicalSessionTime !== '00:00') {
      return `${selectedPhysicalSessionDate}T${selectedPhysicalSessionTime}`;
    }
    return '';
  }, [physicalQuickSelectedSession, selectedPhysicalSessionDate, selectedPhysicalSessionTime]);

  const physicalQuickSessionByKey = useMemo(
    () => new Map(physicalQuickSessions.map((session) => [session.key, session] as const)),
    [physicalQuickSessions],
  );

  const physicalSelectedWeekIdSet = useMemo(
    () => new Set(physicalSelectedWeekIds),
    [physicalSelectedWeekIds],
  );

  const physicalWeekGroups = useMemo(() => (
    physicalReportGroups
      .filter((group) => physicalSelectedWeekIdSet.has(group.id))
      .map((group) => ({
        ...group,
        sessions: group.slotKeys
          .map((slotKey) => physicalQuickSessionByKey.get(slotKey))
          .filter((session): session is PhysicalQuickSession => Boolean(session)),
      }))
      .filter((group) => group.sessions.length > 0)
  ), [physicalQuickSessionByKey, physicalReportGroups, physicalSelectedWeekIdSet]);

  const physicalWeekOrderedSessions = useMemo(
    () => physicalWeekGroups.flatMap((group) => group.sessions),
    [physicalWeekGroups],
  );

  const physicalAssignedWeekBySessionKey = useMemo(() => {
    const map = new Map<string, string>();
    physicalReportGroups.forEach((group) => {
      group.slotKeys.forEach((slotKey) => {
        if (!map.has(slotKey)) {
          map.set(slotKey, group.name);
        }
      });
    });
    return map;
  }, [physicalReportGroups]);

  const togglePhysicalReportWeekSelection = (groupId: string) => {
    setPhysicalSelectedWeekIds((prev) => (
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    ));
  };

  const removePhysicalReportWeekSelection = (groupId: string) => {
    setPhysicalSelectedWeekIds((prev) => prev.filter((id) => id !== groupId));
  };

  const selectAllPhysicalReportWeeks = () => {
    setPhysicalSelectedWeekIds(physicalReportGroups.map((group) => group.id));
  };

  const clearPhysicalReportWeekSelection = () => {
    setPhysicalSelectedWeekIds([]);
  };

  const buildPhysicalSessionQuery = (session: PhysicalQuickSession | null) => {
    const params = new URLSearchParams();
    params.set('classId', id || '');

    if (session) {
      params.set('date', session.date);
      params.set('sessionTime', session.sessionTime);
      if (session.sessionCode) {
        params.set('sessionCode', session.sessionCode);
      }
    }

    return params.toString();
  };

  const physicalAttendanceSelectionQuery = buildPhysicalSessionQuery(physicalQuickSelectedSession);

  const markAttendanceScannerPath = getInstituteAdminPath(instituteId, `/mark-attendance?${physicalAttendanceSelectionQuery}`);

  const markAttendanceExternalPath = getInstituteAdminPath(instituteId, `/mark-attendance/external-device?${physicalAttendanceSelectionQuery}`);

  const handleSelectPhysicalQuickSession = (session: PhysicalQuickSession) => {
    setPhysicalQuickSessionKey(session.key);
    setPhysicalFromDate(session.date);
    setPhysicalToDate(session.date);
    setPhysicalFocusedSlotKey(session.key);
    setPhysicalSessionError('');
    setPhysicalSessionCloseMessage('');
  };

  const focusPhysicalSessionPreview = () => {
    if (typeof window === 'undefined') return;
    const panel = document.getElementById('physical-selected-session-preview');
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePreviewPhysicalSession = (session: PhysicalQuickSession) => {
    handleSelectPhysicalQuickSession(session);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        focusPhysicalSessionPreview();
      });
    }
  };

  const getMarkAttendancePathForSession = (session: PhysicalQuickSession) => (
    getInstituteAdminPath(instituteId, `/mark-attendance?${buildPhysicalSessionQuery(session)}`)
  );

  const handleCreatePhysicalSession = async () => {
    if (!id) return;

    const date = asIsoDate(physicalNewSessionDate);
    if (!date) {
      setPhysicalCreateSessionError('Select a valid session date.');
      return;
    }

    const normalizedSessionTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(physicalNewSessionTime)
      ? physicalNewSessionTime
      : '00:00';

    setPhysicalCreatingSession(true);
    setPhysicalCreateSessionError('');
    setPhysicalCreateSessionSuccess('');

    try {
      const response = await api.post(`/attendance/class-attendance/class/${id}/sessions`, {
        date,
        sessionTime: normalizedSessionTime,
        sessionCode: physicalNewSessionName.trim() || undefined,
      });

      const createdSession = normalizePhysicalQuickSessionItem(response.data);
      if (!createdSession) {
        throw new Error('Invalid session payload');
      }

      setPhysicalQuickSessions((prev) => {
        const map = new Map(prev.map((item) => [item.key, item]));
        map.set(createdSession.key, createdSession);
        return Array.from(map.values()).sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return b.sessionTime.localeCompare(a.sessionTime);
        });
      });
      setPhysicalQuickSessionKey(createdSession.key);
      setPhysicalFromDate(createdSession.date);
      setPhysicalToDate(createdSession.date);
      setPhysicalFocusedSlotKey(createdSession.key);
      setPhysicalAvailableDates((prev) => Array.from(new Set([...prev, createdSession.date])).sort());
      setPhysicalSessionFormOpen(false);
      setPhysicalNewSessionName('');
      setPhysicalNewSessionTime(createdSession.sessionTime || '00:00');
      setPhysicalSessionCloseMessage('');
      setPhysicalCreateSessionSuccess(`Session created: ${formatPhysicalSlotLabel(createdSession)}`);
    } catch (error: any) {
      const message = error?.response?.data?.message;
      if (Array.isArray(message)) {
        setPhysicalCreateSessionError(message.join(', '));
      } else {
        setPhysicalCreateSessionError(typeof message === 'string' ? message : 'Failed to create session.');
      }
    } finally {
      setPhysicalCreatingSession(false);
    }
  };

  const handleAssignPhysicalSessionWeek = async (session: PhysicalQuickSession, nextWeekIdRaw: string) => {
    if (!id) return;

    const nextWeekId = nextWeekIdRaw.trim();
    const currentWeekId = (session.weekId || '').trim();

    if (nextWeekId === currentWeekId) return;

    setPhysicalAssigningWeekSessionKey(session.key);
    setPhysicalGroupError('');
    setPhysicalWeeksError('');

    try {
      const payload: { sessionKey: string; weekId?: string } = {
        sessionKey: session.key,
      };
      if (nextWeekId) {
        payload.weekId = nextWeekId;
      }

      const response = await api.patch(`/attendance/class-attendance/class/${id}/sessions/week`, payload);
      const updatedSession = normalizePhysicalQuickSessionItem(response.data);

      if (!updatedSession) {
        throw new Error('Invalid session payload');
      }

      setPhysicalQuickSessions((prev) => prev.map((item) => (
        item.key === session.key
          ? { ...item, ...updatedSession }
          : item
      )));

      setPhysicalReportGroups((prev) => {
        const nextGroups = prev.map((group) => ({
          ...group,
          slotKeys: group.slotKeys.filter((slotKey) => slotKey !== session.key),
        }));

        if (!updatedSession.weekId) {
          return nextGroups;
        }

        return nextGroups.map((group) => (
          group.id === updatedSession.weekId
            ? {
              ...group,
              slotKeys: group.slotKeys.includes(session.key)
                ? group.slotKeys
                : [...group.slotKeys, session.key],
            }
            : group
        ));
      });
    } catch (error: any) {
      const message = error?.response?.data?.message;
      if (Array.isArray(message)) {
        setPhysicalGroupError(message.join(', '));
      } else {
        setPhysicalGroupError(typeof message === 'string' ? message : 'Failed to assign week to session.');
      }
    } finally {
      setPhysicalAssigningWeekSessionKey('');
    }
  };

  const loadSelectedPhysicalSessionAttendance = useCallback(async () => {
    if (!id || !selectedPhysicalSessionKey || !selectedPhysicalSessionDate) {
      setPhysicalSessionRows([]);
      setPhysicalSessionError('');
      setPhysicalSessionManualMode(false);
      setPhysicalSessionDraftStatus({});
      setPhysicalSessionDraftMarkedAt({});
      setPhysicalSessionBatchSaving(false);
      setPhysicalSessionSavingUserIds([]);
      setPhysicalSessionEditingTimeUserIds([]);
      return;
    }

    setPhysicalSessionLoading(true);
    setPhysicalSessionError('');

    try {
      const [studentsResponse, attendanceResponse] = await Promise.all([
        api.get(`/attendance/class-attendance/class/${id}/students`),
        api.get(`/attendance/class-attendance/class/${id}/date/${selectedPhysicalSessionDate}`, {
          params: {
            sessionTime: selectedPhysicalSessionTime,
          },
        }),
      ]);

      const studentPayload = studentsResponse.data;
      const studentItems = Array.isArray(studentPayload)
        ? studentPayload
        : Array.isArray(studentPayload?.students)
          ? studentPayload.students
          : [];

      const attendanceByUserId = new Map<string, {
        id: string;
        status: PhysicalCellStatus;
        sessionAt: string | null;
        createdAt: string | null;
        updatedAt: string | null;
      }>();
      const attendanceItems = Array.isArray(attendanceResponse.data) ? attendanceResponse.data : [];

      attendanceItems.forEach((item: any) => {
        const userId = typeof item?.userId === 'string' ? item.userId : '';
        const status = item?.status;

        if (!userId) return;
        if (status === 'PRESENT' || status === 'LATE' || status === 'ABSENT' || status === 'EXCUSED') {
          attendanceByUserId.set(userId, {
            id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : '',
            status,
            sessionAt: typeof item?.sessionAt === 'string' && item.sessionAt.trim() ? item.sessionAt.trim() : null,
            createdAt: typeof item?.createdAt === 'string' && item.createdAt.trim() ? item.createdAt.trim() : null,
            updatedAt: typeof item?.updatedAt === 'string' && item.updatedAt.trim() ? item.updatedAt.trim() : null,
          });
        }
      });

      const rows: PhysicalSessionStudentRow[] = studentItems
        .map((item: any): PhysicalSessionStudentRow | null => {
          const userId = typeof item?.userId === 'string' ? item.userId : '';
          if (!userId) return null;

          const fullNameRaw = typeof item?.fullName === 'string' ? item.fullName : '';
          const fullName = fullNameRaw.trim();
          const instituteIdRaw = typeof item?.instituteId === 'string' ? item.instituteId : '';
          const instituteId = instituteIdRaw.trim();
          const phone = typeof item?.phone === 'string' ? item.phone : '';
          const barcodeId = typeof item?.barcodeId === 'string' ? item.barcodeId : '';
          const avatarUrl = typeof item?.avatarUrl === 'string' && item.avatarUrl.trim() ? item.avatarUrl : null;
          const attendanceMeta = attendanceByUserId.get(userId);
          const status = attendanceMeta?.status || 'NOT_MARKED';
          const markedAt = attendanceMeta?.sessionAt || attendanceMeta?.updatedAt || attendanceMeta?.createdAt || null;

          return {
            userId,
            fullName: fullName || 'Unknown Student',
            instituteId: instituteId || '-',
            phone,
            barcodeId,
            avatarUrl,
            status,
            attendanceId: attendanceMeta?.id || null,
            markedAt,
          };
        })
        .filter((row: PhysicalSessionStudentRow | null): row is PhysicalSessionStudentRow => Boolean(row))
        .sort((a: PhysicalSessionStudentRow, b: PhysicalSessionStudentRow) => a.fullName.localeCompare(b.fullName));

      setPhysicalSessionRows(rows);
      setPhysicalSessionDraftStatus(() => rows.reduce((acc: Record<string, PhysicalEditableCellStatus>, row: PhysicalSessionStudentRow) => {
        acc[row.userId] = isPhysicalEditableStatus(row.status) ? row.status : 'NOT_MARKED';
        return acc;
      }, {} as Record<string, PhysicalEditableCellStatus>));
      setPhysicalSessionDraftMarkedAt(() => rows.reduce((acc: Record<string, string>, row: PhysicalSessionStudentRow) => {
        acc[row.userId] = row.markedAt
          ? toLocalDateTimeInputValue(row.markedAt)
          : selectedPhysicalSessionDefaultMarkedAtInput;
        return acc;
      }, {} as Record<string, string>));
      setPhysicalSessionBatchSaving(false);
      setPhysicalSessionSavingUserIds([]);
      setPhysicalSessionEditingTimeUserIds([]);
      setPhysicalQuickSessions((prev) => {
        let changed = false;
        const next = prev.map((session) => {
          if (session.key !== selectedPhysicalSessionKey) return session;
          if (session.recordsCount === attendanceItems.length) return session;
          changed = true;
          return { ...session, recordsCount: attendanceItems.length };
        });

        return changed ? next : prev;
      });
    } catch (error: any) {
      const message = error?.response?.data?.message;
      if (Array.isArray(message)) {
        setPhysicalSessionError(message.join(', '));
      } else {
        setPhysicalSessionError(typeof message === 'string' ? message : 'Failed to load selected session attendance.');
      }
      setPhysicalSessionRows([]);
    } finally {
      setPhysicalSessionLoading(false);
    }
  }, [id, selectedPhysicalSessionDate, selectedPhysicalSessionDefaultMarkedAtInput, selectedPhysicalSessionKey, selectedPhysicalSessionTime]);

  useEffect(() => {
    if (tab !== 'attendance' || !id || !selectedPhysicalSessionKey) {
      setPhysicalSessionRows([]);
      setPhysicalSessionError('');
      setPhysicalSessionCloseMessage('');
      setPhysicalSessionLoading(false);
      setPhysicalSessionClosing(false);
      setPhysicalSessionManualMode(false);
      setPhysicalSessionDraftStatus({});
      setPhysicalSessionDraftMarkedAt({});
      setPhysicalSessionBatchSaving(false);
      setPhysicalSessionSavingUserIds([]);
      setPhysicalSessionEditingTimeUserIds([]);
      return;
    }

    void loadSelectedPhysicalSessionAttendance();
  }, [id, loadSelectedPhysicalSessionAttendance, selectedPhysicalSessionKey, tab]);

  const getPhysicalSessionOriginalMarkedAtInput = useCallback((student: PhysicalSessionStudentRow) => (
    student.markedAt ? toLocalDateTimeInputValue(student.markedAt) : ''
  ), []);

  const physicalSessionPendingRows = useMemo(() => (
    physicalSessionRows.filter((student) => {
      const draftStatus = physicalSessionDraftStatus[student.userId] || 'NOT_MARKED';
      const originalStatus = student.status;
      const draftMarkedAt = (physicalSessionDraftMarkedAt[student.userId] || '').trim();
      const originalMarkedAt = getPhysicalSessionOriginalMarkedAtInput(student);

      if (draftStatus !== originalStatus) return true;
      if (draftStatus === 'NOT_MARKED') return false;
      return draftMarkedAt !== originalMarkedAt;
    })
  ), [getPhysicalSessionOriginalMarkedAtInput, physicalSessionDraftMarkedAt, physicalSessionDraftStatus, physicalSessionRows]);

  const physicalSessionPendingUserIdSet = useMemo(
    () => new Set(physicalSessionPendingRows.map((student) => student.userId)),
    [physicalSessionPendingRows],
  );

  const applyPhysicalSessionStudentDraftStatus = (
    student: PhysicalSessionStudentRow,
    nextStatus: PhysicalEditableCellStatus,
  ) => {
    if (!isPhysicalEditableStatus(nextStatus)) return;

    const previousStatus = physicalSessionDraftStatus[student.userId] || 'NOT_MARKED';

    setPhysicalSessionDraftStatus((prev) => ({
      ...prev,
      [student.userId]: nextStatus,
    }));

    if (nextStatus === 'NOT_MARKED') {
      setPhysicalSessionDraftMarkedAt((prev) => ({
        ...prev,
        [student.userId]: '',
      }));
      setPhysicalSessionEditingTimeUserIds((prev) => prev.filter((userId) => userId !== student.userId));
      return;
    }

    if (nextStatus !== previousStatus) {
      const nowInput = toLocalDateTimeInputValue(new Date().toISOString());
      setPhysicalSessionDraftMarkedAt((prev) => ({
        ...prev,
        [student.userId]: nowInput,
      }));
    }
  };

  const handleBatchSavePhysicalSessionAttendance = async () => {
    if (!id || !physicalQuickSelectedSession || !selectedPhysicalSessionDate) return;
    if (physicalSessionPendingRows.length === 0) {
      setPhysicalSessionCloseMessage('No attendance changes to save.');
      return;
    }

    const pendingUserIds = physicalSessionPendingRows.map((student) => student.userId);
    setPhysicalSessionBatchSaving(true);
    setPhysicalSessionSavingUserIds(pendingUserIds);
    setPhysicalSessionError('');
    setPhysicalSessionCloseMessage('');

    const failedRows: Array<{ name: string; message: string }> = [];

    await Promise.all(physicalSessionPendingRows.map(async (student) => {
      const draftStatus = physicalSessionDraftStatus[student.userId] || 'NOT_MARKED';
      if (!isPhysicalEditableStatus(draftStatus)) {
        failedRows.push({ name: student.fullName, message: 'Invalid status selected.' });
        return;
      }

      const draftMarkedAtInput = (physicalSessionDraftMarkedAt[student.userId] || '').trim();
      let draftMarkedAtIso = draftMarkedAtInput ? toIsoDateTimeFromInput(draftMarkedAtInput) : null;

      if (draftMarkedAtInput && !draftMarkedAtIso) {
        failedRows.push({ name: student.fullName, message: 'Invalid attendance time.' });
        return;
      }

      if (draftStatus === 'NOT_MARKED') {
        if (!student.attendanceId) return;

        try {
          await api.delete(`/attendance/class-attendance/${student.attendanceId}`);
        } catch (error: any) {
          const message = error?.response?.data?.message;
          failedRows.push({
            name: student.fullName,
            message: Array.isArray(message)
              ? message.join(', ')
              : (typeof message === 'string' ? message : 'Failed to clear attendance.'),
          });
        }
        return;
      }

      if (!draftMarkedAtIso) {
        draftMarkedAtIso = new Date().toISOString();
        setPhysicalSessionDraftMarkedAt((prev) => ({
          ...prev,
          [student.userId]: toLocalDateTimeInputValue(draftMarkedAtIso),
        }));
      }

      try {
        await api.post('/attendance/class-attendance/mark', {
          classId: id,
          identifier: student.userId,
          date: selectedPhysicalSessionDate,
          sessionTime: selectedPhysicalSessionTime,
          sessionCode: physicalQuickSelectedSession.sessionCode || undefined,
          sessionAt: draftMarkedAtIso || undefined,
          status: draftStatus,
          method: 'manual',
        });
      } catch (error: any) {
        const message = error?.response?.data?.message;
        failedRows.push({
          name: student.fullName,
          message: Array.isArray(message)
            ? message.join(', ')
            : (typeof message === 'string' ? message : 'Failed to save attendance.'),
        });
      }
    }));

    await loadSelectedPhysicalSessionAttendance();

    if (failedRows.length === 0) {
      setPhysicalSessionCloseMessage(`Attendance saved for ${physicalSessionPendingRows.length} student${physicalSessionPendingRows.length === 1 ? '' : 's'}.`);
    } else {
      const successful = physicalSessionPendingRows.length - failedRows.length;
      const failedNames = failedRows.slice(0, 3).map((row) => row.name).join(', ');
      setPhysicalSessionError(
        `Saved ${successful}/${physicalSessionPendingRows.length}. Failed: ${failedRows.length}${failedNames ? ` (${failedNames}${failedRows.length > 3 ? ', ...' : ''})` : ''}.`,
      );
    }

    setPhysicalSessionEditingTimeUserIds((prev) => prev.filter((userId) => !pendingUserIds.includes(userId)));
    setPhysicalSessionSavingUserIds([]);
    setPhysicalSessionBatchSaving(false);
  };

  const loadPhysicalWeekPreview = useCallback(async () => {
    if (!id) return;

    if (physicalWeekOrderedSessions.length === 0) {
      setPhysicalWeekPreviewRows([]);
      setPhysicalWeekPreviewLoaded(false);
      setPhysicalWeekPreviewError('Select at least one saved week before loading preview.');
      return;
    }

    setPhysicalWeekPreviewLoading(true);
    setPhysicalWeekPreviewError('');

    try {
      const attendanceRequests = physicalWeekOrderedSessions.map((session) => (
        api.get(`/attendance/class-attendance/class/${id}/date/${session.date}`, {
          params: {
            sessionTime: session.sessionTime,
          },
        })
      ));

      const [studentsResponse, ...attendanceResponses] = await Promise.all([
        api.get(`/attendance/class-attendance/class/${id}/students`),
        ...attendanceRequests,
      ]);

      const studentPayload = studentsResponse.data;
      const studentItems = Array.isArray(studentPayload)
        ? studentPayload
        : Array.isArray(studentPayload?.students)
          ? studentPayload.students
          : [];

      const sessionStatusByUserId = new Map<string, Map<string, PhysicalCellStatus>>();
      const sessionCountByKey = new Map<string, number>();

      physicalWeekOrderedSessions.forEach((session, index) => {
        const attendanceItems = Array.isArray(attendanceResponses[index]?.data)
          ? attendanceResponses[index].data
          : [];

        const statusByUser = new Map<string, PhysicalCellStatus>();
        attendanceItems.forEach((item: any) => {
          const userId = typeof item?.userId === 'string' ? item.userId : '';
          const status = item?.status;
          if (!userId) return;
          if (status === 'PRESENT' || status === 'LATE' || status === 'ABSENT' || status === 'EXCUSED') {
            statusByUser.set(userId, status);
          }
        });

        sessionStatusByUserId.set(session.key, statusByUser);
        sessionCountByKey.set(session.key, attendanceItems.length);
      });

      const rows = studentItems
        .map((item: any): PhysicalWeekPreviewStudentRow | null => {
          const userId = typeof item?.userId === 'string' ? item.userId : '';
          if (!userId) return null;

          const fullNameRaw = typeof item?.fullName === 'string' ? item.fullName : '';
          const fullName = fullNameRaw.trim();
          const instituteIdRaw = typeof item?.instituteId === 'string' ? item.instituteId : '';
          const instituteId = instituteIdRaw.trim();
          const phone = typeof item?.phone === 'string' ? item.phone : '';
          const barcodeId = typeof item?.barcodeId === 'string' ? item.barcodeId : '';
          const avatarUrl = typeof item?.avatarUrl === 'string' && item.avatarUrl.trim() ? item.avatarUrl : null;

          const statuses = physicalWeekOrderedSessions.reduce((acc, session) => {
            const status = sessionStatusByUserId.get(session.key)?.get(userId) || 'NOT_MARKED';
            acc[session.key] = status;
            return acc;
          }, {} as Record<string, PhysicalCellStatus>);

          return {
            userId,
            fullName: fullName || 'Unknown Student',
            instituteId: instituteId || '-',
            phone,
            barcodeId,
            avatarUrl,
            statuses,
          };
        })
        .filter((row: PhysicalWeekPreviewStudentRow | null): row is PhysicalWeekPreviewStudentRow => Boolean(row))
        .sort((a: PhysicalWeekPreviewStudentRow, b: PhysicalWeekPreviewStudentRow) => a.fullName.localeCompare(b.fullName));

      setPhysicalWeekPreviewRows(rows);
      setPhysicalWeekPreviewLoaded(true);

      setPhysicalQuickSessions((prev) => {
        let changed = false;
        const next = prev.map((session) => {
          const count = sessionCountByKey.get(session.key);
          if (typeof count !== 'number' || count === session.recordsCount) {
            return session;
          }
          changed = true;
          return { ...session, recordsCount: count };
        });
        return changed ? next : prev;
      });
    } catch (error: any) {
      const message = error?.response?.data?.message;
      if (Array.isArray(message)) {
        setPhysicalWeekPreviewError(message.join(', '));
      } else {
        setPhysicalWeekPreviewError(typeof message === 'string' ? message : 'Failed to load week-wise attendance preview.');
      }
      setPhysicalWeekPreviewRows([]);
      setPhysicalWeekPreviewLoaded(false);
    } finally {
      setPhysicalWeekPreviewLoading(false);
    }
  }, [id, physicalWeekOrderedSessions]);

  const exportPhysicalWeekPreviewXlsx = async () => {
    if (physicalWeekOrderedSessions.length === 0 || physicalVisibleWeekPreviewRows.length === 0) {
      setPhysicalWeekPreviewError('Load week preview with at least one student before exporting XLSX.');
      return;
    }

    try {
      const ExcelJSImport = await import('exceljs');
      const workbook = new ExcelJSImport.Workbook();
      workbook.creator = 'Thilina Dhananjaya';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Week Attendance');

      const headerFill = 'FFE2E8F0';
      const headerText = 'FF1E293B';
      const statusXlsxStyle: Record<PhysicalCellStatus, { fill: string; text: string }> = {
        PRESENT: { fill: 'FFD1FAE5', text: 'FF047857' },
        LATE: { fill: 'FFFEF3C7', text: 'FFB45309' },
        ABSENT: { fill: 'FFFEE2E2', text: 'FFB91C1C' },
        EXCUSED: { fill: 'FFDBEAFE', text: 'FF1D4ED8' },
        NOT_MARKED: { fill: 'FFE2E8F0', text: 'FF475569' },
      };

      const border = {
        top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
      };

      const fixedHeaders = ['Student Name', 'Institute ID', 'Phone', 'Barcode ID'];
      fixedHeaders.forEach((header, index) => {
        const column = index + 1;
        worksheet.getCell(1, column).value = header;
        worksheet.mergeCells(1, column, 2, column);

        const topCell = worksheet.getCell(1, column);
        topCell.font = { bold: true, color: { argb: headerText } };
        topCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } };
        topCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        topCell.border = border;

        const mergedCell = worksheet.getCell(2, column);
        mergedCell.border = border;
      });

      let columnCursor = fixedHeaders.length + 1;
      physicalWeekGroups.forEach((group) => {
        const startColumn = columnCursor;

        group.sessions.forEach((session) => {
          const sessionLabel = session.sessionCode
            ? `${session.date} ${session.sessionTime} · ${session.sessionCode}`
            : `${session.date}${session.sessionTime !== '00:00' ? ` ${session.sessionTime}` : ''}`;

          const sessionCell = worksheet.getCell(2, columnCursor);
          sessionCell.value = sessionLabel;
          sessionCell.font = { bold: true, color: { argb: headerText } };
          sessionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } };
          sessionCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          sessionCell.border = border;

          columnCursor += 1;
        });

        const endColumn = columnCursor - 1;
        const weekHeaderCell = worksheet.getCell(1, startColumn);
        weekHeaderCell.value = group.name;
        weekHeaderCell.font = { bold: true, color: { argb: headerText } };
        weekHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
        weekHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } };

        if (endColumn > startColumn) {
          worksheet.mergeCells(1, startColumn, 1, endColumn);
        }

        for (let column = startColumn; column <= endColumn; column += 1) {
          worksheet.getCell(1, column).border = border;
        }
      });

      physicalVisibleWeekPreviewRows.forEach((student) => {
        const rowValues: Array<string> = [
          student.fullName,
          student.instituteId,
          student.phone,
          student.barcodeId,
          ...physicalWeekOrderedSessions.map((session) => {
            const status = student.statuses?.[session.key] || 'NOT_MARKED';
            return PHYSICAL_STATUS_LABEL[status];
          }),
        ];

        const row = worksheet.addRow(rowValues);
        row.height = 20;

        row.eachCell((cell) => {
          cell.border = border;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };

        physicalWeekOrderedSessions.forEach((session, index) => {
          const status = student.statuses?.[session.key] || 'NOT_MARKED';
          const style = statusXlsxStyle[status];
          const cell = row.getCell(index + 5);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: style.fill },
          };
          cell.font = { bold: true, color: { argb: style.text } };
        });
      });

      const legendStartRow = physicalVisibleWeekPreviewRows.length + 4;
      worksheet.getCell(`A${legendStartRow}`).value = 'Status Legend';
      worksheet.getCell(`A${legendStartRow}`).font = { bold: true, color: { argb: headerText } };

      (Object.keys(PHYSICAL_STATUS_LABEL) as PhysicalCellStatus[]).forEach((status, index) => {
        const rowNumber = legendStartRow + index + 1;
        const labelCell = worksheet.getCell(`A${rowNumber}`);
        const styleCell = worksheet.getCell(`B${rowNumber}`);
        const style = statusXlsxStyle[status];

        labelCell.value = PHYSICAL_STATUS_LABEL[status];
        labelCell.border = border;

        styleCell.value = status;
        styleCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: style.fill },
        };
        styleCell.font = { bold: true, color: { argb: style.text } };
        styleCell.border = border;
      });

      worksheet.getRow(1).height = 22;
      worksheet.getRow(2).height = 32;
      worksheet.views = [{ state: 'frozen', xSplit: 4, ySplit: 2 }];

      worksheet.getColumn(1).width = 28;
      worksheet.getColumn(2).width = 16;
      worksheet.getColumn(3).width = 16;
      worksheet.getColumn(4).width = 18;
      for (let col = 5; col < 5 + physicalWeekOrderedSessions.length; col += 1) {
        worksheet.getColumn(col).width = 18;
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const classSlug = (cls?.name || 'class')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const weekSlug = `weeks-${physicalWeekGroups.length}`;
      const stamp = new Date().toISOString().slice(0, 10);

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `physical-attendance-${classSlug || 'class'}-${weekSlug}-${stamp}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      setPhysicalWeekPreviewError('');
    } catch {
      setPhysicalWeekPreviewError('Failed to export week-wise XLSX file. Please try again.');
    }
  };

  useEffect(() => {
    setPhysicalWeekPreviewRows([]);
    setPhysicalWeekPreviewError('');
    setPhysicalWeekPreviewLoaded(false);
  }, [physicalWeekGroups]);

  const physicalVisibleSessionRows = useMemo(() => {
    const query = physicalSearchText.trim().toLowerCase();
    if (!query) return physicalSessionRows;

    return physicalSessionRows.filter((student) => (
      [student.fullName, student.instituteId, student.phone, student.barcodeId]
        .some((value) => value.toLowerCase().includes(query))
    ));
  }, [physicalSearchText, physicalSessionRows]);

  const physicalVisibleWeekPreviewRows = useMemo(() => {
    const query = physicalSearchText.trim().toLowerCase();
    if (!query) return physicalWeekPreviewRows;

    return physicalWeekPreviewRows.filter((student) => (
      [student.fullName, student.instituteId, student.phone, student.barcodeId]
        .some((value) => value.toLowerCase().includes(query))
    ));
  }, [physicalSearchText, physicalWeekPreviewRows]);

  const physicalVisiblePaymentRows = useMemo(() => {
    const query = physicalPaymentSearchText.trim().toLowerCase();

    return physicalPaymentRows.filter((student) => {
      const overallStatus = resolveClassPaymentOverallStatus(student);
      if (physicalPaymentStatusFilter !== 'ALL' && overallStatus !== physicalPaymentStatusFilter) {
        return false;
      }

      if (!query) return true;
      return [student.fullName, student.instituteId, student.phone, student.barcodeId]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [physicalPaymentRows, physicalPaymentSearchText, physicalPaymentStatusFilter]);

  const physicalPaymentSummary = useMemo(() => {
    const summary = {
      total: physicalVisiblePaymentRows.length,
      paid: 0,
      pending: 0,
      unpaid: 0,
    };

    physicalVisiblePaymentRows.forEach((student) => {
      const status = resolveClassPaymentOverallStatus(student);
      if (status === 'PAID') summary.paid += 1;
      else if (status === 'PENDING') summary.pending += 1;
      else summary.unpaid += 1;
    });

    return summary;
  }, [physicalVisiblePaymentRows]);

  const physicalPaymentMonthsForMatrix = useMemo(() => (
    [...physicalPaymentMonths].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    })
  ), [physicalPaymentMonths]);

  const exportPhysicalPaymentsXlsx = async () => {
    if (physicalVisiblePaymentRows.length === 0) {
      setPhysicalPaymentExportError('No payment rows to export for the current filter.');
      return;
    }

    setPhysicalPaymentExporting(true);
    setPhysicalPaymentExportError('');

    try {
      const ExcelJSImport = await import('exceljs');
      const workbook = new ExcelJSImport.Workbook();
      workbook.creator = 'Thilina Dhananjaya';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Class Payments');
      const monthHeaders = physicalPaymentMonthsForMatrix.map((month) => `${month.name} ${month.year}`);
      const headers = [
        'Student Name',
        'Institute ID',
        'Phone',
        'Barcode ID',
        ...monthHeaders,
        'Overall',
        'Paid Count',
        'Pending Count',
        'Unpaid Count',
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 22;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FF1E293B' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });

      physicalVisiblePaymentRows.forEach((student) => {
        const monthStatusMap = new Map(
          student.months.map((month) => [month.monthId, month.status] as const),
        );
        const overallStatus = resolveClassPaymentOverallStatus(student);

        const monthStatusLabels = physicalPaymentMonthsForMatrix.map((month) => {
          const status = monthStatusMap.get(month.id) || 'UNPAID';
          return CLASS_PAYMENT_STATUS_LABEL[status];
        });

        worksheet.addRow([
          student.fullName,
          student.instituteId || '-',
          student.phone || '-',
          student.barcodeId || '-',
          ...monthStatusLabels,
          CLASS_PAYMENT_STATUS_LABEL[overallStatus],
          student.paidCount,
          student.pendingCount,
          student.unpaidCount,
        ]);
      });

      worksheet.views = [{ state: 'frozen', xSplit: 4, ySplit: 1 }];
      worksheet.getColumn(1).width = 28;
      worksheet.getColumn(2).width = 16;
      worksheet.getColumn(3).width = 16;
      worksheet.getColumn(4).width = 16;
      const firstMonthColumn = 5;
      monthHeaders.forEach((_, index) => {
        worksheet.getColumn(firstMonthColumn + index).width = 14;
      });

      const overallColumn = firstMonthColumn + monthHeaders.length;
      worksheet.getColumn(overallColumn).width = 12;
      worksheet.getColumn(overallColumn + 1).width = 12;
      worksheet.getColumn(overallColumn + 2).width = 14;
      worksheet.getColumn(overallColumn + 3).width = 12;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const classSlug = (cls?.name || 'class')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const stamp = new Date().toISOString().slice(0, 10);

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `class-payments-${classSlug || 'class'}-${stamp}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setPhysicalPaymentExportError('Failed to export payment matrix as Excel. Please try again.');
    } finally {
      setPhysicalPaymentExporting(false);
    }
  };

  const physicalSessionStatusSummary = useMemo(() => {
    const summary = {
      total: physicalVisibleSessionRows.length,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      notMarked: 0,
    };

    physicalVisibleSessionRows.forEach((student) => {
      if (student.status === 'PRESENT') summary.present += 1;
      else if (student.status === 'LATE') summary.late += 1;
      else if (student.status === 'ABSENT') summary.absent += 1;
      else if (student.status === 'EXCUSED') summary.excused += 1;
      else summary.notMarked += 1;
    });

    return summary;
  }, [physicalVisibleSessionRows]);

  const handleCloseSelectedPhysicalSession = async () => {
    if (!id || !physicalQuickSelectedSession) return;

    setPhysicalSessionClosing(true);
    setPhysicalSessionError('');
    setPhysicalSessionCloseMessage('');

    try {
      const response = await api.post(`/attendance/class-attendance/class/${id}/close-session`, {
        date: physicalQuickSelectedSession.date,
        sessionTime: physicalQuickSelectedSession.sessionTime,
        sessionCode: physicalQuickSelectedSession.sessionCode || undefined,
      });

      const markedRaw = response?.data?.marked;
      const marked = typeof markedRaw === 'number' && Number.isFinite(markedRaw) ? markedRaw : 0;
      setPhysicalSessionCloseMessage(
        `Session closed. ${marked} unmarked student${marked === 1 ? '' : 's'} moved to absent.`,
      );

      await loadSelectedPhysicalSessionAttendance();
    } catch (error: any) {
      const message = error?.response?.data?.message;
      if (Array.isArray(message)) {
        setPhysicalSessionError(message.join(', '));
      } else {
        setPhysicalSessionError(typeof message === 'string' ? message : 'Failed to close this session.');
      }
    } finally {
      setPhysicalSessionClosing(false);
    }
  };

  const exportPhysicalAttendanceCsv = () => {
    if (!physicalMonitor || !physicalPreviewLoaded || physicalFilteredStudents.length === 0) return;

    const slots = physicalDisplaySlots;
    if (slots.length === 0) return;
    const headers = [
      'Student Name',
      'Institute ID',
      'Email',
      'Phone',
      'Barcode ID',
      ...slots.map((slot) => formatPhysicalSlotLabel(slot)),
      'Present',
      'Late',
      'Absent',
      'Excused',
      'Attendance %',
      ...physicalReportGroups.map((group) => `${group.name} Attendance`),
    ];

    const rows = physicalFilteredStudents.map((student: any) => {
      const slotStatuses = slots.map((slot) => {
        const status = (student.statuses?.[slot.key] as PhysicalCellStatus | undefined) || 'NOT_MARKED';
        return PHYSICAL_STATUS_LABEL[status];
      });

      return [
        student.fullName,
        student.instituteId || '-',
        student.email || '-',
        student.phone || '-',
        student.barcodeId || '-',
        ...slotStatuses,
        student.present || 0,
        student.late || 0,
        student.absent || 0,
        student.excused || 0,
        `${student.percentage || 0}%`,
        ...physicalReportGroups.map((group) => {
          const metric = student.groupMetrics?.[group.id];
          if (!metric) return '-';
          return `${metric.attended}/${metric.total} (${metric.percentage}%)`;
        }),
      ];
    });

    const csv = [
      headers.map((value) => csvEscape(value)).join(','),
      ...rows.map((row) => row.map((value) => csvEscape(value)).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const classSlug = (cls?.name || 'class')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const from = slots[0]?.date || physicalFromDate || 'from';
    const to = slots[slots.length - 1]?.date || physicalToDate || 'to';
    const groupSlug = physicalFocusedSlot
      ? 'single-session'
      : physicalReportGroups.length > 0
        ? `groups-${physicalReportGroups.length}`
        : 'all-sessions';

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `class-attendance-${classSlug}-${groupSlug}-${from}-to-${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const normalizedWatchSessions = useMemo(
    () => watchSessions.map((session: any) => ({ raw: session, ...getWatchSessionMeta(session) })),
    [watchSessions],
  );

  const recordingManageMonthOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; year: number; month: number }>();

    months.forEach((month: any) => {
      if (!month?.id) return;
      map.set(month.id, {
        id: month.id,
        name: month.name || '-',
        year: Number(month.year) || 0,
        month: Number(month.month) || 0,
      });
    });

    normalizedWatchSessions.forEach((session) => {
      if (!session.monthId) return;
      if (map.has(session.monthId)) return;
      map.set(session.monthId, {
        id: session.monthId,
        name: session.monthName || '-',
        year: 0,
        month: 0,
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return a.name.localeCompare(b.name);
    });
  }, [months, normalizedWatchSessions]);

  const recordingManageRecordingOptions = useMemo(() => {
    const map = new Map<string, { id: string; title: string; monthId: string; monthName: string }>();

    recordings.forEach((recording: any) => {
      if (!recording?.id) return;
      map.set(recording.id, {
        id: recording.id,
        title: recording.title || 'Recording',
        monthId: recording.monthId || recording.month?.id || '',
        monthName: recording.month?.name || '-',
      });
    });

    normalizedWatchSessions.forEach((session) => {
      if (!session.recordingId) return;
      if (map.has(session.recordingId)) return;
      map.set(session.recordingId, {
        id: session.recordingId,
        title: session.recordingTitle || 'Recording',
        monthId: session.monthId || '',
        monthName: session.monthName || '-',
      });
    });

    const rows = Array.from(map.values())
      .filter((item) => !recordingManageMonthFilter || item.monthId === recordingManageMonthFilter)
      .sort((a, b) => a.title.localeCompare(b.title));

    return rows;
  }, [normalizedWatchSessions, recordingManageMonthFilter, recordings]);

  useEffect(() => {
    if (
      recordingManageRecordingFilter
      && !recordingManageRecordingOptions.some((option) => option.id === recordingManageRecordingFilter)
    ) {
      setRecordingManageRecordingFilter('');
    }
  }, [recordingManageRecordingFilter, recordingManageRecordingOptions]);

  const recordingManageFilteredSessions = useMemo(() => {
    const query = recordingManageSearch.trim().toLowerCase();

    return normalizedWatchSessions.filter((session) => {
      if (recordingManageMonthFilter && session.monthId !== recordingManageMonthFilter) return false;
      if (recordingManageRecordingFilter && session.recordingId !== recordingManageRecordingFilter) return false;

      if (!query) return true;

      return [
        session.fullName,
        session.instituteId,
        session.email,
        session.phone,
        session.recordingTitle,
        session.monthName,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [
    normalizedWatchSessions,
    recordingManageMonthFilter,
    recordingManageRecordingFilter,
    recordingManageSearch,
  ]);

  const recordingManageStudentRows = useMemo(() => {
    const map = new Map<string, any>();

    recordingManageFilteredSessions.forEach((session) => {
      const key = session.userId || session.instituteId || session.email || session.fullName;
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          rowId: key,
          userId: session.userId || '-',
          fullName: session.fullName || 'Student',
          instituteId: session.instituteId || '-',
          email: session.email || '-',
          phone: session.phone || '-',
          avatarUrl: session.avatarUrl || null,
          sessionsCount: 0,
          totalWatchedSec: 0,
          lastWatchedAt: '',
          lastWatchedTs: 0,
          recordingIds: new Set<string>(),
          recordingWatch: {} as Record<string, { title: string; watchedSec: number }>,
        });
      }

      const row = map.get(key);
      row.sessionsCount += 1;
      row.totalWatchedSec += session.totalWatchedSec || 0;

      const recordingKey = session.recordingId || session.recordingTitle || 'recording';
      row.recordingIds.add(recordingKey);
      if (!row.recordingWatch[recordingKey]) {
        row.recordingWatch[recordingKey] = {
          title: session.recordingTitle || 'Recording',
          watchedSec: 0,
        };
      }
      row.recordingWatch[recordingKey].watchedSec += session.totalWatchedSec || 0;

      const watchedTs = session.startedAt ? new Date(session.startedAt).getTime() : 0;
      if (watchedTs > row.lastWatchedTs) {
        row.lastWatchedTs = watchedTs;
        row.lastWatchedAt = session.startedAt;
      }
    });

    return Array.from(map.values())
      .map((row) => {
        const topRecording = (Object.values(row.recordingWatch) as Array<{ title: string; watchedSec: number }>)
          .sort((a, b) => b.watchedSec - a.watchedSec)[0];

        return {
          rowId: row.rowId,
          userId: row.userId,
          fullName: row.fullName,
          instituteId: row.instituteId,
          email: row.email,
          phone: row.phone,
          avatarUrl: row.avatarUrl,
          sessionsCount: row.sessionsCount,
          recordingsCount: row.recordingIds.size,
          totalWatchedSec: row.totalWatchedSec,
          averageWatchSec: row.sessionsCount > 0 ? Math.round(row.totalWatchedSec / row.sessionsCount) : 0,
          lastWatchedAt: row.lastWatchedAt,
          topRecordingTitle: topRecording?.title || '-',
        };
      })
      .sort((a, b) => {
        if (b.totalWatchedSec !== a.totalWatchedSec) return b.totalWatchedSec - a.totalWatchedSec;
        return b.sessionsCount - a.sessionsCount;
      });
  }, [recordingManageFilteredSessions]);

  const recordingManageSummary = useMemo(() => {
    const totalSessions = recordingManageFilteredSessions.length;
    const totalWatchedSec = recordingManageFilteredSessions
      .reduce((sum, session) => sum + (session.totalWatchedSec || 0), 0);
    const uniqueStudents = recordingManageStudentRows.length;
    const uniqueRecordings = new Set(
      recordingManageFilteredSessions.map((session) => session.recordingId || session.recordingTitle),
    ).size;

    return {
      totalSessions,
      uniqueStudents,
      uniqueRecordings,
      totalWatchedSec,
      averagePerStudentSec: uniqueStudents > 0 ? Math.round(totalWatchedSec / uniqueStudents) : 0,
    };
  }, [recordingManageFilteredSessions, recordingManageStudentRows]);

  const exportRecordingSessionDetailsCsv = () => {
    if (recordingManageFilteredSessions.length === 0) return;

    const headers = [
      'Student Name',
      'Institute ID',
      'Email',
      'Phone',
      'Recording',
      'Month',
      'Started At',
      'Ended At',
      'Watch Time',
      'Watched Seconds',
      'Status',
    ];

    const rows = recordingManageFilteredSessions.map((session) => [
      session.fullName,
      session.instituteId || '-',
      session.email || '-',
      session.phone || '-',
      session.recordingTitle,
      session.monthName || '-',
      session.startedAt
        ? new Date(session.startedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '-',
      session.endedAt
        ? new Date(session.endedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '-',
      fmtTime(session.totalWatchedSec),
      session.totalWatchedSec,
      session.status,
    ]);

    const csv = [
      headers.map((value) => csvEscape(value)).join(','),
      ...rows.map((row) => row.map((value) => csvEscape(value)).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const classSlug = (cls?.name || 'class').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const stamp = new Date().toISOString().slice(0, 10);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `recording-viewings-details-${classSlug}-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportRecordingStudentPreviewCsv = () => {
    if (recordingManageStudentRows.length === 0) return;

    const headers = [
      'Student Name',
      'Institute ID',
      'Email',
      'Phone',
      'Sessions',
      'Recordings Watched',
      'Total Watch Time',
      'Average Watch Time',
      'Last Watched',
      'Top Recording',
    ];

    const rows = recordingManageStudentRows.map((student) => [
      student.fullName,
      student.instituteId || '-',
      student.email || '-',
      student.phone || '-',
      student.sessionsCount,
      student.recordingsCount,
      fmtTime(student.totalWatchedSec),
      fmtTime(student.averageWatchSec),
      student.lastWatchedAt
        ? new Date(student.lastWatchedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '-',
      student.topRecordingTitle || '-',
    ]);

    const csv = [
      headers.map((value) => csvEscape(value)).join(','),
      ...rows.map((row) => row.map((value) => csvEscape(value)).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const classSlug = (cls?.name || 'class').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const stamp = new Date().toISOString().slice(0, 10);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `recording-viewings-students-${classSlug}-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // ─── Month handlers ─────────────────────
  const openNewMonth = () => { setMonthForm({ ...emptyMonthForm }); setEditingMonth(null); setShowMonthForm(true); setMonthError(''); };
  const openEditMonth = (m: any) => {
    setMonthForm({ name: m.name, year: String(m.year), month: String(m.month), status: m.status || 'ANYONE' });
    setEditingMonth(m); setShowMonthForm(true); setMonthError('');
  };
  const saveMonth = async (e: React.FormEvent) => {
    e.preventDefault(); setMonthError(''); setMonthSaving(true);
    try {
      const payload = { name: monthForm.name, year: Number(monthForm.year), month: Number(monthForm.month), status: monthForm.status };
      if (editingMonth) await api.patch(`/classes/months/${editingMonth.id}`, payload);
      else await api.post(`/classes/${id}/months`, payload);
      setShowMonthForm(false); loadMonths(); loadRecordings();
    } catch (err: any) { setMonthError(err.response?.data?.message || 'Failed'); }
    finally { setMonthSaving(false); }
  };
  const deleteMonth = async (mid: string) => {
    if (!confirm('Delete this month and all its recordings?')) return;
    await api.delete(`/classes/months/${mid}`).catch(() => {}); loadMonths(); loadRecordings();
  };

  // ─── Recording handlers ─────────────────
  const openNewRec = () => { setRecForm({ ...emptyRecForm }); setEditingRec(null); setShowRecForm(true); setRecError(''); };
  const openEditRec = (rec: any) => {
    setRecForm({
      monthId: rec.monthId || '', title: rec.title, description: rec.description || '',
      videoUrl: rec.videoUrl, thumbnail: rec.thumbnail || '', topic: rec.topic || '',
      icon: rec.icon || '', materials: rec.materials || '', status: rec.status || 'PAID_ONLY',
    });
    setEditingRec(rec); setShowRecForm(true); setRecError('');
  };
  const saveRec = async (e: React.FormEvent) => {
    e.preventDefault(); setRecError(''); setRecSaving(true);
    try {
      const payload: any = {
        title: recForm.title, videoUrl: recForm.videoUrl, status: recForm.status,
        description: recForm.description || undefined, thumbnail: recForm.thumbnail || undefined,
        topic: recForm.topic || undefined, icon: recForm.icon || undefined,
        materials: recForm.materials || undefined,
      };
      if (editingRec) {
        if (recForm.monthId !== editingRec.monthId) payload.monthId = recForm.monthId;
        await api.patch(`/recordings/${editingRec.id}`, payload);
      } else {
        payload.monthId = recForm.monthId;
        await api.post('/recordings', payload);
      }
      setShowRecForm(false); loadRecordings();
    } catch (err: any) { setRecError(err.response?.data?.message || 'Failed'); }
    finally { setRecSaving(false); }
  };
  const deleteRec = async (rid: string) => {
    if (!confirm('Delete this recording?')) return;
    await api.delete(`/recordings/${rid}`).catch(() => {}); loadRecordings();
  };

  const handleRecThumbnailChange = async (file?: File) => {
    if (!file) return;
    setRecError('');
    setUploadingRecThumbnail(true);
    try {
      const url = editingRec
        ? await uploadRecordingThumbnail(editingRec.id, file)
        : await uploadImage(file, 'recordings');
      setRecForm(p => ({ ...p, thumbnail: url }));
    } catch (err: any) {
      setRecError(err.message || 'Thumbnail upload failed');
    } finally {
      setUploadingRecThumbnail(false);
    }
  };

  // ─── Enrollment handlers ────────────────
  const parseFeeInput = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN;
    return Math.round(parsed * 100) / 100;
  };

  const handleEnroll = async () => {
    setEnrollError(''); setEnrollSuccess('');

    const parsedCustomFee = enrollUseCustomFee ? parseFeeInput(enrollCustomFee) : null;
    if (Number.isNaN(parsedCustomFee as number)) {
      setEnrollError('Enter a valid custom monthly fee (0 or more).');
      return;
    }

    const pricingPayload = {
      paymentType: enrollPaymentType,
      customMonthlyFee: typeof parsedCustomFee === 'number' ? parsedCustomFee : undefined,
    };

    if (enrollMode === 'userId') {
      if (!enrollId) return; setEnrolling(true);
      try {
        await api.post('/enrollments', { userId: enrollId, classId: id, ...pricingPayload });
        setEnrollId(''); setSelectedStudent(null); setStudentSearch('');
        setEnrollUseCustomFee(false); setEnrollCustomFee('');
        setShowEnrollPricingOptions(false);
        setEnrollSuccess('Student enrolled successfully.');
        loadEnrollments();
      } catch (err: any) { setEnrollError(err.response?.data?.message || 'Failed to enroll student.'); }
      finally { setEnrolling(false); }
    } else {
      if (!enrollPhone.trim()) return; setEnrolling(true);
      try {
        await api.post('/enrollments/by-phone', { phone: enrollPhone.trim(), classId: id, ...pricingPayload });
        setEnrollPhone('');
        setEnrollUseCustomFee(false); setEnrollCustomFee('');
        setShowEnrollPricingOptions(false);
        setEnrollSuccess('Student enrolled successfully.');
        loadEnrollments();
      } catch (err: any) { setEnrollError(err.response?.data?.message || 'Failed to enroll student.'); }
      finally { setEnrolling(false); }
    }
  };
  const handleUnenroll = async (userId: string) => {
    if (!confirm('Unenroll this student?')) return;
    await api.delete(`/enrollments/${userId}/${id}`).catch(() => {}); loadEnrollments();
  };

  const openPricingModal = (enr: any) => {
    setPricingError('');
    setPricingForm({
      paymentType: (enr.paymentType || 'FULL') as EnrollmentPaymentType,
      useCustomFee: typeof enr.customMonthlyFee === 'number',
      customFee: typeof enr.customMonthlyFee === 'number' ? String(enr.customMonthlyFee) : '',
    });
    setPricingModalRow(enr);
  };

  const handleSavePricing = async () => {
    if (!pricingModalRow?.userId || !id) return;

    const parsedCustomFee = pricingForm.useCustomFee ? parseFeeInput(pricingForm.customFee) : null;
    if (Number.isNaN(parsedCustomFee as number)) {
      setPricingError('Enter a valid custom monthly fee (0 or more).');
      return;
    }

    setPricingSaving(true);
    setPricingError('');
    try {
      await api.patch(`/enrollments/${pricingModalRow.userId}/${id}/pricing`, {
        paymentType: pricingForm.paymentType,
        customMonthlyFee: typeof parsedCustomFee === 'number' ? parsedCustomFee : undefined,
        clearCustomFee: !pricingForm.useCustomFee,
      });
      setPricingModalRow(null);
      loadEnrollments();
    } catch (err: any) {
      setPricingError(err.response?.data?.message || 'Failed to update pricing settings.');
    } finally {
      setPricingSaving(false);
    }
  };

  const enrolledIds = useMemo(
    () => new Set(enrollments.map((e: any) => e.userId)),
    [enrollments],
  );
  const availableStudents = useMemo(
    () => allStudents.filter((s: any) => !enrolledIds.has(s.id)),
    [allStudents, enrolledIds],
  );

  const enrollmentCounts = useMemo(() => {
    const full = enrollments.filter((e: any) => (e.paymentType || 'FULL') === 'FULL').length;
    const half = enrollments.filter((e: any) => e.paymentType === 'HALF').length;
    const free = enrollments.filter((e: any) => e.paymentType === 'FREE').length;
    const custom = enrollments.filter((e: any) => typeof e.customMonthlyFee === 'number').length;
    return { full, half, free, custom };
  }, [enrollments]);

  const filteredEnrollments = useMemo(() => {
    const query = enrollmentTableSearch.trim().toLowerCase();

    return enrollments.filter((enr: any) => {
      const paymentType = (enr.paymentType || 'FULL') as EnrollmentPaymentType;
      const hasCustom = typeof enr.customMonthlyFee === 'number';

      if (studentPaymentTypeFilter !== 'ALL' && paymentType !== studentPaymentTypeFilter) return false;
      if (studentCustomFeeFilter === 'CUSTOM_ONLY' && !hasCustom) return false;
      if (studentCustomFeeFilter === 'DEFAULT_ONLY' && hasCustom) return false;

      if (!query) return true;
      const fields = [
        enr.user?.profile?.fullName || '',
        enr.user?.email || '',
        enr.user?.profile?.instituteId || '',
      ];
      return fields.some((field) => field.toLowerCase().includes(query));
    });
  }, [enrollments, enrollmentTableSearch, studentCustomFeeFilter, studentPaymentTypeFilter]);

  const selectedReportSet = useMemo(() => new Set(selectedReportUserIds), [selectedReportUserIds]);

  const filteredReportUserIds = useMemo(
    () => filteredEnrollments.map((row: any) => row.userId),
    [filteredEnrollments],
  );

  const selectedReportRows = useMemo(
    () => enrollments.filter((row: any) => selectedReportSet.has(row.userId)),
    [enrollments, selectedReportSet],
  );

  const selectedReportCount = selectedReportRows.length;

  const selectedFilteredReportCount = useMemo(
    () => filteredReportUserIds.filter((userId) => selectedReportSet.has(userId)).length,
    [filteredReportUserIds, selectedReportSet],
  );

  const allFilteredSelectedForReports = filteredReportUserIds.length > 0
    && selectedFilteredReportCount === filteredReportUserIds.length;

  const showEnrollPricingSection = studentsViewMode === 'ADVANCED' || showEnrollPricingOptions;

  useEffect(() => {
    if (studentsViewMode === 'SIMPLE') {
      setStudentCustomFeeFilter('ALL');
    }
  }, [studentsViewMode]);

  const toggleReportUserSelection = (userId: string) => {
    setSelectedReportUserIds((prev) => {
      if (prev.includes(userId)) return prev.filter((value) => value !== userId);
      return [...prev, userId];
    });
  };

  const toggleSelectAllFilteredReports = () => {
    if (filteredReportUserIds.length === 0) return;

    setSelectedReportUserIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = filteredReportUserIds.every((userId) => prevSet.has(userId));

      if (allSelected) {
        return prev.filter((userId) => !filteredReportUserIds.includes(userId));
      }

      return Array.from(new Set([...prev, ...filteredReportUserIds]));
    });
  };

  const clearSelectedReports = () => {
    setSelectedReportUserIds([]);
  };

  const loadSharedStudentReportData = async () => {
    const shared = {
      paymentsByUser: new Map<string, any>(),
      physicalSlots: [] as any[],
      physicalByUser: new Map<string, any>(),
      recordingSessions: [] as any[],
      warnings: [] as string[],
    };

    const jobs: Array<Promise<void>> = [];

    if (reportIncludePayments) {
      jobs.push(
        (async () => {
          try {
            const response = await api.get(`/attendance/class-attendance/class/${id}/payments`);
            const students = Array.isArray(response.data?.students) ? response.data.students : [];
            for (const row of students) {
              if (row?.userId) shared.paymentsByUser.set(row.userId, row);
            }
          } catch {
            shared.warnings.push('Payments section could not load. Report created without payment history.');
          }
        })(),
      );
    }

    if (reportIncludePhysicalAttendance) {
      jobs.push(
        (async () => {
          try {
            const datesResponse = await api.get(`/attendance/class-attendance/class/${id}/dates`);
            const dates = Array.isArray(datesResponse.data)
              ? datesResponse.data.filter((value: any) => typeof value === 'string').sort()
              : [];

            if (dates.length === 0) return;

            const monitorResponse = await api.get(`/attendance/class-attendance/class/${id}/monitor`, {
              params: { from: dates[0], to: dates[dates.length - 1] },
            });

            const slots = Array.isArray(monitorResponse.data?.slots) ? monitorResponse.data.slots : [];
            const students = Array.isArray(monitorResponse.data?.students) ? monitorResponse.data.students : [];

            shared.physicalSlots = slots;
            for (const row of students) {
              if (row?.userId) shared.physicalByUser.set(row.userId, row);
            }
          } catch {
            shared.warnings.push('Physical attendance section could not load. Report created without physical attendance details.');
          }
        })(),
      );
    }

    if (reportIncludeRecordingAttendance) {
      jobs.push(
        (async () => {
          try {
            const response = await api.get(`/attendance/watch-sessions/class/${id}`);
            shared.recordingSessions = Array.isArray(response.data) ? response.data : [];
          } catch {
            shared.warnings.push('Recording attendance section could not load. Report created without recording activity.');
          }
        })(),
      );
    }

    await Promise.all(jobs);
    return shared;
  };

  const buildStudentReportPayload = (enr: any, shared: {
    paymentsByUser: Map<string, any>;
    physicalSlots: any[];
    physicalByUser: Map<string, any>;
    recordingSessions: any[];
  }) => {
    const profile = enr.user?.profile || {};
    const paymentRow = shared.paymentsByUser.get(enr.userId);
    const paymentMonths = Array.isArray(paymentRow?.months) ? paymentRow.months : [];

    const physicalRow = shared.physicalByUser.get(enr.userId);
    const physicalStatuses = physicalRow?.statuses || {};
    const physicalRows = shared.physicalSlots
      .map((slot: any) => {
        const status = physicalStatuses[slot.key];
        if (!status) return null;

        const sessionLabel = formatPhysicalSlotLabel({
          date: asIsoDate(slot.date),
          sessionCode: typeof slot.sessionCode === 'string' ? slot.sessionCode : null,
          sessionTime: typeof slot.sessionTime === 'string' ? slot.sessionTime : '00:00',
        });

        return {
          date: normalizePhysicalDate(slot.date),
          session: sessionLabel,
          sessionTime: slot.sessionTime || '00:00',
          status,
        };
      })
      .filter(Boolean) as Array<{ date: string; session: string; sessionTime: string; status: string }>;

    const studentSessions = shared.recordingSessions
      .filter((row: any) => row.userId === enr.userId)
      .sort((a: any, b: any) => {
        const ta = new Date(b.startedAt || 0).getTime();
        const tb = new Date(a.startedAt || 0).getTime();
        return ta - tb;
      });

    const recordingSummaryMap = new Map<string, {
      recordingId: string;
      title: string;
      month: string;
      sessions: number;
      watchedSec: number;
      lastWatchedAt: string | null;
    }>();

    for (const session of studentSessions) {
      const recordingId = session.recordingId || `${session.recording?.title || '-'}:${session.recording?.month?.name || '-'}`;
      if (!recordingSummaryMap.has(recordingId)) {
        recordingSummaryMap.set(recordingId, {
          recordingId,
          title: session.recording?.title || '-',
          month: session.recording?.month?.name || '-',
          sessions: 0,
          watchedSec: 0,
          lastWatchedAt: null,
        });
      }

      const row = recordingSummaryMap.get(recordingId)!;
      row.sessions += 1;
      row.watchedSec += session.totalWatchedSec || 0;

      const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : 0;
      const lastWatchedAt = row.lastWatchedAt ? new Date(row.lastWatchedAt).getTime() : 0;
      if (startedAt > lastWatchedAt) row.lastWatchedAt = session.startedAt || null;
    }

    const recordingSummaryRows = recordings.map((recording: any) => {
      const existing = recordingSummaryMap.get(recording.id);
      return {
        title: recording.title || '-',
        month: recording.month?.name || '-',
        sessions: existing?.sessions || 0,
        watchedSec: existing?.watchedSec || 0,
        lastWatchedAt: existing?.lastWatchedAt || null,
      };
    });

    return {
      classInfo: {
        id: cls?.id || id,
        name: cls?.name || '-',
        subject: cls?.subject || '-',
      },
      student: {
        userId: enr.userId,
        fullName: profile.fullName || enr.user?.email || 'Student',
        instituteId: profile.instituteId || '-',
        email: enr.user?.email || '-',
        phone: profile.phone || '-',
        avatarUrl: profile.avatarUrl || null,
        paymentType: enr.paymentType || 'FULL',
        effectiveMonthlyFee: typeof enr.effectiveMonthlyFee === 'number' ? enr.effectiveMonthlyFee : null,
      },
      options: {
        includePayments: reportIncludePayments,
        includePhysicalAttendance: reportIncludePhysicalAttendance,
        includeRecordingAttendance: reportIncludeRecordingAttendance,
        recordingMode: reportRecordingMode,
      },
      payments: {
        rows: paymentMonths.map((month: any) => ({
          label: normalizeDateLabel(month.year, month.month, month.monthName),
          status: month.status || 'UNPAID',
          slipCount: month.slipCount || 0,
          latestSlipStatus: month.latestSlipStatus || null,
        })),
        paidCount: paymentRow?.paidCount || 0,
        pendingCount: paymentRow?.pendingCount || 0,
        unpaidCount: paymentRow?.unpaidCount || 0,
      },
      physicalAttendance: {
        summary: {
          total: shared.physicalSlots.length,
          present: physicalRow?.present || 0,
          late: physicalRow?.late || 0,
          absent: physicalRow?.absent || 0,
          excused: physicalRow?.excused || 0,
          percentage: physicalRow?.percentage || 0,
        },
        rows: physicalRows,
      },
      recordingAttendance: {
        summaryRows: recordingSummaryRows,
        sessionRows: studentSessions.map((session: any) => ({
          title: session.recording?.title || '-',
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          watchedSec: session.totalWatchedSec || 0,
          status: session.status || '-',
        })),
      },
    };
  };

  const exportSingleStudentReport = async (enr: any) => {
    if (!id) return;
    if (!reportIncludePayments && !reportIncludePhysicalAttendance && !reportIncludeRecordingAttendance) {
      setReportError('Select at least one report section before exporting.');
      return;
    }

    setReportError('');
    setReportWarning('');
    setReportSuccess('');
    setReporting(true);
    setReportProgress('Preparing student report...');

    try {
      const shared = await loadSharedStudentReportData();
      if (shared.warnings.length > 0) {
        setReportWarning(shared.warnings.join(' '));
      }

      const payload = buildStudentReportPayload(enr, shared);
      const blob = await buildStudentClassReportPdf(payload);
      const { saveAs } = await import('file-saver');

      const studentName = enr.user?.profile?.fullName || enr.user?.email || enr.userId;
      const instituteUserId = enr.user?.profile?.instituteId || null;
      saveAs(blob, createStudentClassReportFileName(studentName, instituteUserId));

      setReportSuccess(`PDF downloaded for ${studentName}.`);
    } catch (err: any) {
      setReportError(err.response?.data?.message || err.message || 'Failed to generate student report.');
    } finally {
      setReporting(false);
      setReportProgress('');
    }
  };

  const exportBatchStudentReports = async (scope: 'selected' | 'filtered') => {
    if (!id) return;
    if (!reportIncludePayments && !reportIncludePhysicalAttendance && !reportIncludeRecordingAttendance) {
      setReportError('Select at least one report section before exporting.');
      return;
    }

    const targetRows = scope === 'selected'
      ? selectedReportRows
      : filteredEnrollments;

    if (targetRows.length === 0) {
      setReportError(scope === 'selected'
        ? 'Select at least one student for export.'
        : 'No students in the current filter to export.');
      return;
    }

    setReportError('');
    setReportWarning('');
    setReportSuccess('');
    setReporting(true);

    try {
      const shared = await loadSharedStudentReportData();
      if (shared.warnings.length > 0) {
        setReportWarning(shared.warnings.join(' '));
      }

      if (targetRows.length === 1) {
        setReportProgress('Generating 1 report...');
        const row = targetRows[0];
        const payload = buildStudentReportPayload(row, shared);
        const blob = await buildStudentClassReportPdf(payload);
        const { saveAs } = await import('file-saver');
        const studentName = row.user?.profile?.fullName || row.user?.email || row.userId;
        saveAs(blob, createStudentClassReportFileName(studentName, row.user?.profile?.instituteId || null));
        setReportSuccess(`PDF downloaded for ${studentName}.`);
      } else {
        const [{ default: JSZip }, { saveAs }] = await Promise.all([
          import('jszip'),
          import('file-saver'),
        ]);

        const zip = new JSZip();

        for (let index = 0; index < targetRows.length; index++) {
          const row = targetRows[index];
          const studentName = row.user?.profile?.fullName || row.user?.email || row.userId;
          setReportProgress(`Generating report ${index + 1} of ${targetRows.length}...`);

          const payload = buildStudentReportPayload(row, shared);
          const blob = await buildStudentClassReportPdf(payload);

          const fileName = createStudentClassReportFileName(studentName, row.user?.profile?.instituteId || null);
          zip.file(fileName, blob);
        }

        setReportProgress('Creating ZIP file...');
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

        const className = (cls?.name || 'class').replace(/\s+/g, '-').toLowerCase();
        const stamp = new Date().toISOString().slice(0, 10);
        saveAs(zipBlob, `student-reports-${className}-${stamp}.zip`);
        setReportSuccess(`${targetRows.length} student reports downloaded as ZIP.`);
      }
    } catch (err: any) {
      setReportError(err.response?.data?.message || err.message || 'Failed to export student reports.');
    } finally {
      setReporting(false);
      setReportProgress('');
    }
  };

  const filteredRecs = filterMonth ? recordings.filter((r: any) => r.monthId === filterMonth) : recordings;

  const monthColumns: readonly StickyColumn<any>[] = [
    { id: 'name', label: 'Name', minWidth: 180, render: (m) => <span className="font-medium text-slate-800">{m.name}</span> },
    { id: 'period', label: 'Period', minWidth: 140, render: (m) => <span className="text-slate-500">{MONTH_NAMES[(m.month || 1) - 1]} {m.year}</span> },
    { id: 'recordings', label: 'Recordings', minWidth: 120, render: (m) => { const recCount = recordings.filter((r: any) => r.monthId === m.id).length; return <span className="text-slate-500">{recCount} recording{recCount !== 1 ? 's' : ''}</span>; } },
    { id: 'visibility', label: 'Visibility', minWidth: 120, render: (m) => <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge(m.status || 'ANYONE')}`}>{(m.status || 'ANYONE').replace(/_/g, ' ')}</span> },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 230,
      align: 'right',
      render: (m) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            to={getInstituteAdminPath(instituteId, `/classes/${id}/months/${m.id}/manage`)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Manage
          </Link>
          <button onClick={() => openEditMonth(m)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Edit
          </button>
          <button onClick={() => deleteMonth(m.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete
          </button>
        </div>
      ),
    },
  ];

  const recordingColumns: readonly StickyColumn<any>[] = [
    {
      id: 'title',
      label: 'Recording',
      minWidth: 240,
      render: (rec) => (
        <div>
          <p className="font-semibold text-slate-800 text-sm">{rec.title || '-'}</p>
          {rec.topic && <p className="text-xs font-medium text-blue-600 mt-0.5">{rec.topic}</p>}
          {rec.description && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{rec.description}</p>}
        </div>
      ),
    },
    {
      id: 'month',
      label: 'Month',
      minWidth: 160,
      render: (rec) => (
        <div>
          <p className="text-sm text-slate-600">{rec.month?.name || '-'}</p>
          <p className="text-[11px] text-slate-400">
            {rec.createdAt
              ? new Date(rec.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '-'}
          </p>
        </div>
      ),
    },
    {
      id: 'visibility',
      label: 'Visibility',
      minWidth: 130,
      render: (rec) => (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(rec.status || 'PAID_ONLY')}`}>
          {(rec.status || 'PAID_ONLY').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 430,
      align: 'right',
      render: (rec) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {rec.monthId ? (
            <Link
              to={getInstituteAdminPath(instituteId, `/classes/${id}/months/${rec.monthId}/manage`)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
            >
              Manage
            </Link>
          ) : (
            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-400">
              Manage
            </span>
          )}

          {rec.monthId ? (
            <Link
              to={getInstituteAdminPath(instituteId, `/classes/${id}/months/${rec.monthId}/rec-attendance`)}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
            >
              Attendance / View Time / Export
            </Link>
          ) : (
            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-400">
              Attendance / View Time / Export
            </span>
          )}

          <button
            onClick={() => openEditRec(rec)}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition"
          >
            Edit
          </button>

          {rec.videoUrl && (
            <a
              href={rec.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition"
            >
              View
            </a>
          )}

          <button
            onClick={() => deleteRec(rec.id)}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-100 transition"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const enrollmentColumns: readonly StickyColumn<any>[] = [
    {
      id: 'select',
      label: 'Select',
      minWidth: 70,
      align: 'center',
      render: (enr) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selectedReportSet.has(enr.userId)}
            onChange={() => toggleReportUserSelection(enr.userId)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
        </div>
      ),
    },
    {
      id: 'student', label: 'Student', minWidth: 220,
      render: (enr) => (
        <div className="flex items-center gap-2.5">
          {enr.user?.profile?.avatarUrl ? (
            <img src={enr.user.profile.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {(enr.user?.profile?.fullName || enr.user?.email || '?')[0].toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-slate-800">{enr.user?.profile?.fullName || '-'}</span>
        </div>
      ),
    },
    { id: 'email', label: 'Email', minWidth: 170, render: (enr) => <span className="text-slate-500">{enr.user?.email}</span> },
    { id: 'institute', label: 'ID', minWidth: 90, render: (enr) => <span className="text-slate-400 text-xs font-mono">{enr.user?.profile?.instituteId || '-'}</span> },
    {
      id: 'paymentType',
      label: 'Payment Type',
      minWidth: 120,
      render: (enr) => {
        const type = (enr.paymentType || 'FULL') as EnrollmentPaymentType;
        const meta = PAYMENT_TYPE_META[type] || PAYMENT_TYPE_META.FULL;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>
            {meta.label}
          </span>
        );
      },
    },
    {
      id: 'fee',
      label: 'Monthly Fee',
      minWidth: 170,
      render: (enr) => {
        const effective = typeof enr.effectiveMonthlyFee === 'number' ? enr.effectiveMonthlyFee : null;
        const base = typeof enr.defaultMonthlyFee === 'number' ? enr.defaultMonthlyFee : null;
        const hasCustom = typeof enr.customMonthlyFee === 'number';
        return (
          <div>
            <p className="font-semibold text-slate-700">{effective == null ? '-' : formatMoney(effective)}</p>
            {hasCustom ? (
              <p className="text-[10px] font-medium text-indigo-600">Custom price</p>
            ) : (
              <p className="text-[10px] text-slate-400">Default: {base == null ? '-' : formatMoney(base)}</p>
            )}
          </div>
        );
      },
    },
    { id: 'enrolled', label: 'Enrolled', minWidth: 90, render: (enr) => <span className="text-slate-400 text-xs">{enr.createdAt ? new Date(enr.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span> },
    {
      id: 'actions', label: 'Actions', minWidth: 310, align: 'right',
      render: (enr) => (
        <div className="flex items-center justify-end gap-1.5">
          {studentsViewMode === 'ADVANCED' && (
            <button
              onClick={() => void exportSingleStudentReport(enr)}
              disabled={reporting}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition disabled:opacity-50"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" /></svg>
              Report PDF
            </button>
          )}
          <button
            onClick={() => openPricingModal(enr)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3m3-3c1.657 0 3 1.343 3 3m-3-3V5m0 6v8m0 0a2 2 0 100-4 2 2 0 000 4z" /></svg>
            Edit Price
          </button>
          <button onClick={() => handleUnenroll(enr.userId)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>
            Unenroll
          </button>
        </div>
      ),
    },
  ];

  const watchColumns: readonly StickyColumn<any>[] = [
    {
      id: 'student', label: 'Student', minWidth: 220,
      render: (s) => (
        <div className="flex items-center gap-2.5">
          {s.user?.profile?.avatarUrl ? (
            <img src={s.user.profile.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-[9px]">{(s.user?.profile?.fullName || s.user?.email || '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}</span>
            </div>
          )}
          <div>
            <p className="font-medium text-slate-800">{s.user?.profile?.fullName || '-'}</p>
            <p className="text-xs text-slate-400">{s.user?.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'recording', label: 'Recording', minWidth: 240,
      render: (s) => (
        <>
          <p className="text-slate-600">{s.recording?.title || '-'}</p>
          <p className="text-xs text-slate-400">{s.recording?.month?.name || '-'}</p>
        </>
      ),
    },
    {
      id: 'date', label: 'Date', minWidth: 170,
      render: (s) => (
        <span className="text-slate-400 text-xs">
          {s.startedAt ? new Date(s.startedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
          <br />
          <span className="text-slate-300">
            {s.startedAt ? new Date(s.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
            {s.endedAt ? ` - ${new Date(s.endedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
        </span>
      ),
    },
    { id: 'watched', label: 'Watched', minWidth: 90, render: (s) => <span className="font-medium text-slate-700">{fmtTime(s.totalWatchedSec)}</span> },
    {
      id: 'status', label: 'Status', minWidth: 120,
      render: (s) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
          s.status === 'ENDED' ? 'bg-green-100 text-green-700' :
          s.status === 'WATCHING' ? 'bg-blue-100 text-blue-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          {s.status}
        </span>
      ),
    },
  ];

  const recordingStudentPreviewColumns: readonly StickyColumn<any>[] = [
    {
      id: 'student',
      label: 'Student',
      minWidth: 220,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          {row.avatarUrl ? (
            <img src={row.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-[9px]">{(row.fullName || '?').split(' ').map((part: string) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-800">{row.fullName || '-'}</p>
            <p className="text-xs text-slate-400">{row.email || '-'}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'instituteId',
      label: 'Institute ID',
      minWidth: 120,
      render: (row) => <span className="text-xs text-slate-500 font-mono">{row.instituteId || '-'}</span>,
    },
    {
      id: 'sessionsCount',
      label: 'Sessions',
      minWidth: 90,
      align: 'center',
      render: (row) => <span className="font-semibold text-slate-700">{row.sessionsCount || 0}</span>,
    },
    {
      id: 'recordingsCount',
      label: 'Recordings',
      minWidth: 100,
      align: 'center',
      render: (row) => <span className="font-semibold text-indigo-700">{row.recordingsCount || 0}</span>,
    },
    {
      id: 'totalWatchedSec',
      label: 'Total Watch',
      minWidth: 130,
      align: 'center',
      render: (row) => <span className="font-semibold text-emerald-700">{fmtTime(row.totalWatchedSec || 0)}</span>,
    },
    {
      id: 'averageWatchSec',
      label: 'Avg Session',
      minWidth: 120,
      align: 'center',
      render: (row) => <span className="font-medium text-slate-700">{fmtTime(row.averageWatchSec || 0)}</span>,
    },
    {
      id: 'lastWatchedAt',
      label: 'Last Watched',
      minWidth: 170,
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.lastWatchedAt
            ? new Date(row.lastWatchedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '-'}
        </span>
      ),
    },
    {
      id: 'topRecordingTitle',
      label: 'Top Recording',
      minWidth: 220,
      render: (row) => <span className="text-sm text-slate-600">{row.topRecordingTitle || '-'}</span>,
    },
  ];

  const physicalAttendanceColumns: readonly StickyColumn<any>[] = useMemo(() => {
    const baseColumns: StickyColumn<any>[] = [
      {
        id: 'student',
        label: 'Student',
        minWidth: 220,
        render: (row) => (
          <div className="flex items-center gap-2.5">
            {row.avatarUrl ? (
              <img src={row.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-[9px]">{(row.fullName || '?').split(' ').map((part: string) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-800">{row.fullName || '-'}</p>
              <p className="text-xs text-slate-400">{row.email || '-'}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'instituteId',
        label: 'Institute ID',
        minWidth: 120,
        render: (row) => <span className="text-xs text-slate-500 font-mono">{row.instituteId || '-'}</span>,
      },
      {
        id: 'phone',
        label: 'Phone',
        minWidth: 120,
        render: (row) => <span className="text-xs text-slate-500">{row.phone || '-'}</span>,
      },
      {
        id: 'barcode',
        label: 'Barcode',
        minWidth: 130,
        render: (row) => <span className="text-xs text-slate-500 font-mono">{row.barcodeId || '-'}</span>,
      },
      {
        id: 'present',
        label: 'Present',
        minWidth: 90,
        align: 'center',
        render: (row) => <span className="font-semibold text-emerald-700">{row.present || 0}</span>,
      },
      {
        id: 'late',
        label: 'Late',
        minWidth: 80,
        align: 'center',
        render: (row) => <span className="font-semibold text-amber-700">{row.late || 0}</span>,
      },
      {
        id: 'absent',
        label: 'Absent',
        minWidth: 90,
        align: 'center',
        render: (row) => <span className="font-semibold text-red-700">{row.absent || 0}</span>,
      },
      {
        id: 'excused',
        label: 'Excused',
        minWidth: 90,
        align: 'center',
        render: (row) => <span className="font-semibold text-blue-700">{row.excused || 0}</span>,
      },
      {
        id: 'percentage',
        label: 'Attendance %',
        minWidth: 120,
        align: 'right',
        render: (row) => {
          const percentage = typeof row.percentage === 'number' ? row.percentage : 0;
          const tone = percentage >= 80
            ? 'bg-emerald-100 text-emerald-700'
            : percentage >= 50
              ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700';
          return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{percentage}%</span>;
        },
      },
    ];

    if (physicalFocusedSlot) {
      const selectedLabel = physicalFocusedSlot.sessionCode
        ? `${physicalFocusedSlot.date} · ${physicalFocusedSlot.sessionCode}`
        : `${physicalFocusedSlot.date}${physicalFocusedSlot.sessionTime !== '00:00' ? ` ${physicalFocusedSlot.sessionTime}` : ''}`;

      baseColumns.push({
        id: 'selectedSessionStatus',
        label: selectedLabel,
        minWidth: 180,
        align: 'center',
        render: (row) => {
          const status = (row.statuses?.[physicalFocusedSlot.key] as PhysicalCellStatus | undefined) || 'NOT_MARKED';

          if (status === 'PRESENT') {
            return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700">Present</span>;
          }
          if (status === 'LATE') {
            return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-700">Late</span>;
          }
          if (status === 'ABSENT') {
            return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-700">Absent</span>;
          }
          if (status === 'EXCUSED') {
            return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-700">Excused</span>;
          }

          return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-500">Not Marked</span>;
        },
      });
    }

    const groupColumns: StickyColumn<any>[] = physicalReportGroups.map((group) => ({
      id: `group-${group.id}`,
      label: `${group.name} (${group.slotKeys.length})`,
      minWidth: 160,
      align: 'center',
      render: (row) => {
        const metric = row.groupMetrics?.[group.id];
        if (!metric) return <span className="text-xs text-slate-400">-</span>;

        const tone = metric.percentage >= 80
          ? 'bg-emerald-100 text-emerald-700'
          : metric.percentage >= 50
            ? 'bg-amber-100 text-amber-700'
            : 'bg-red-100 text-red-700';

        return (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
            {metric.attended}/{metric.total} ({metric.percentage}%)
          </span>
        );
      },
    }));

    return [...baseColumns, ...groupColumns];
  }, [physicalFocusedSlot, physicalReportGroups]);

  // Keep legacy physical preview helpers type-checked while the simplified selected-session UI is active.
  void [
    physicalLoadingPreview,
    physicalPreviewError,
    physicalGroupError,
    physicalGroupSelectedSlots,
    togglePhysicalGroupSlot,
    togglePhysicalGroupDate,
    addPhysicalReportGroup,
    removePhysicalReportGroup,
    loadPhysicalAttendancePreview,
    physicalSummary,
    exportPhysicalAttendanceCsv,
    physicalAttendanceColumns,
  ];

  const enrollmentColumnsForView: readonly StickyColumn<any>[] = studentsViewMode === 'ADVANCED'
    ? enrollmentColumns
    : enrollmentColumns.filter((col) => !['select', 'email', 'fee'].includes(col.id));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  if (!cls) return (
    <div className="text-center py-16 text-slate-400 text-sm">
      Class not found. <Link to={getInstituteAdminPath(instituteId, '/classes')} className="text-blue-600 hover:underline">Go back</Link>
    </div>
  );

  const inp = "w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30";
  const label = "block text-sm font-semibold text-slate-600 mb-1.5";

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <Link to={getInstituteAdminPath(instituteId, '/classes')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to Classes
      </Link>

      {/* Class Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {cls.thumbnail && (
            <div className="sm:w-48 h-36 sm:h-auto flex-shrink-0">
              <img src={cls.thumbnail} alt={cls.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-slate-800">{cls.name}</h1>
                {cls.subject && <p className="text-sm text-slate-500 mt-0.5">{cls.subject}</p>}
                {cls.description && <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{cls.description}</p>}
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0 ${statusBadge(cls.status || 'ANYONE')}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {(cls.status || 'ANYONE').replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex flex-wrap gap-5 mt-4 text-xs text-slate-500">
              {cls.monthlyFee != null && <span className="font-bold text-blue-600 text-sm">Rs. {Number(cls.monthlyFee).toLocaleString()} / month</span>}
              <span className="flex items-center gap-1"><span className="font-semibold text-slate-700">{months.length}</span> month{months.length !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><span className="font-semibold text-slate-700">{recordings.length}</span> recording{recordings.length !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><span className="font-semibold text-slate-700">{enrollments.length}</span> student{enrollments.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200 overflow-x-auto">
        {([['months', 'Months'], ['recordings', 'Recordings'], ['students', 'Students'], ['attendance', 'Attendance'], ['payments', 'Payments']] as [Tab, string][]).map(([key, lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 min-w-[4.5rem] px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {lbl}
            {key === 'months' && <span className="ml-1.5 text-slate-400">({months.length})</span>}
            {key === 'recordings' && <span className="ml-1.5 text-slate-400">({recordings.length})</span>}
            {key === 'students' && <span className="ml-1.5 text-slate-400">({enrollments.length})</span>}
            {key === 'attendance' && <span className="ml-1.5 text-slate-400">({physicalMonitor?.slots.length || physicalAvailableDates.length})</span>}
            {key === 'payments' && <span className="ml-1.5 text-slate-400">({physicalPaymentRows.length})</span>}
          </button>
        ))}
      </div>

      {/* ═══════════════ MONTHS TAB ═══════════════ */}
      {tab === 'months' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={openNewMonth}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add Month
            </button>
          </div>

          {showMonthForm && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowMonthForm(false)}>
              <div className="min-h-full flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 rounded-t-2xl">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{editingMonth ? 'Edit Month' : 'New Month'}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{editingMonth ? 'Update month details' : 'Add a new month to organize recordings'}</p>
                  </div>
                  <button onClick={() => setShowMonthForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <form onSubmit={saveMonth} className="overflow-y-auto max-h-[80vh]">
                <div className="p-6 space-y-5">
                  {monthError && <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600"><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{monthError}</div>}
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Month Details</p>
                    <div><label className={label}>Month Name</label><input type="text" value={monthForm.name} onChange={e => setMonthForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. January 2025" required className={inp} /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div><label className={label}>Year</label><input type="number" value={monthForm.year} onChange={e => setMonthForm(p => ({ ...p, year: e.target.value }))} required className={inp} /></div>
                      <div>
                        <label className={label}>Month</label>
                        <select value={monthForm.month} onChange={e => setMonthForm(p => ({ ...p, month: e.target.value }))} className={inp}>
                          {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={label}>Visibility</label>
                        <select value={monthForm.status} onChange={e => setMonthForm(p => ({ ...p, status: e.target.value }))} className={inp}>
                          {VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2 pb-2">
                    <button type="button" onClick={() => setShowMonthForm(false)} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                    <button type="submit" disabled={monthSaving} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                      {monthSaving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                      {monthSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
                </form>
              </div>
              </div>
            </div>
          , document.body)}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {months.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-sm font-medium text-slate-500">No months yet</p>
                <p className="text-xs text-slate-400 mt-1">Add your first month to start organizing recordings</p>
              </div>
            ) : (
              <StickyDataTable
                columns={monthColumns}
                rows={months}
                getRowId={(row) => row.id}
                tableHeight="calc(100vh - 420px)"
              />
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ RECORDINGS TAB ═══════════════ */}
      {tab === 'recordings' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Month filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilterMonth('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!filterMonth ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                All Months
              </button>
              {months.map((m: any) => (
                <button key={m.id} onClick={() => setFilterMonth(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterMonth === m.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {m.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
                <button
                  onClick={() => setRecordingsViewMode('LIST')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${recordingsViewMode === 'LIST' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  List
                </button>
                <button
                  onClick={() => setRecordingsViewMode('CARDS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${recordingsViewMode === 'CARDS' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Cards
                </button>
              </div>

              <button onClick={openNewRec}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 flex items-center gap-1.5 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add Recording
              </button>
            </div>
          </div>

          {/* Rec form modal */}
          {showRecForm && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowRecForm(false)}>
              <div className="min-h-full flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 rounded-t-2xl">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{editingRec ? 'Edit Recording' : 'New Recording'}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{editingRec ? 'Update recording details' : 'Add a new recording to this class'}</p>
                  </div>
                  <button onClick={() => setShowRecForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <form onSubmit={saveRec} className="overflow-y-auto max-h-[80vh]">
                <div className="p-6 space-y-5">
                  {recError && <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600"><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{recError}</div>}
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={label}>Month</label>
                        <select value={recForm.monthId} onChange={e => setRecForm(p => ({ ...p, monthId: e.target.value }))} required className={inp}>
                          <option value="">Select month</option>
                          {months.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={label}>Visibility</label>
                        <select value={recForm.status} onChange={e => setRecForm(p => ({ ...p, status: e.target.value }))} className={inp}>
                          {VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                        </select>
                      </div>
                    </div>
                    <div><label className={label}>Title</label><input type="text" value={recForm.title} onChange={e => setRecForm(p => ({ ...p, title: e.target.value }))} required className={inp} placeholder="e.g. Lesson 01" /></div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Video</p>
                    <div><label className={label}>Video URL</label><input type="text" value={recForm.videoUrl} onChange={e => setRecForm(p => ({ ...p, videoUrl: e.target.value }))} required className={inp} placeholder="https://..." /></div>
                    <div>
                      <label className={label}>Thumbnail URL</label>
                      <div className="space-y-2">
                        <input type="text" value={recForm.thumbnail} onChange={e => setRecForm(p => ({ ...p, thumbnail: e.target.value }))} className={inp} placeholder="https://..." />
                        <div className="flex flex-wrap items-center gap-2">
                          <CropImageInput
                            onFile={handleRecThumbnailChange}
                            aspectRatio={16 / 9}
                            loading={uploadingRecThumbnail}
                            label="Upload Image"
                            cropTitle="Crop Thumbnail"
                          />
                          <span className="text-[11px] text-slate-400">JPEG/PNG/WebP/GIF up to 5MB</span>
                        </div>
                        {recForm.thumbnail && (
                          <img src={recForm.thumbnail} alt="Recording thumbnail preview" className="w-full max-h-28 object-cover rounded-xl border border-slate-200" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Meta</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><label className={label}>Topic</label><input type="text" value={recForm.topic} onChange={e => setRecForm(p => ({ ...p, topic: e.target.value }))} className={inp} placeholder="Topic name" /></div>
                      <div><label className={label}>Icon</label><input type="text" value={recForm.icon} onChange={e => setRecForm(p => ({ ...p, icon: e.target.value }))} className={inp} placeholder="Icon name/URL" /></div>
                    </div>
                    <div><label className={label}>Description</label><textarea value={recForm.description} onChange={e => setRecForm(p => ({ ...p, description: e.target.value }))} className={inp + " resize-none"} rows={3} placeholder="Optional notes..." /></div>
                    <div><label className={label}>Materials (JSON or links)</label><textarea value={recForm.materials} onChange={e => setRecForm(p => ({ ...p, materials: e.target.value }))} className={inp + " resize-none"} rows={3} placeholder='e.g. ["https://file1.pdf"]' /></div>
                  </div>
                  <div className="flex gap-3 pt-2 pb-2">
                    <button type="button" onClick={() => setShowRecForm(false)} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                    <button type="submit" disabled={recSaving || uploadingRecThumbnail} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                      {(recSaving || uploadingRecThumbnail) && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                      {recSaving ? 'Saving...' : uploadingRecThumbnail ? 'Uploading...' : 'Save'}
                    </button>
                  </div>
                </div>
                </form>
              </div>
              </div>
            </div>
          , document.body)}

          {/* Recordings list / cards */}
          {filteredRecs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-sm font-medium text-slate-500">No recordings {filterMonth ? 'in this month' : 'yet'}</p>
              <p className="text-xs text-slate-400 mt-1">Add your first recording to get started</p>
            </div>
          ) : recordingsViewMode === 'LIST' ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <StickyDataTable
                columns={recordingColumns}
                rows={filteredRecs}
                getRowId={(row) => row.id}
                tableHeight="calc(100vh - 430px)"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecs.map((rec: any) => (
                <div key={rec.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden group hover:border-blue-300 hover:shadow-md transition-all">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-slate-100">
                    {rec.thumbnail ? (
                      <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm ${statusBadge(rec.status || 'PAID_ONLY')}`}>
                      {(rec.status || 'PAID_ONLY').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="p-3.5">
                    <p className="font-semibold text-sm text-slate-800 truncate">{rec.title}</p>
                    {rec.topic && <p className="text-xs text-blue-500 truncate mt-0.5 font-medium">{rec.topic}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">{rec.month?.name || '—'} · {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}</p>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {rec.monthId ? (
                          <Link
                            to={getInstituteAdminPath(instituteId, `/classes/${id}/months/${rec.monthId}/manage`)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition"
                          >
                            Manage
                          </Link>
                        ) : (
                          <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold">Manage</span>
                        )}

                        {rec.monthId ? (
                          <Link
                            to={getInstituteAdminPath(instituteId, `/classes/${id}/months/${rec.monthId}/rec-attendance`)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition"
                          >
                            Attendance / Export
                          </Link>
                        ) : (
                          <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold">Attendance / Export</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openEditRec(rec)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        Edit
                        </button>
                        {rec.videoUrl && (
                          <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-50 text-cyan-700 text-xs font-semibold hover:bg-cyan-100 transition">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            View
                          </a>
                        )}
                        <button onClick={() => deleteRec(rec.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition ml-auto">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ STUDENTS TAB ═══════════════ */}
      {tab === 'students' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Students Management</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {studentsViewMode === 'SIMPLE'
                    ? 'Simple mode is on. Only the most important controls are shown.'
                    : 'Advanced mode is on. All filters and report tools are available.'}
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit">
                <button
                  onClick={() => setStudentsViewMode('SIMPLE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${studentsViewMode === 'SIMPLE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Simple
                </button>
                <button
                  onClick={() => setStudentsViewMode('ADVANCED')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${studentsViewMode === 'ADVANCED' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Advanced
                </button>
              </div>
            </div>
          </div>

          {/* Enroll form */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              Enroll a Student
            </h3>

            {/* Mode toggle */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4 w-fit">
              <button onClick={() => { setEnrollMode('userId'); setEnrollError(''); setEnrollSuccess(''); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${enrollMode === 'userId' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                By Student
              </button>
              <button onClick={() => { setEnrollMode('phone'); setEnrollError(''); setEnrollSuccess(''); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${enrollMode === 'phone' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                By Phone Number
              </button>
            </div>

            {enrollMode === 'userId' ? (
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Searchable dropdown */}
                <div className="relative flex-1">
                  <div
                    className={`${inp} flex items-center justify-between cursor-pointer`}
                    onClick={() => setDropdownOpen(o => !o)}
                  >
                    <span className={selectedStudent ? 'text-slate-800' : 'text-slate-400'}>
                      {selectedStudent ? `${selectedStudent.profile?.fullName || selectedStudent.email} (${selectedStudent.email})` : 'Select a student to enroll...'}
                    </span>
                    <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  {dropdownOpen && (
                    <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          <input
                            autoFocus
                            value={studentSearch}
                            onChange={e => setStudentSearch(e.target.value)}
                            placeholder="Search by name or email..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <ul className="max-h-52 overflow-y-auto py-1">
                        {availableStudents
                          .filter((s: any) => {
                            const q = studentSearch.toLowerCase();
                            return !q || (s.profile?.fullName || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
                          })
                          .map((s: any) => (
                            <li
                              key={s.id}
                              className="flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 cursor-pointer transition"
                              onClick={() => { setSelectedStudent(s); setEnrollId(s.id); setDropdownOpen(false); setStudentSearch(''); }}
                            >
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                {(s.profile?.fullName || s.email)[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{s.profile?.fullName || s.email}</p>
                                <p className="text-[10px] text-slate-400 truncate">{s.email}</p>
                              </div>
                            </li>
                          ))}
                        {availableStudents.filter((s: any) => {
                          const q = studentSearch.toLowerCase();
                          return !q || (s.profile?.fullName || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
                        }).length === 0 && (
                          <li className="px-3 py-3 text-xs text-slate-400 text-center">No students found</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
                <button onClick={handleEnroll} disabled={!enrollId || enrolling}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex-shrink-0 flex items-center gap-2">
                  {enrolling && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {enrolling ? 'Enrolling...' : 'Enroll Student'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="tel"
                  value={enrollPhone}
                  onChange={e => setEnrollPhone(e.target.value)}
                  placeholder="e.g. 0771234567"
                  className={inp + " flex-1"}
                />
                <button onClick={handleEnroll} disabled={!enrollPhone.trim() || enrolling}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex-shrink-0 flex items-center gap-2">
                  {enrolling && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {enrolling ? 'Enrolling...' : 'Enroll by Phone'}
                </button>
              </div>
            )}

            {!showEnrollPricingSection ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowEnrollPricingOptions(true)}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  Set Price Options (Optional)
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-600">Price Settings (Optional)</p>
                  {studentsViewMode === 'SIMPLE' && (
                    <button
                      type="button"
                      onClick={() => setShowEnrollPricingOptions(false)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Hide
                    </button>
                  )}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[180px_1fr]">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Payment Type</label>
                    <select
                      value={enrollPaymentType}
                      onChange={(event) => setEnrollPaymentType(event.target.value as EnrollmentPaymentType)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                    >
                      {ENROLLMENT_PAYMENT_TYPES.map((type) => (
                        <option key={type} value={type}>{PAYMENT_TYPE_META[type].label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                      <input
                        type="checkbox"
                        checked={enrollUseCustomFee}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setEnrollUseCustomFee(enabled);
                          if (!enabled) setEnrollCustomFee('');
                        }}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Custom Monthly Fee
                    </label>

                    {enrollUseCustomFee ? (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={enrollCustomFee}
                        onChange={(event) => setEnrollCustomFee(event.target.value)}
                        placeholder="e.g. 1500"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                      />
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Default class fee will apply ({formatMoney(cls?.monthlyFee)}).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {enrollError && (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {enrollError}
              </div>
            )}
            {enrollSuccess && (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-100 text-xs text-green-700">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {enrollSuccess}
              </div>
            )}
          </div>

          {studentsViewMode === 'ADVANCED' ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                <div className="relative">
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
                  </svg>
                  <input
                    placeholder="Search student, email, phone"
                    value={enrollmentTableSearch}
                    onChange={(event) => setEnrollmentTableSearch(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-9 py-2.5 text-sm"
                  />
                </div>

                <select
                  value={studentPaymentTypeFilter}
                  onChange={(event) => setStudentPaymentTypeFilter(event.target.value as 'ALL' | EnrollmentPaymentType)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                >
                  <option value="ALL">All payment types</option>
                  {ENROLLMENT_PAYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>{PAYMENT_TYPE_META[type].label}</option>
                  ))}
                </select>

                <select
                  value={studentCustomFeeFilter}
                  onChange={(event) => setStudentCustomFeeFilter(event.target.value as 'ALL' | 'CUSTOM_ONLY' | 'DEFAULT_ONLY')}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                >
                  <option value="ALL">All pricing</option>
                  <option value="CUSTOM_ONLY">Custom fee only</option>
                  <option value="DEFAULT_ONLY">Class default fee</option>
                </select>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {ENROLLMENT_PAYMENT_TYPES.map((type) => {
                  const count = type === 'FULL'
                    ? enrollmentCounts.full
                    : type === 'HALF'
                      ? enrollmentCounts.half
                      : enrollmentCounts.free;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setStudentPaymentTypeFilter(studentPaymentTypeFilter === type ? 'ALL' : type)}
                      className={`rounded-full border px-3 py-1 font-semibold transition ${
                        studentPaymentTypeFilter === type
                          ? PAYMENT_TYPE_META[type].chipClass
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                      }`}
                    >
                      {PAYMENT_TYPE_META[type].label}: {count}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
                  </svg>
                  <input
                    placeholder="Search students"
                    value={enrollmentTableSearch}
                    onChange={(event) => setEnrollmentTableSearch(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-9 py-2.5 text-sm"
                  />
                </div>
                <select
                  value={studentPaymentTypeFilter}
                  onChange={(event) => setStudentPaymentTypeFilter(event.target.value as 'ALL' | EnrollmentPaymentType)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                >
                  <option value="ALL">All payment types</option>
                  {ENROLLMENT_PAYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>{PAYMENT_TYPE_META[type].label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {studentsViewMode === 'ADVANCED' ? (
            <div className="rounded-[24px] border border-blue-200 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 shadow-sm p-4 sm:p-5 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h9A2.25 2.25 0 0118.75 6v12A2.25 2.25 0 0116.5 20.25h-9A2.25 2.25 0 015.25 18V6A2.25 2.25 0 017.5 3.75z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9.75h7.5M8.25 13.5h7.5M8.25 17.25h4.5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900">Student Reports Center</h3>
                    <p className="text-xs text-blue-700/80">Create clean PDF reports for selected students using a guided export setup.</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-blue-700">
                    Selected <span className="font-semibold text-blue-900">{selectedReportCount}</span>
                  </span>
                  <span className="rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-blue-700">
                    Filtered <span className="font-semibold text-blue-900">{selectedFilteredReportCount}/{filteredReportUserIds.length}</span>
                  </span>
                  <span className="rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-blue-700">
                    Sections <span className="font-semibold text-blue-900">{Number(reportIncludePhysicalAttendance) + Number(reportIncludePayments) + Number(reportIncludeRecordingAttendance)}</span>
                  </span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className={`inline-flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-xs transition ${
                  reportIncludePhysicalAttendance
                    ? 'border-blue-300 bg-white text-blue-900 shadow-sm ring-2 ring-blue-100'
                    : 'border-blue-100 bg-white/90 text-slate-600 hover:border-blue-200 hover:bg-white'
                }`}>
                  <input
                    type="checkbox"
                    checked={reportIncludePhysicalAttendance}
                    onChange={(event) => setReportIncludePhysicalAttendance(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Include physical attendance
                    <span className="block text-[11px] text-slate-500 mt-0.5">Summary and date-wise status</span>
                  </span>
                </label>

                <label className={`inline-flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-xs transition ${
                  reportIncludePayments
                    ? 'border-blue-300 bg-white text-blue-900 shadow-sm ring-2 ring-blue-100'
                    : 'border-blue-100 bg-white/90 text-slate-600 hover:border-blue-200 hover:bg-white'
                }`}>
                  <input
                    type="checkbox"
                    checked={reportIncludePayments}
                    onChange={(event) => setReportIncludePayments(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Include payment history
                    <span className="block text-[11px] text-slate-500 mt-0.5">Monthly payment status and latest transactions</span>
                  </span>
                </label>

                <label className={`inline-flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-xs transition ${
                  reportIncludeRecordingAttendance
                    ? 'border-blue-300 bg-white text-blue-900 shadow-sm ring-2 ring-blue-100'
                    : 'border-blue-100 bg-white/90 text-slate-600 hover:border-blue-200 hover:bg-white'
                }`}>
                  <input
                    type="checkbox"
                    checked={reportIncludeRecordingAttendance}
                    onChange={(event) => setReportIncludeRecordingAttendance(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Include recording summary
                    <span className="block text-[11px] text-slate-500 mt-0.5">Watch duration and recording status</span>
                  </span>
                </label>
              </div>

              {reportIncludeRecordingAttendance && (
                <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-blue-200 bg-white/90 p-3">
                  <label className="text-xs font-semibold text-blue-800">
                    Recording mode
                    <select
                      value={reportRecordingMode}
                      onChange={(event) => setReportRecordingMode(event.target.value as RecordingReportMode)}
                      className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                    >
                      <option value="SUMMARY">Summary only (compact)</option>
                      <option value="FULL">Detailed watch logs</option>
                    </select>
                  </label>
                  <p className="text-[11px] text-blue-700/75 self-end">
                    Detailed mode includes each watch session and can create larger PDF files.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-blue-200 bg-white/95 p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAllFilteredReports}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    {allFilteredSelectedForReports ? 'Clear filtered selection' : 'Select all filtered students'}
                  </button>

                  <button
                    type="button"
                    onClick={clearSelectedReports}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    disabled={selectedReportCount === 0}
                  >
                    Reset selection
                  </button>

                  <button
                    type="button"
                    onClick={() => void exportBatchStudentReports('selected')}
                    disabled={reporting || selectedReportCount === 0}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reporting ? 'Preparing ZIP...' : `Export Selected (${selectedReportCount})`}
                  </button>

                  <button
                    type="button"
                    onClick={() => void exportBatchStudentReports('filtered')}
                    disabled={reporting || filteredReportUserIds.length === 0}
                    className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reporting ? 'Preparing ZIP...' : `Export Filtered (${filteredReportUserIds.length})`}
                  </button>
                </div>
                <p className="text-[11px] text-blue-700/80">
                  Tip: Select filters first, then export filtered to quickly generate consistent reports.
                </p>
              </div>

              <div className="space-y-2">
                {!reportIncludePayments && !reportIncludePhysicalAttendance && !reportIncludeRecordingAttendance && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    Select at least one report section before exporting.
                  </div>
                )}

                {reportProgress && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    {reportProgress}
                  </div>
                )}

                {reportSuccess && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {reportSuccess}
                  </div>
                )}

                {reportError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {reportError}
                  </div>
                )}

                {reportWarning && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 whitespace-pre-line">
                    {reportWarning}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-blue-200 bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 shadow-sm p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-blue-900">Student Reports</h3>
                <p className="text-xs text-blue-700/80">Use Advanced mode for curved blue report controls and bulk export setup.</p>
              </div>
              <button
                type="button"
                onClick={() => setStudentsViewMode('ADVANCED')}
                className="rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 w-fit"
              >
                Open Advanced Reports
              </button>
            </div>
          )}

          <div className="rounded-[24px] border border-blue-100 bg-gradient-to-b from-blue-50/70 to-white p-2.5 sm:p-3 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-100 bg-white/85 px-3.5 py-2.5">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-800">Students Table</h4>
                <p className="text-[11px] text-blue-700/75 mt-0.5">Rounded table view with filter-friendly rows and report actions.</p>
              </div>
              <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                Showing {filteredEnrollments.length}/{enrollments.length}
              </span>
            </div>

            <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
              {enrollments.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3 border border-blue-100">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500">No students enrolled yet</p>
                  <p className="text-xs text-slate-400 mt-1">Use the form above to enroll students</p>
                </div>
              ) : filteredEnrollments.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3 border border-blue-100">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M6 12h12M10 17h4" /></svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500">No students match your filters</p>
                  <p className="text-xs text-slate-400 mt-1">Try changing payment type, custom fee filter, or search text</p>
                </div>
              ) : (
                <StickyDataTable
                  columns={enrollmentColumnsForView}
                  rows={filteredEnrollments}
                  getRowId={(row) => row.userId}
                  tableHeight={studentsViewMode === 'ADVANCED' ? 'calc(100vh - 500px)' : 'calc(100vh - 430px)'}
                />
              )}
            </div>
          </div>

          {pricingModalRow && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setPricingModalRow(null)}>
              <div className="min-h-full flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Student Pricing</h2>
                      <p className="text-xs text-slate-400 mt-0.5">{pricingModalRow.user?.profile?.fullName || pricingModalRow.user?.email || 'Student'}</p>
                    </div>
                    <button onClick={() => setPricingModalRow(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Payment Type</label>
                      <select
                        value={pricingForm.paymentType}
                        onChange={(event) => setPricingForm((prev) => ({ ...prev, paymentType: event.target.value as EnrollmentPaymentType }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
                      >
                        {ENROLLMENT_PAYMENT_TYPES.map((type) => (
                          <option key={type} value={type}>{PAYMENT_TYPE_META[type].label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <input
                          type="checkbox"
                          checked={pricingForm.useCustomFee}
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            setPricingForm((prev) => ({ ...prev, useCustomFee: enabled, customFee: enabled ? prev.customFee : '' }));
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Use Custom Monthly Fee
                      </label>

                      {pricingForm.useCustomFee ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={pricingForm.customFee}
                          onChange={(event) => setPricingForm((prev) => ({ ...prev, customFee: event.target.value }))}
                          placeholder="e.g. 1500"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
                        />
                      ) : (
                        <p className="mt-1 text-[11px] text-slate-400">
                          Default class fee will apply ({formatMoney(pricingModalRow.defaultMonthlyFee ?? cls?.monthlyFee)}).
                        </p>
                      )}
                    </div>

                    {pricingError && (
                      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                        {pricingError}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setPricingModalRow(null)}
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={pricingSaving}
                        onClick={() => void handleSavePricing()}
                        className="flex-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {pricingSaving ? 'Saving...' : 'Save Pricing'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )}
        </div>
      )}

      {/* ═══════════════ ATTENDANCE TAB ═══════════════ */}
      {(tab === 'attendance' || tab === 'payments') && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-4">
            {tab === 'attendance' && (
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Physical Attendance (Class Wise)</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Select a session, mark/view attendance, review students with images, and close the session when done.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPhysicalSessionFormOpen((prev) => !prev);
                      setPhysicalCreateSessionError('');
                      setPhysicalCreateSessionSuccess('');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    {physicalSessionFormOpen ? 'Cancel Session Create' : 'Create Session'}
                  </button>
                  <Link
                    to={markAttendanceScannerPath}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Mark Selected Session
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (physicalQuickSelectedSession) {
                        handlePreviewPhysicalSession(physicalQuickSelectedSession);
                      }
                    }}
                    disabled={!physicalQuickSelectedSession}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Preview Selected Session
                  </button>
                  <Link
                    to={markAttendanceExternalPath}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    External Device
                  </Link>
                </div>
              </div>
            )}

            <div className={tab === 'attendance' ? 'space-y-3' : 'hidden'}>

            {physicalSessionFormOpen && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-3">
                <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Create Session (Standalone)</p>
                <p className="text-[11px] text-violet-700/80">
                  This creates a class session only. Attendance can be imported or marked later.
                </p>

                <div className="grid gap-2 md:grid-cols-[160px_140px_minmax(0,1fr)_auto]">
                  <label className="text-[11px] font-semibold text-violet-700">
                    Date
                    <input
                      type="date"
                      value={physicalNewSessionDate}
                      onChange={(event) => setPhysicalNewSessionDate(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                    />
                  </label>

                  <label className="text-[11px] font-semibold text-violet-700">
                    Time
                    <input
                      type="time"
                      value={physicalNewSessionTime}
                      onChange={(event) => setPhysicalNewSessionTime(event.target.value || '00:00')}
                      className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                    />
                  </label>

                  <label className="text-[11px] font-semibold text-violet-700">
                    Name
                    <input
                      type="text"
                      value={physicalNewSessionName}
                      onChange={(event) => setPhysicalNewSessionName(event.target.value)}
                      placeholder="e.g. Week 04 - Group A"
                      className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => void handleCreatePhysicalSession()}
                      disabled={physicalCreatingSession}
                      className="rounded-lg border border-violet-300 bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {physicalCreatingSession ? 'Creating...' : 'Save Session'}
                    </button>
                  </div>
                </div>

                {physicalCreateSessionError && (
                  <p className="text-xs font-medium text-red-600">{physicalCreateSessionError}</p>
                )}
                {physicalCreateSessionSuccess && (
                  <p className="text-xs font-medium text-emerald-700">{physicalCreateSessionSuccess}</p>
                )}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Attendance Sessions (Class Level)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select one session, assign week from row dropdown, then mark or preview attendance.
                  </p>
                </div>
                <p className="text-[11px] text-slate-500">
                  {physicalQuickSelectedSession
                    ? `Selected: ${formatPhysicalSlotLabel(physicalQuickSelectedSession)}`
                    : 'Selected: None'}
                </p>
              </div>

              {physicalQuickSessionsLoading ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
                  Loading sessions...
                </div>
              ) : physicalQuickSessions.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
                  No attendance sessions found for this class.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-2 md:hidden">
                    {physicalQuickSessions.map((session) => {
                      const selected = session.key === physicalQuickSessionKey;
                      const sessionName = session.sessionCode || formatPhysicalSlotLabel(session);
                      const linkedWeekName = session.weekName || physicalAssignedWeekBySessionKey.get(session.key) || '';
                      const assigningWeek = physicalAssigningWeekSessionKey === session.key;
                      const selectedWeekId = session.weekId || '';

                      return (
                        <div
                          key={`session-mobile-${session.key}`}
                          className={`rounded-lg border p-3 ${selected ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-200 bg-white'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-800">{sessionName}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {session.date}{session.sessionTime !== '00:00' ? ` ${session.sessionTime}` : ''} | Count: {session.recordsCount}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                Session ID: <span className="font-mono text-slate-700">{session.readableId}</span>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectPhysicalQuickSession(session)}
                              className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${
                                selected
                                  ? 'border-indigo-300 bg-indigo-600 text-white'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                              }`}
                            >
                              {selected ? 'Selected' : 'Select'}
                            </button>
                          </div>

                          <div className="mt-2.5 space-y-1.5">
                            <p className="text-[11px] font-semibold text-slate-600">Week Assign</p>
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedWeekId}
                                onChange={(event) => {
                                  void handleAssignPhysicalSessionWeek(session, event.target.value);
                                }}
                                disabled={assigningWeek || physicalSavingWeekGroup || physicalDeletingWeekId.length > 0}
                                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 disabled:bg-slate-100"
                              >
                                <option value="">No Week</option>
                                {physicalReportGroups.map((group) => (
                                  <option key={`mobile-${session.key}-${group.id}`} value={group.id}>
                                    {group.name}
                                  </option>
                                ))}
                              </select>
                              {assigningWeek ? (
                                <span className="text-[10px] font-semibold text-indigo-600">Saving...</span>
                              ) : linkedWeekName ? (
                                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
                                  {linkedWeekName}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Link
                              to={getMarkAttendancePathForSession(session)}
                              className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Mark
                            </Link>
                            <button
                              type="button"
                              onClick={() => handlePreviewPhysicalSession(session)}
                              className="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              Preview
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden rounded-lg border border-slate-200 bg-white md:block">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Select</th>
                          <th className="px-3 py-2 text-left font-semibold">Date</th>
                          <th className="px-3 py-2 text-left font-semibold">Count</th>
                          <th className="px-3 py-2 text-left font-semibold">Name</th>
                          <th className="px-3 py-2 text-left font-semibold">Week Assign</th>
                          <th className="px-3 py-2 text-left font-semibold">Session ID</th>
                          <th className="px-3 py-2 text-left font-semibold">Mark Attendance</th>
                          <th className="px-3 py-2 text-left font-semibold">Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {physicalQuickSessions.map((session) => {
                          const selected = session.key === physicalQuickSessionKey;
                          const sessionName = session.sessionCode || formatPhysicalSlotLabel(session);
                          const linkedWeekName = session.weekName || physicalAssignedWeekBySessionKey.get(session.key) || '';
                          const assigningWeek = physicalAssigningWeekSessionKey === session.key;
                          const selectedWeekId = session.weekId || '';

                          return (
                            <tr key={session.key} className={selected ? 'bg-indigo-50/70' : 'bg-white'}>
                              <td className="px-3 py-2 align-middle">
                                <button
                                  type="button"
                                  onClick={() => handleSelectPhysicalQuickSession(session)}
                                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${
                                    selected
                                      ? 'border-indigo-300 bg-indigo-600 text-white'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                                  }`}
                                >
                                  {selected ? 'Selected' : 'Select'}
                                </button>
                              </td>
                              <td className="px-3 py-2 align-middle font-medium text-slate-700">{session.date}</td>
                              <td className="px-3 py-2 align-middle text-slate-700">{session.recordsCount}</td>
                              <td className="px-3 py-2 align-middle text-slate-700">{sessionName}</td>
                              <td className="px-3 py-2 align-middle text-slate-700">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={selectedWeekId}
                                    onChange={(event) => {
                                      void handleAssignPhysicalSessionWeek(session, event.target.value);
                                    }}
                                    disabled={assigningWeek || physicalSavingWeekGroup || physicalDeletingWeekId.length > 0}
                                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 disabled:bg-slate-100"
                                  >
                                    <option value="">No Week</option>
                                    {physicalReportGroups.map((group) => (
                                      <option key={`${session.key}-${group.id}`} value={group.id}>
                                        {group.name}
                                      </option>
                                    ))}
                                  </select>
                                  {assigningWeek ? (
                                    <span className="text-[10px] font-semibold text-indigo-600">Saving...</span>
                                  ) : linkedWeekName ? (
                                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
                                      {linkedWeekName}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-middle">
                                <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700">
                                  {session.readableId}
                                </span>
                              </td>
                              <td className="px-3 py-2 align-middle">
                                <Link
                                  to={getMarkAttendancePathForSession(session)}
                                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                  Mark Attendance
                                </Link>
                              </td>
                              <td className="px-3 py-2 align-middle">
                                <button
                                  type="button"
                                  onClick={() => handlePreviewPhysicalSession(session)}
                                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                >
                                  Preview Here
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Week Group Builder</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Create week names here, then assign sessions from the session-table dropdown.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadPhysicalWeekPreview()}
                    disabled={physicalWeekPreviewLoading || physicalWeekGroups.length === 0}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                  >
                    {physicalWeekPreviewLoading ? 'Loading Week Preview...' : 'Load Week Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportPhysicalWeekPreviewXlsx()}
                    disabled={
                      physicalWeekPreviewLoading
                      || !physicalWeekPreviewLoaded
                      || physicalWeekOrderedSessions.length === 0
                      || physicalVisibleWeekPreviewRows.length === 0
                    }
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Export Week XLSX
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPhysicalWeekBuilderOpen((prev) => !prev);
                    setPhysicalGroupError('');
                  }}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  {physicalWeekBuilderOpen ? 'Close Group Builder' : 'Create Group'}
                </button>
                <p className="text-[11px] text-slate-500">
                  Weeks appear below. Select only the weeks you need for week-wise report.
                </p>
              </div>

              {physicalGroupError && (
                <p className="text-xs font-medium text-red-600">{physicalGroupError}</p>
              )}
              {physicalWeeksError && (
                <p className="text-xs font-medium text-red-600">{physicalWeeksError}</p>
              )}
              {physicalWeeksLoading && (
                <p className="text-xs text-slate-500">Loading saved weeks...</p>
              )}

              <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                    Select Weeks For Report ({physicalSelectedWeekIds.length}/{physicalReportGroups.length})
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={selectAllPhysicalReportWeeks}
                      disabled={physicalReportGroups.length === 0}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearPhysicalReportWeekSelection}
                      disabled={physicalSelectedWeekIds.length === 0}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  Week selection here affects report preview only. Session week assignments stay unchanged.
                </p>

                {physicalReportGroups.length === 0 ? (
                  <p className="text-xs text-slate-500">No saved week groups yet. Use Create Group to create a week, then assign sessions from the session table.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {physicalReportGroups.map((group) => {
                      const selected = physicalSelectedWeekIds.includes(group.id);

                      return (
                        <span
                          key={group.id}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            selected
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-50 text-slate-500'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => togglePhysicalReportWeekSelection(group.id)}
                            className="font-semibold"
                            aria-label={`Toggle ${group.name}`}
                          >
                            {selected ? 'Selected: ' : ''}{group.name} ({group.slotKeys.length})
                          </button>
                          {selected && (
                            <button
                              type="button"
                              onClick={() => removePhysicalReportWeekSelection(group.id)}
                              className="text-slate-500/80 hover:text-slate-700"
                              aria-label={`Unselect ${group.name} from report`}
                            >
                              x
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {physicalWeekBuilderOpen && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-2.5 space-y-2">
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="text-[11px] font-semibold text-slate-500">
                      Week Name
                      <input
                        type="text"
                        value={physicalGroupName}
                        onChange={(event) => setPhysicalGroupName(event.target.value)}
                        placeholder={`Week ${physicalReportGroups.length + 1}`}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                      />
                    </label>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => void addPhysicalReportGroup()}
                        disabled={physicalSavingWeekGroup}
                        className="rounded-lg border border-indigo-200 bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {physicalSavingWeekGroup ? 'Creating...' : 'Create Week'}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-indigo-800/80">
                    After creating a week, go to <span className="font-semibold">Attendance Sessions (Class Level)</span> and use the <span className="font-semibold">Week Assign</span> dropdown in each row.
                  </p>

                  {physicalReportGroups.length > 0 && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-2.5 space-y-2">
                      <p className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide">
                        Delete Week Group (will unassign linked sessions)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {physicalReportGroups.map((group) => (
                          <button
                            key={`delete-week-${group.id}`}
                            type="button"
                            onClick={() => void removePhysicalReportGroup(group.id)}
                            disabled={physicalDeletingWeekId === group.id}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            {physicalDeletingWeekId === group.id ? 'Deleting...' : `Delete ${group.name}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {physicalWeekPreviewError && (
                <p className="text-xs font-medium text-red-600">{physicalWeekPreviewError}</p>
              )}

              {physicalWeekPreviewLoading ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  Loading week-wise attendance preview...
                </div>
              ) : !physicalWeekPreviewLoaded ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                  <p className="text-sm font-medium text-slate-500">Week-wise preview is not loaded</p>
                  <p className="text-xs text-slate-400 mt-1">Select saved weeks and click Load Week Preview.</p>
                </div>
              ) : physicalWeekOrderedSessions.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                  <p className="text-sm font-medium text-slate-500">No grouped sessions to display</p>
                </div>
              ) : physicalVisibleWeekPreviewRows.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                  <p className="text-sm font-medium text-slate-500">No students found for this search</p>
                  <p className="text-xs text-slate-400 mt-1">Change search text to show students.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-xs border-separate border-spacing-0">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th
                          rowSpan={2}
                          className="sticky left-0 z-10 border-r border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold"
                        >
                          Student
                        </th>
                        {physicalWeekGroups.map((group) => (
                          <th
                            key={`${group.id}-header`}
                            colSpan={group.sessions.length}
                            className="border-l border-slate-200 px-3 py-2 text-center font-semibold whitespace-nowrap"
                          >
                            {group.name}
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {physicalWeekGroups.flatMap((group) => group.sessions.map((session) => {
                          const sessionLabel = session.sessionCode
                            ? `${session.date} ${session.sessionTime} · ${session.sessionCode}`
                            : `${session.date}${session.sessionTime !== '00:00' ? ` ${session.sessionTime}` : ''}`;

                          return (
                            <th
                              key={`${group.id}-${session.key}-session-header`}
                              className="border-l border-slate-200 px-2.5 py-2 text-center font-semibold whitespace-nowrap"
                            >
                              {sessionLabel}
                            </th>
                          );
                        }))}
                      </tr>
                    </thead>
                    <tbody>
                      {physicalVisibleWeekPreviewRows.map((student) => {
                        const initials = student.fullName
                          .split(' ')
                          .map((part) => part.trim())
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0]?.toUpperCase() || '')
                          .join('') || '?';

                        return (
                          <tr key={`week-preview-${student.userId}`} className="border-t border-slate-100">
                            <td className="sticky left-0 z-[1] border-r border-slate-200 bg-white px-3 py-2.5 align-middle">
                              <div className="flex min-w-[240px] items-center gap-2.5">
                                {student.avatarUrl ? (
                                  <img
                                    src={student.avatarUrl}
                                    alt={student.fullName}
                                    className="h-8 w-8 rounded-full object-cover border border-slate-200"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full border border-slate-200 bg-slate-100 text-slate-600 text-[10px] font-semibold flex items-center justify-center">
                                    {initials}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-800">{student.fullName}</p>
                                  <p className="truncate text-[11px] text-slate-500">
                                    ID: {student.instituteId}
                                    {student.phone ? ` | ${student.phone}` : ''}
                                    {student.barcodeId ? ` | ${student.barcodeId}` : ''}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {physicalWeekOrderedSessions.map((session) => {
                              const status = student.statuses?.[session.key] || 'NOT_MARKED';
                              return (
                                <td key={`week-preview-${student.userId}-${session.key}`} className="border-l border-slate-100 px-2.5 py-2 text-center align-middle">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PHYSICAL_STATUS_BADGE[status]}`}>
                                    {PHYSICAL_STATUS_LABEL[status]}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div id="physical-selected-session-preview" className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Selected Session Attendance</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {physicalQuickSelectedSession
                      ? formatPhysicalSlotLabel(physicalQuickSelectedSession)
                      : 'Select one session from the table above to view student attendance.'}
                  </p>
                  {physicalQuickSelectedSession && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Session ID: <span className="font-mono text-slate-700">{physicalQuickSelectedSession.readableId}</span>
                    </p>
                  )}
                  {physicalQuickSelectedSession && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Update each student status and attendance time before closing this session.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPhysicalSessionManualMode((prev) => !prev)}
                    disabled={!physicalQuickSelectedSession || physicalSessionLoading || physicalSessionClosing || physicalSessionBatchSaving}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${physicalSessionManualMode
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {physicalSessionManualMode ? 'Mark Manually: ON' : 'Mark Manually'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleBatchSavePhysicalSessionAttendance()}
                    disabled={!physicalQuickSelectedSession || !physicalSessionManualMode || physicalSessionLoading || physicalSessionClosing || physicalSessionBatchSaving || physicalSessionPendingRows.length === 0}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {physicalSessionBatchSaving
                      ? 'Marking Attendance...'
                      : `Mark Attendance${physicalSessionPendingRows.length > 0 ? ` (${physicalSessionPendingRows.length})` : ''}`}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCloseSelectedPhysicalSession()}
                    disabled={!physicalQuickSelectedSession || physicalSessionClosing || physicalSessionLoading || physicalSessionBatchSaving || physicalSessionSavingUserIds.length > 0}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    {physicalSessionClosing ? 'Closing Session...' : 'Close Session'}
                  </button>
                </div>
              </div>

              <label className="text-[11px] font-semibold text-slate-500">
                Search students
                <input
                  type="text"
                  value={physicalSearchText}
                  onChange={(event) => setPhysicalSearchText(event.target.value)}
                  placeholder="Name, ID, phone, barcode"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                />
              </label>

              {physicalSessionError && (
                <p className="text-xs font-medium text-red-600">{physicalSessionError}</p>
              )}
              {physicalSessionCloseMessage && (
                <p className="text-xs font-medium text-emerald-700">{physicalSessionCloseMessage}</p>
              )}
              {physicalSessionManualMode && physicalSessionPendingRows.length > 0 && (
                <p className="text-xs font-medium text-amber-700">
                  {physicalSessionPendingRows.length} pending change{physicalSessionPendingRows.length === 1 ? '' : 's'} ready to save. Click Mark Attendance.
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] text-slate-500">Students</p>
                  <p className="text-sm font-semibold text-slate-700">{physicalSessionStatusSummary.total}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] text-emerald-700">Present</p>
                  <p className="text-sm font-semibold text-emerald-700">{physicalSessionStatusSummary.present}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[11px] text-amber-700">Late</p>
                  <p className="text-sm font-semibold text-amber-700">{physicalSessionStatusSummary.late}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-[11px] text-red-700">Absent</p>
                  <p className="text-sm font-semibold text-red-700">{physicalSessionStatusSummary.absent}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="text-[11px] text-blue-700">Excused</p>
                  <p className="text-sm font-semibold text-blue-700">{physicalSessionStatusSummary.excused}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">
                  <p className="text-[11px] text-slate-600">Not Marked</p>
                  <p className="text-sm font-semibold text-slate-700">{physicalSessionStatusSummary.notMarked}</p>
                </div>
              </div>

              {!physicalQuickSelectedSession ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                  <p className="text-sm font-medium text-slate-500">Select a session to view attendance list</p>
                  <p className="text-xs text-slate-400 mt-1">Use the Select button in the table above.</p>
                </div>
              ) : physicalSessionLoading ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  Loading selected session attendance...
                </div>
              ) : physicalVisibleSessionRows.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                  <p className="text-sm font-medium text-slate-500">No students found for this search</p>
                  <p className="text-xs text-slate-400 mt-1">Change the search text to show students.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <div className="max-h-[430px] overflow-y-auto divide-y divide-slate-100">
                    {physicalVisibleSessionRows.map((student) => {
                      const initials = student.fullName
                        .split(' ')
                        .map((part) => part.trim())
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase() || '')
                        .join('') || '?';
                      const draftStatus = physicalSessionDraftStatus[student.userId] || 'NOT_MARKED';
                      const draftMarkedAt = physicalSessionDraftMarkedAt[student.userId] || '';
                      const saving = physicalSessionSavingUserIds.includes(student.userId);
                      const editingTime = physicalSessionEditingTimeUserIds.includes(student.userId);
                      const canEditTime = draftStatus !== 'NOT_MARKED';
                      const hasPendingChange = physicalSessionPendingUserIdSet.has(student.userId);

                      return (
                        <div
                          key={student.userId}
                          className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${hasPendingChange ? 'bg-amber-50/70' : ''}`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {student.avatarUrl ? (
                              <img
                                src={student.avatarUrl}
                                alt={student.fullName}
                                className="h-10 w-10 rounded-full object-cover border border-slate-200"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full border border-slate-200 bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center">
                                {initials}
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">{student.fullName}</p>
                              <p className="truncate text-[11px] text-slate-500">
                                ID: {student.instituteId}
                                {student.phone ? ` | ${student.phone}` : ''}
                                {student.barcodeId ? ` | ${student.barcodeId}` : ''}
                              </p>
                              <p className="truncate text-[10px] text-slate-400">
                                Marked time: {formatDateTimeLabel(student.markedAt)}
                              </p>
                            </div>
                          </div>

                          <div className="flex w-full flex-col items-start gap-1.5 sm:w-auto sm:items-end">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PHYSICAL_STATUS_BADGE[student.status]}`}>
                              {PHYSICAL_STATUS_LABEL[student.status]}
                            </span>

                            {physicalSessionManualMode && (
                              <>
                                <div className="flex flex-wrap items-center gap-1">
                                  {PHYSICAL_EDITABLE_STATUSES.map((statusOption) => {
                                    const active = draftStatus === statusOption;
                                    const toneClass = active
                                      ? PHYSICAL_STATUS_BADGE[statusOption]
                                      : 'border-slate-200 bg-white text-slate-500';

                                    return (
                                      <button
                                        key={`session-status-${student.userId}-${statusOption}`}
                                        type="button"
                                        onClick={() => {
                                          applyPhysicalSessionStudentDraftStatus(student, statusOption);
                                        }}
                                        disabled={saving || physicalSessionLoading || physicalSessionBatchSaving}
                                        className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition hover:brightness-[0.98] disabled:opacity-60 ${toneClass}`}
                                      >
                                        {PHYSICAL_STATUS_LABEL[statusOption]}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Time</span>

                                  {editingTime ? (
                                    <>
                                      <input
                                        type="datetime-local"
                                        value={draftMarkedAt}
                                        onChange={(event) => {
                                          setPhysicalSessionDraftMarkedAt((prev) => ({
                                            ...prev,
                                            [student.userId]: event.target.value,
                                          }));
                                        }}
                                        className="h-8 min-w-[174px] rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700"
                                      />

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPhysicalSessionEditingTimeUserIds((prev) => prev.filter((userId) => userId !== student.userId));
                                        }}
                                        disabled={saving || physicalSessionLoading || physicalSessionBatchSaving || !canEditTime}
                                        className="h-8 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                      >
                                        Done
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPhysicalSessionEditingTimeUserIds((prev) => prev.filter((userId) => userId !== student.userId));
                                          setPhysicalSessionDraftMarkedAt((prev) => ({
                                            ...prev,
                                            [student.userId]: student.markedAt
                                              ? toLocalDateTimeInputValue(student.markedAt)
                                              : selectedPhysicalSessionDefaultMarkedAtInput,
                                          }));
                                        }}
                                        disabled={saving || physicalSessionLoading || physicalSessionBatchSaving}
                                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700">
                                        {draftMarkedAt ? formatDateTimeLabel(draftMarkedAt) : 'Not marked'}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!canEditTime) return;
                                          if (!draftMarkedAt && selectedPhysicalSessionDefaultMarkedAtInput) {
                                            setPhysicalSessionDraftMarkedAt((prev) => ({
                                              ...prev,
                                              [student.userId]: selectedPhysicalSessionDefaultMarkedAtInput,
                                            }));
                                          }
                                          setPhysicalSessionEditingTimeUserIds((prev) => (
                                            prev.includes(student.userId)
                                              ? prev
                                              : [...prev, student.userId]
                                          ));
                                        }}
                                        disabled={!canEditTime || saving || physicalSessionLoading || physicalSessionBatchSaving}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                                        title="Edit attendance time"
                                      >
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.25 2.25 0 113.182 3.182L7.5 20.213 3 21l.787-4.5 13.075-12.013z" />
                                        </svg>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            </div>

            {tab === 'payments' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Class Payment Status</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Student-wise month matrix for this class. Each month shows Paid, Pending, or Unpaid.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start md:self-center">
                    <p className="text-[11px] text-slate-500">Months: {physicalPaymentMonths.length}</p>
                    <button
                      type="button"
                      onClick={() => void exportPhysicalPaymentsXlsx()}
                      disabled={physicalPaymentExporting || physicalPaymentLoading || physicalVisiblePaymentRows.length === 0}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {physicalPaymentExporting ? 'Exporting...' : 'Export Excel'}
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)]">
                  <label className="text-[11px] font-semibold text-slate-500">
                    Overall Status
                    <select
                      value={physicalPaymentStatusFilter}
                      onChange={(event) => setPhysicalPaymentStatusFilter(event.target.value as ClassPaymentStatusFilter)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                    >
                      <option value="ALL">All</option>
                      <option value="PAID">Paid</option>
                      <option value="PENDING">Pending</option>
                      <option value="UNPAID">Unpaid</option>
                    </select>
                  </label>

                  <label className="text-[11px] font-semibold text-slate-500">
                    Search students
                    <input
                      type="text"
                      value={physicalPaymentSearchText}
                      onChange={(event) => setPhysicalPaymentSearchText(event.target.value)}
                      placeholder="Name, ID, phone, barcode"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                    />
                  </label>
                </div>

                {physicalPaymentError && (
                  <p className="text-xs font-medium text-red-600">{physicalPaymentError}</p>
                )}
                {physicalPaymentExportError && (
                  <p className="text-xs font-medium text-red-600">{physicalPaymentExportError}</p>
                )}

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] text-slate-500">Students</p>
                    <p className="text-sm font-semibold text-slate-700">{physicalPaymentSummary.total}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-[11px] text-emerald-700">Paid</p>
                    <p className="text-sm font-semibold text-emerald-700">{physicalPaymentSummary.paid}</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-[11px] text-amber-700">Pending</p>
                    <p className="text-sm font-semibold text-amber-700">{physicalPaymentSummary.pending}</p>
                  </div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                    <p className="text-[11px] text-rose-700">Unpaid</p>
                    <p className="text-sm font-semibold text-rose-700">{physicalPaymentSummary.unpaid}</p>
                  </div>
                </div>

                {physicalPaymentLoading ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
                    Loading class payment status...
                  </div>
                ) : physicalVisiblePaymentRows.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                    <p className="text-sm font-medium text-slate-500">No payment rows found</p>
                    <p className="text-xs text-slate-400 mt-1">Change status filter or search text.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="space-y-2 md:hidden">
                      {physicalVisiblePaymentRows.map((student) => {
                        const initials = student.fullName
                          .split(' ')
                          .map((part) => part.trim())
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0]?.toUpperCase() || '')
                          .join('') || '?';
                        const overallStatus = resolveClassPaymentOverallStatus(student);
                        const monthStatusMap = new Map(
                          student.months.map((month) => [month.monthId, month.status] as const),
                        );

                        return (
                          <div key={`payment-mobile-${student.userId}`} className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex items-start gap-2.5">
                              {student.avatarUrl ? (
                                <img
                                  src={student.avatarUrl}
                                  alt={student.fullName}
                                  className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="h-9 w-9 rounded-full border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-600 flex items-center justify-center">
                                  {initials}
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="truncate text-xs font-semibold text-slate-800">{student.fullName}</p>
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CLASS_PAYMENT_STATUS_BADGE[overallStatus]}`}>
                                    {CLASS_PAYMENT_STATUS_LABEL[overallStatus]}
                                  </span>
                                </div>
                                <p className="mt-0.5 break-words text-[11px] text-slate-500">
                                  ID: {student.instituteId}
                                  {student.phone ? ` | ${student.phone}` : ''}
                                  {student.barcodeId ? ` | ${student.barcodeId}` : ''}
                                </p>
                              </div>
                            </div>

                            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1">
                                <p className="text-[10px] text-emerald-700">Paid</p>
                                <p className="text-xs font-semibold text-emerald-700">{student.paidCount}</p>
                              </div>
                              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1">
                                <p className="text-[10px] text-amber-700">Pending</p>
                                <p className="text-xs font-semibold text-amber-700">{student.pendingCount}</p>
                              </div>
                              <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1">
                                <p className="text-[10px] text-rose-700">Unpaid</p>
                                <p className="text-xs font-semibold text-rose-700">{student.unpaidCount}</p>
                              </div>
                            </div>

                            <div className="mt-2 space-y-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Month Status</p>
                              {physicalPaymentMonthsForMatrix.length === 0 ? (
                                <span className="text-[11px] text-slate-400">No months</span>
                              ) : (
                                <div className="grid gap-1.5 sm:grid-cols-2">
                                  {physicalPaymentMonthsForMatrix.map((month) => {
                                    const monthStatus = monthStatusMap.get(month.id) || 'UNPAID';

                                    return (
                                      <div key={`mobile-${student.userId}-${month.id}`} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                                        <span className="text-[10px] font-medium text-slate-600">{month.name} {month.year}</span>
                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CLASS_PAYMENT_STATUS_BADGE[monthStatus]}`}>
                                          {CLASS_PAYMENT_STATUS_LABEL[monthStatus]}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="hidden rounded-lg border border-slate-200 bg-white md:block">
                      <div className="max-h-[560px] overflow-auto">
                      <table className="min-w-max w-full text-xs border-separate border-spacing-0">
                        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
                          <tr>
                            <th className="sticky left-0 z-20 border-r border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold">Student</th>
                            {physicalPaymentMonthsForMatrix.map((month) => (
                              <th key={`payment-header-${month.id}`} className="border-l border-slate-200 px-3 py-2 text-center font-semibold whitespace-nowrap">
                                <div>{month.name}</div>
                                <div className="text-[10px] text-slate-500">{month.year}</div>
                              </th>
                            ))}
                            <th className="border-l border-slate-200 px-3 py-2 text-center font-semibold">Overall</th>
                          </tr>
                        </thead>
                        <tbody>
                          {physicalVisiblePaymentRows.map((student) => {
                            const initials = student.fullName
                              .split(' ')
                              .map((part) => part.trim())
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase() || '')
                              .join('') || '?';
                            const overallStatus = resolveClassPaymentOverallStatus(student);
                            const monthStatusMap = new Map(
                              student.months.map((month) => [month.monthId, month.status] as const),
                            );

                            return (
                              <tr key={`payment-${student.userId}`} className="border-t border-slate-100">
                                <td className="sticky left-0 z-[1] border-r border-slate-200 bg-white px-3 py-2.5 align-middle">
                                  <div className="flex items-center gap-2.5">
                                    {student.avatarUrl ? (
                                      <img
                                        src={student.avatarUrl}
                                        alt={student.fullName}
                                        className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="h-8 w-8 rounded-full border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-600 flex items-center justify-center">
                                        {initials}
                                      </div>
                                    )}

                                    <div className="min-w-0">
                                      <p className="truncate font-semibold text-slate-800">{student.fullName}</p>
                                      <p className="break-words text-[11px] text-slate-500">
                                        ID: {student.instituteId}
                                        {student.phone ? ` | ${student.phone}` : ''}
                                        {student.barcodeId ? ` | ${student.barcodeId}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                {physicalPaymentMonthsForMatrix.map((month) => {
                                  const monthStatus = monthStatusMap.get(month.id) || 'UNPAID';

                                  return (
                                    <td key={`payment-${student.userId}-${month.id}`} className="border-l border-slate-100 px-2.5 py-2.5 align-middle text-center">
                                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CLASS_PAYMENT_STATUS_BADGE[monthStatus]}`}>
                                        {CLASS_PAYMENT_STATUS_LABEL[monthStatus]}
                                      </span>
                                    </td>
                                  );
                                })}

                                <td className="border-l border-slate-100 px-3 py-2.5 align-middle text-center">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CLASS_PAYMENT_STATUS_BADGE[overallStatus]}`}>
                                    {CLASS_PAYMENT_STATUS_LABEL[overallStatus]}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {false && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Recording Manage (Viewings Details)</h3>
                <p className="text-xs text-slate-400 mt-1">Student-wise preview, session details, and exports for recording activity.</p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setRecordingManageViewMode('STUDENT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${recordingManageViewMode === 'STUDENT' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Student Preview
                </button>
                <button
                  type="button"
                  onClick={() => setRecordingManageViewMode('SESSION')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${recordingManageViewMode === 'SESSION' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Session Details
                </button>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-[170px_210px_minmax(0,1fr)]">
              <label className="text-[11px] font-semibold text-slate-500">
                Month
                <select
                  value={recordingManageMonthFilter}
                  onChange={(event) => setRecordingManageMonthFilter(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                >
                  <option value="">All months</option>
                  {recordingManageMonthOptions.map((month) => (
                    <option key={month.id} value={month.id}>{month.name}</option>
                  ))}
                </select>
              </label>

              <label className="text-[11px] font-semibold text-slate-500">
                Recording
                <select
                  value={recordingManageRecordingFilter}
                  onChange={(event) => setRecordingManageRecordingFilter(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                >
                  <option value="">All recordings</option>
                  {recordingManageRecordingOptions.map((recording) => (
                    <option key={recording.id} value={recording.id}>{recording.title}</option>
                  ))}
                </select>
              </label>

              <label className="text-[11px] font-semibold text-slate-500">
                Search students or recordings
                <input
                  type="text"
                  value={recordingManageSearch}
                  onChange={(event) => setRecordingManageSearch(event.target.value)}
                  placeholder="Name, ID, phone, recording title"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => loadWatchSessions()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Refresh Sessions
              </button>
              <button
                type="button"
                onClick={exportRecordingSessionDetailsCsv}
                disabled={recordingManageFilteredSessions.length === 0}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                Export Session Details CSV
              </button>
              <button
                type="button"
                onClick={exportRecordingStudentPreviewCsv}
                disabled={recordingManageStudentRows.length === 0}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                Export Student Preview CSV
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Sessions</p>
                <p className="text-sm font-semibold text-slate-700">{recordingManageSummary.totalSessions}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Students</p>
                <p className="text-sm font-semibold text-slate-700">{recordingManageSummary.uniqueStudents}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Recordings</p>
                <p className="text-sm font-semibold text-slate-700">{recordingManageSummary.uniqueRecordings}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Total Watch</p>
                <p className="text-sm font-semibold text-emerald-700">{fmtTime(recordingManageSummary.totalWatchedSec)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Avg / Student</p>
                <p className="text-sm font-semibold text-indigo-700">{fmtTime(recordingManageSummary.averagePerStudentSec)}</p>
              </div>
            </div>

            {watchSessions.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-500">No recording watch sessions yet</p>
                <p className="text-xs text-slate-400 mt-1">Sessions will appear when students start watching class recordings.</p>
              </div>
            ) : recordingManageFilteredSessions.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-500">No sessions match your current filters</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing month/recording filter or search text.</p>
              </div>
            ) : recordingManageViewMode === 'STUDENT' ? (
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <StickyDataTable
                  columns={recordingStudentPreviewColumns}
                  rows={recordingManageStudentRows}
                  getRowId={(row) => row.rowId}
                  tableHeight="calc(100vh - 500px)"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <StickyDataTable
                  columns={watchColumns}
                  rows={recordingManageFilteredSessions.map((session) => session.raw)}
                  getRowId={(row) => row.id}
                  tableHeight="calc(100vh - 500px)"
                />
              </div>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
}


