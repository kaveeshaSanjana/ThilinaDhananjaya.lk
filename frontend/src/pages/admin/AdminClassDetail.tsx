import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
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

const PAYMENT_TYPE_META: Record<EnrollmentPaymentType, { label: string; badge: string }> = {
  FULL: { label: 'Full', badge: 'bg-blue-100 text-blue-700' },
  HALF: { label: 'Half', badge: 'bg-amber-100 text-amber-700' },
  FREE: { label: 'Free Card', badge: 'bg-emerald-100 text-emerald-700' },
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
}

const PHYSICAL_STATUS_LABEL: Record<PhysicalCellStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  EXCUSED: 'Excused',
  NOT_MARKED: 'Not Marked',
};

function formatPhysicalSlotLabel(slot: Pick<PhysicalMonitorSlot, 'date' | 'sessionTime' | 'sessionCode'>) {
  const code = typeof slot.sessionCode === 'string' ? slot.sessionCode.trim() : '';
  if (code) return code;

  const time = slot.sessionTime && slot.sessionTime !== '00:00' ? ` ${slot.sessionTime}` : '';
  return `${slot.date}${time}`;
}

function asIsoDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const shortIso = trimmed.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(shortIso) ? shortIso : '';
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

type Tab = 'months' | 'recordings' | 'students' | 'attendance';

const emptyMonthForm = { name: '', year: new Date().getFullYear().toString(), month: (new Date().getMonth() + 1).toString(), status: 'ANYONE' };
const emptyRecForm = { monthId: '', title: '', description: '', videoUrl: '', thumbnail: '', topic: '', icon: '', materials: '', status: 'PAID_ONLY' };

export default function AdminClassDetail() {
  const { id, instituteId } = useParams();
  const [cls, setCls] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('months');

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
  const [physicalReportGroups, setPhysicalReportGroups] = useState<PhysicalReportGroup[]>([]);
  const [physicalMonitor, setPhysicalMonitor] = useState<{
    slots: PhysicalMonitorSlot[];
    students: PhysicalMonitorStudent[];
  } | null>(null);
  const [physicalSearchText, setPhysicalSearchText] = useState('');
  const [physicalFocusedSlotKey, setPhysicalFocusedSlotKey] = useState('');

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
    if (tab !== 'attendance' || !id) {
      setPhysicalAvailableDates([]);
      setPhysicalFromDate('');
      setPhysicalToDate('');
      setPhysicalPreviewLoaded(false);
      setPhysicalPreviewError('');
      setPhysicalGroupName('');
      setPhysicalGroupSelectedSlots([]);
      setPhysicalGroupError('');
      setPhysicalReportGroups([]);
      setPhysicalMonitor(null);
      setPhysicalFocusedSlotKey('');
      return;
    }

    let active = true;

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
        setPhysicalReportGroups([]);
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
        setPhysicalReportGroups([]);
        setPhysicalMonitor(null);
        setPhysicalFocusedSlotKey('');
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

  const addPhysicalReportGroup = () => {
    const slotKeySet = new Set((physicalMonitor?.slots || []).map((slot) => slot.key));
    const selectedKeys = physicalGroupSelectedSlots.filter((slotKey) => slotKeySet.has(slotKey));

    if (selectedKeys.length === 0) {
      setPhysicalGroupError('Select at least one session or date before creating a group.');
      return;
    }

    const trimmedName = physicalGroupName.trim();
    const groupName = trimmedName || `Group ${physicalReportGroups.length + 1}`;

    setPhysicalReportGroups((prev) => ([
      ...prev,
      {
        id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: groupName,
        slotKeys: selectedKeys,
      },
    ]));

    setPhysicalGroupName('');
    setPhysicalGroupSelectedSlots([]);
    setPhysicalGroupError('');
  };

  const removePhysicalReportGroup = (groupId: string) => {
    setPhysicalReportGroups((prev) => prev.filter((group) => group.id !== groupId));
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
          .filter((date) => date >= from && date <= to)
          .map((date) => ({
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
        const topRecording = Object.values(row.recordingWatch)
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
        {([['months', 'Months'], ['recordings', 'Recordings'], ['students', 'Students'], ['attendance', 'Attendance']] as [Tab, string][]).map(([key, lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 min-w-[4.5rem] px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {lbl}
            {key === 'months' && <span className="ml-1.5 text-slate-400">({months.length})</span>}
            {key === 'recordings' && <span className="ml-1.5 text-slate-400">({recordings.length})</span>}
            {key === 'students' && <span className="ml-1.5 text-slate-400">({enrollments.length})</span>}
            {key === 'attendance' && <span className="ml-1.5 text-slate-400">({physicalMonitor?.slots.length || physicalAvailableDates.length})</span>}
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
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Student Reports</h3>
                  <p className="text-xs text-slate-400">Export PDF reports for one student or multiple students.</p>
                </div>
                <div className="text-xs text-slate-500">
                  Selected: <span className="font-semibold text-slate-700">{selectedReportCount}</span> total
                  <span className="ml-2 text-slate-400">Filtered: {selectedFilteredReportCount}/{filteredReportUserIds.length}</span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="inline-flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={reportIncludePhysicalAttendance}
                    onChange={(event) => setReportIncludePhysicalAttendance(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    Include physical attendance
                    <span className="block text-[11px] text-slate-400">Summary and date-wise status</span>
                  </span>
                </label>

                <label className="inline-flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={reportIncludePayments}
                    onChange={(event) => setReportIncludePayments(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    Include payment history
                    <span className="block text-[11px] text-slate-400">Monthly payment status and latest transactions</span>
                  </span>
                </label>

                <label className="inline-flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={reportIncludeRecordingAttendance}
                    onChange={(event) => setReportIncludeRecordingAttendance(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    Include recordings watch summary
                    <span className="block text-[11px] text-slate-400">Total watch duration and watched status per recording</span>
                  </span>
                </label>
              </div>

              {reportIncludeRecordingAttendance && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Recording mode
                    <select
                      value={reportRecordingMode}
                      onChange={(event) => setReportRecordingMode(event.target.value as RecordingReportMode)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                    >
                      <option value="SUMMARY">Summary only (compact)</option>
                      <option value="FULL">Detailed watch logs</option>
                    </select>
                  </label>
                  <p className="text-[11px] text-slate-400 self-end">
                    Detailed mode includes each watch session row and can produce larger PDFs.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAllFilteredReports(!allFilteredSelectedForReports)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {allFilteredSelectedForReports ? 'Clear filtered selection' : 'Select all filtered students'}
                </button>

                <button
                  type="button"
                  onClick={clearSelectedReports}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  disabled={selectedReportCount === 0}
                >
                  Reset selection
                </button>

                <button
                  type="button"
                  onClick={() => void exportBatchStudentReports('selected')}
                  disabled={reporting || selectedReportCount === 0}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reporting ? 'Preparing ZIP...' : `Export Selected (${selectedReportCount})`}
                </button>

                <button
                  type="button"
                  onClick={() => void exportBatchStudentReports('filtered')}
                  disabled={reporting || filteredReportUserIds.length === 0}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reporting ? 'Preparing ZIP...' : `Export Filtered (${filteredReportUserIds.length})`}
                </button>
              </div>

              {!reportIncludePayments && !reportIncludePhysicalAttendance && !reportIncludeRecordingAttendance && (
                <p className="text-xs text-red-500">Select at least one report section before exporting.</p>
              )}

              {reportProgress && (
                <p className="text-xs text-indigo-600">{reportProgress}</p>
              )}

              {reportSuccess && (
                <p className="text-xs text-emerald-600">{reportSuccess}</p>
              )}

              {reportError && (
                <p className="text-xs text-red-500">{reportError}</p>
              )}

              {reportWarning && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 whitespace-pre-line">
                  {reportWarning}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Student Reports</h3>
                <p className="text-xs text-slate-400">Use Advanced mode to export and customize report content.</p>
              </div>
              <button
                type="button"
                onClick={() => setStudentsViewMode('ADVANCED')}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 w-fit"
              >
                Open Advanced Reports
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {enrollments.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <p className="text-sm font-medium text-slate-500">No students enrolled yet</p>
                <p className="text-xs text-slate-400 mt-1">Use the form above to enroll students</p>
              </div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M6 12h12M10 17h4" /></svg>
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
      {tab === 'attendance' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Physical Attendance (Class Wise)</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Create attendance report groups from selected sessions or dates, then compare grouped attendance quickly.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={getInstituteAdminPath(instituteId, `/mark-attendance?classId=${encodeURIComponent(id || '')}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Mark Attendance (Scanner)
                </Link>
                <Link
                  to={getInstituteAdminPath(instituteId, `/mark-attendance/external-device?classId=${encodeURIComponent(id || '')}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  Mark Attendance (External)
                </Link>
                <Link
                  to={getInstituteAdminPath(instituteId, `/mark-attendance?classId=${encodeURIComponent(id || '')}&mode=advanced`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                >
                  Create Session
                </Link>
                <Link
                  to={getInstituteAdminPath(instituteId, `/class-attendance?classId=${encodeURIComponent(id || '')}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  Full Attendance View + XLSX
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
              <div className="grid gap-2 md:grid-cols-[160px_160px_minmax(0,1fr)]">
                <label className="text-[11px] font-semibold text-slate-500">
                  From
                  <input
                    type="date"
                    value={physicalFromDate}
                    min={physicalAvailableDates[0] || undefined}
                    max={physicalAvailableDates[physicalAvailableDates.length - 1] || undefined}
                    onChange={(event) => setPhysicalFromDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                  />
                </label>
                <label className="text-[11px] font-semibold text-slate-500">
                  To
                  <input
                    type="date"
                    value={physicalToDate}
                    min={physicalAvailableDates[0] || undefined}
                    max={physicalAvailableDates[physicalAvailableDates.length - 1] || undefined}
                    onChange={(event) => setPhysicalToDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                  />
                </label>
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
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadPhysicalAttendancePreview()}
                  disabled={physicalLoadingPreview}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {physicalLoadingPreview ? 'Loading...' : 'Load Preview'}
                </button>
                <button
                  type="button"
                  onClick={exportPhysicalAttendanceCsv}
                  disabled={!physicalPreviewLoaded || !physicalMonitor || physicalFilteredStudents.length === 0}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  Export CSV
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Available dates: <span className="font-semibold text-slate-700">{physicalAvailableDates.length}</span>
                {' '}| Loaded sessions: <span className="font-semibold text-slate-700">{physicalMonitor?.slots.length || 0}</span>
                {' '}| Report groups: <span className="font-semibold text-slate-700">{physicalReportGroups.length}</span>
              </p>

              {physicalPreviewLoaded && physicalMonitor && physicalMonitor.slots.length > 0 && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">Session List (Preview Scope)</p>
                    <p className="text-[11px] text-indigo-700">
                      Viewing:{' '}
                      <span className="font-semibold">
                        {physicalFocusedSlot ? formatPhysicalSlotLabel(physicalFocusedSlot) : `All sessions (${physicalMonitor.slots.length})`}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPhysicalFocusedSlotKey('')}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                        !physicalFocusedSlot
                          ? 'border-indigo-300 bg-indigo-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                    >
                      All Sessions
                    </button>
                    {physicalMonitor.slots.map((slot) => {
                      const selected = physicalFocusedSlotKey === slot.key;
                      const slotLabel = slot.sessionCode
                        ? `${slot.date} · ${slot.sessionCode}`
                        : `${slot.date}${slot.sessionTime !== '00:00' ? ` ${slot.sessionTime}` : ''}`;

                      return (
                        <button
                          key={slot.key}
                          type="button"
                          onClick={() => setPhysicalFocusedSlotKey(slot.key)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                            selected
                              ? 'border-indigo-300 bg-indigo-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                          }`}
                        >
                          {slotLabel}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-indigo-700">
                    Select one session to view student attendance for that day/session only, or keep all sessions for full-range reporting.
                  </p>
                </div>
              )}

              {physicalPreviewLoaded && physicalMonitor && physicalMonitor.slots.length > 0 && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Create Report Group</p>
                    <p className="text-[11px] text-blue-700">Selected sessions: {physicalGroupSelectedSlots.length}</p>
                  </div>

                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <input
                      type="text"
                      value={physicalGroupName}
                      onChange={(event) => setPhysicalGroupName(event.target.value)}
                      placeholder="Group name (e.g. Week 1)"
                      className="w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setPhysicalGroupSelectedSlots([])}
                      disabled={physicalGroupSelectedSlots.length === 0}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="button"
                      onClick={addPhysicalReportGroup}
                      className="rounded-lg border border-blue-200 bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Add Group
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(physicalSlotsByDate.keys()).sort().map((date) => {
                      const dateSlots = physicalSlotsByDate.get(date) || [];
                      const everySelected = dateSlots.length > 0 && dateSlots.every((slot) => physicalGroupSelectedSlots.includes(slot.key));
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => togglePhysicalGroupDate(date)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                            everySelected
                              ? 'border-indigo-300 bg-indigo-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                          }`}
                        >
                          {date} ({dateSlots.length})
                        </button>
                      );
                    })}
                  </div>

                  <div className="max-h-28 overflow-auto rounded-lg border border-blue-100 bg-white p-2">
                    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {physicalMonitor.slots.map((slot) => {
                        const selected = physicalGroupSelectedSlots.includes(slot.key);
                        return (
                          <button
                            key={slot.key}
                            type="button"
                            onClick={() => togglePhysicalGroupSlot(slot.key)}
                            className={`rounded-md border px-2 py-1.5 text-left text-[11px] transition ${
                              selected
                                ? 'border-blue-300 bg-blue-600 text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                            }`}
                          >
                            {formatPhysicalSlotLabel(slot)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {physicalGroupError && (
                    <p className="text-xs font-medium text-red-600">{physicalGroupError}</p>
                  )}

                  {physicalReportGroups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {physicalReportGroups.map((group) => (
                        <span
                          key={group.id}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                        >
                          {group.name} ({group.slotKeys.length})
                          <button
                            type="button"
                            onClick={() => removePhysicalReportGroup(group.id)}
                            className="text-emerald-700/80 hover:text-emerald-900"
                            aria-label={`Remove ${group.name}`}
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {physicalPreviewError && (
                <p className="text-xs font-medium text-red-600">{physicalPreviewError}</p>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Sessions In View</p>
                <p className="text-sm font-semibold text-slate-700">{physicalDisplaySlots.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Students</p>
                <p className="text-sm font-semibold text-slate-700">{physicalFilteredStudents.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Total Cells</p>
                <p className="text-sm font-semibold text-slate-700">{physicalSummary.totalCells}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Avg Attendance</p>
                <p className="text-sm font-semibold text-emerald-700">{physicalSummary.avgAttendance}%</p>
              </div>
            </div>

            {!physicalPreviewLoaded ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                <p className="text-sm font-medium text-slate-500">Load preview to see class-wise physical attendance.</p>
                <p className="text-xs text-slate-400 mt-1">Select a date range first, then build report groups from sessions or dates.</p>
              </div>
            ) : !physicalMonitor || physicalMonitor.slots.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                <p className="text-sm font-medium text-slate-500">No attendance sessions found</p>
                <p className="text-xs text-slate-400 mt-1">Try another date range.</p>
              </div>
            ) : physicalFilteredStudents.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                <p className="text-sm font-medium text-slate-500">No students match your search</p>
                <p className="text-xs text-slate-400 mt-1">Change search text to view rows.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <StickyDataTable
                  columns={physicalAttendanceColumns}
                  rows={physicalFilteredStudents}
                  getRowId={(row) => row.userId}
                  tableHeight="calc(100vh - 520px)"
                />
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


