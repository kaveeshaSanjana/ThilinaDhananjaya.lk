import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { getInstituteAdminPath } from '../../lib/instituteRoutes';

type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
type CellStatus = AttStatus | 'NOT_MARKED';

interface ClassItem {
  id: string;
  name: string;
  subject?: string;
}

interface MonitorStudent {
  userId: string;
  fullName: string;
  instituteId: string;
  avatarUrl: string | null;
  barcodeId: string | null;
  phone: string | null;
  statuses: Record<string, AttStatus>;
}

interface MonitorSlot {
  key: string;
  date: string;
  sessionTime: string;
  sessionCode: string | null;
  sessionAt: string | null;
  week: string;
  label: string;
}

interface MonitorResponse {
  dates: string[];
  slots: MonitorSlot[];
  students: MonitorStudent[];
}

const STATUS_META: Record<CellStatus, { label: string; short: string; pill: string }> = {
  PRESENT: {
    label: 'Present',
    short: 'P',
    pill: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  LATE: {
    label: 'Late',
    short: 'L',
    pill: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  ABSENT: {
    label: 'Absent',
    short: 'A',
    pill: 'bg-red-100 text-red-700 border-red-200',
  },
  EXCUSED: {
    label: 'Excused',
    short: 'E',
    pill: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  NOT_MARKED: {
    label: 'Not Marked',
    short: '-',
    pill: 'bg-slate-100 text-slate-500 border-slate-200',
  },
};

const STATUS_CSV_COLOR: Record<CellStatus, string> = {
  PRESENT: 'Green',
  LATE: 'Amber',
  ABSENT: 'Red',
  EXCUSED: 'Blue',
  NOT_MARKED: 'Gray',
};

const STATUS_XLSX_STYLE: Record<CellStatus, { fill: string; text: string }> = {
  PRESENT: { fill: 'FFE8F7ED', text: 'FF166534' },
  LATE: { fill: 'FFFFF4D6', text: 'FF92400E' },
  ABSENT: { fill: 'FFFDE8E8', text: 'FFB91C1C' },
  EXCUSED: { fill: 'FFE7F0FF', text: 'FF1D4ED8' },
  NOT_MARKED: { fill: 'FFF1F5F9', text: 'FF475569' },
};

const XLSX_BORDER_STYLE = {
  top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getIsoWeekLabel(dateText: string) {
  const date = new Date(`${dateText}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function asIsoDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const shortIso = trimmed.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(shortIso) ? shortIso : '';
}

function normalizeStatus(value: unknown): AttStatus | null {
  if (typeof value !== 'string') return null;
  if (value === 'PRESENT' || value === 'ABSENT' || value === 'LATE' || value === 'EXCUSED') return value;
  return null;
}

function normalizeClassItem(raw: unknown): ClassItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  const subject = typeof row.subject === 'string' ? row.subject.trim() : '';
  if (!id || !name) return null;
  return { id, name, subject: subject || undefined };
}

function normalizeMonitorResponse(payload: unknown): MonitorResponse {
  const raw = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const rawDates = Array.isArray(raw.dates) ? raw.dates : [];
  const dates = rawDates
    .map((item) => asIsoDate(item))
    .filter((item): item is string => Boolean(item));

  const rawSlots = Array.isArray(raw.slots) ? raw.slots : [];
  const slotsFromPayload = rawSlots
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const key = typeof row.key === 'string' ? row.key.trim() : '';
      const date = asIsoDate(row.date);
      if (!key || !date) return null;

      const sessionTime = typeof row.sessionTime === 'string' && row.sessionTime.trim()
        ? row.sessionTime.trim()
        : '00:00';
      const sessionCode = typeof row.sessionCode === 'string' && row.sessionCode.trim()
        ? row.sessionCode.trim()
        : null;
      const sessionAt = typeof row.sessionAt === 'string' && row.sessionAt.trim()
        ? row.sessionAt.trim()
        : null;
      const week = typeof row.week === 'string' && row.week.trim()
        ? row.week.trim()
        : getIsoWeekLabel(date);
      const label = typeof row.label === 'string' && row.label.trim()
        ? row.label.trim()
        : `${sessionCode || `${date}${sessionTime !== '00:00' ? ` ${sessionTime}` : ''}`}`;

      return {
        key,
        date,
        sessionTime,
        sessionCode,
        sessionAt,
        week,
        label,
      } satisfies MonitorSlot;
    })
    .filter((item): item is MonitorSlot => Boolean(item));

  const fallbackSlots = Array.from(new Set(dates)).sort().map((date) => ({
    key: date,
    date,
    sessionTime: '00:00',
    sessionCode: null,
    sessionAt: null,
    week: getIsoWeekLabel(date),
    label: date,
  } satisfies MonitorSlot));

  const slots = slotsFromPayload.length > 0 ? slotsFromPayload : fallbackSlots;

  const rawStudents = Array.isArray(raw.students) ? raw.students : [];
  const students = rawStudents
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const userId = typeof row.userId === 'string' ? row.userId.trim() : '';
      const fullName = typeof row.fullName === 'string' ? row.fullName.trim() : '';
      const instituteId = typeof row.instituteId === 'string' ? row.instituteId.trim() : '';
      const avatarUrl = typeof row.avatarUrl === 'string' ? row.avatarUrl.trim() : '';
      const barcodeId = typeof row.barcodeId === 'string' ? row.barcodeId.trim() : '';
      const phone = typeof row.phone === 'string' ? row.phone.trim() : '';

      if (!userId) return null;

      const rawStatuses = row.statuses && typeof row.statuses === 'object'
        ? (row.statuses as Record<string, unknown>)
        : {};

      const statuses: Record<string, AttStatus> = {};
      Object.entries(rawStatuses).forEach(([slotKey, statusValue]) => {
        const normalizedKey = typeof slotKey === 'string' ? slotKey.trim() : '';
        const status = normalizeStatus(statusValue);
        if (normalizedKey && status) statuses[normalizedKey] = status;
      });

      return {
        userId,
        fullName: fullName || userId,
        instituteId,
        avatarUrl: avatarUrl || null,
        barcodeId: barcodeId || null,
        phone: phone || null,
        statuses,
      } satisfies MonitorStudent;
    })
    .filter((item): item is MonitorStudent => Boolean(item));

  return {
    dates: Array.from(new Set(dates)).sort(),
    slots,
    students,
  };
}

function statusForSlot(student: MonitorStudent, slotKey: string): CellStatus {
  const status = student.statuses[slotKey];
  return status || 'NOT_MARKED';
}

function summarizeStudent(student: MonitorStudent, selectedSlots: MonitorSlot[]) {
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  selectedSlots.forEach((slot) => {
    const status = statusForSlot(student, slot.key);
    if (status === 'PRESENT') present += 1;
    else if (status === 'LATE') late += 1;
    else if (status === 'ABSENT') absent += 1;
    else if (status === 'EXCUSED') excused += 1;
  });

  const percentage = selectedSlots.length > 0
    ? Math.round(((present + late) / selectedSlots.length) * 100)
    : 0;

  return {
    present,
    late,
    absent,
    excused,
    percentage,
  };
}

function csvEscape(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function formatSlotHeader(slot: MonitorSlot) {
  const date = new Date(`${slot.date}T00:00:00`);
  const sessionLabel = slot.sessionCode || slot.date;
  const timeLabel = slot.sessionTime !== '00:00' ? slot.sessionTime : '';
  return {
    day: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    week: date.toLocaleDateString('en-GB', { weekday: 'short' }),
    session: sessionLabel,
    time: timeLabel,
    weekTag: slot.week,
  };
}

function toCsvStatusLabel(status: CellStatus) {
  return `${status} (${STATUS_CSV_COLOR[status]})`;
}

interface CalendarProps {
  year: number;
  month: number;
  selectedDateSet: Set<string>;
  availableDateSet: Set<string>;
  onToggleDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function MultiSelectCalendar({
  year,
  month,
  selectedDateSet,
  availableDateSet,
  onToggleDate,
  onPrevMonth,
  onNextMonth,
}: CalendarProps) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toIsoDate(new Date());

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDay; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={onPrevMonth}
          className="rounded-lg border border-[hsl(var(--border))] px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          Prev
        </button>
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{MONTHS[month]} {year}</p>
        <button
          onClick={onNextMonth}
          className="rounded-lg border border-[hsl(var(--border))] px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          Next
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {day}
          </div>
        ))}

        {cells.map((day, index) => {
          if (!day) {
            return <div key={`blank-${index}`} className="aspect-square" />;
          }

          const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = selectedDateSet.has(isoDate);
          const hasData = availableDateSet.has(isoDate);
          const isToday = isoDate === today;

          return (
            <button
              key={isoDate}
              onClick={() => onToggleDate(isoDate)}
              className={`relative aspect-square rounded-lg border text-xs font-semibold transition ${
                isSelected
                  ? 'border-blue-300 bg-blue-600 text-white shadow'
                  : isToday
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-transparent text-[hsl(var(--foreground))] hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
              }`}
            >
              {day}
              {hasData && (
                <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminPhysicalAttendanceView() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const [searchParams] = useSearchParams();

  const requestedClassId = (searchParams.get('classId') || '').trim();
  const now = new Date();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [viewMode, setViewMode] = useState<'simple' | 'advanced'>('simple');
  const [selectedClassId, setSelectedClassId] = useState('');

  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedError, setSelectedError] = useState('');

  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [monitorData, setMonitorData] = useState<MonitorResponse | null>(null);

  const [searchText, setSearchText] = useState('');
  const [tableFullscreen, setTableFullscreen] = useState(false);

  const adminBase = getInstituteAdminPath(instituteId);
  const markAttendancePath = getInstituteAdminPath(instituteId, '/mark-attendance');
  const externalDevicePath = getInstituteAdminPath(instituteId, '/mark-attendance/external-device');

  useEffect(() => {
    let active = true;
    setLoadingClasses(true);

    api.get('/classes')
      .then((response) => {
        if (!active) return;
        const rows = Array.isArray(response.data)
          ? response.data.map((item) => normalizeClassItem(item)).filter((item): item is ClassItem => Boolean(item))
          : [];

        setClasses(rows);

        if (rows.length === 0) {
          setSelectedClassId('');
          return;
        }

        if (requestedClassId && rows.some((row) => row.id === requestedClassId)) {
          setSelectedClassId(requestedClassId);
          return;
        }

        setSelectedClassId(rows[0].id);
      })
      .catch(() => {
        if (!active) return;
        setClasses([]);
        setSelectedClassId('');
      })
      .finally(() => {
        if (active) setLoadingClasses(false);
      });

    return () => {
      active = false;
    };
  }, [requestedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setAvailableDates([]);
      setSelectedDates([]);
      setRangeFrom('');
      setRangeTo('');
      setMonitorData(null);
      setPreviewLoaded(false);
      setPreviewError('');
      setTableFullscreen(false);
      return;
    }

    setSelectedDates([]);
    setRangeFrom('');
    setRangeTo('');
    setMonitorData(null);
    setPreviewLoaded(false);
    setPreviewError('');
    setSelectedError('');
    setTableFullscreen(false);
  }, [selectedClassId]);

  const isAdvancedMode = viewMode === 'advanced';

  useEffect(() => {
    if (!selectedClassId) {
      setAvailableDates([]);
      setSelectedDates([]);
      setRangeFrom('');
      setRangeTo('');
      return;
    }

    let active = true;
    setMonitorData(null);
    setPreviewLoaded(false);
    setPreviewError('');
    setSelectedError('');

    api.get(`/attendance/class-attendance/class/${selectedClassId}/dates`)
      .then((response) => {
        if (!active) return;

        const rows = Array.isArray(response.data)
          ? response.data.map((item) => asIsoDate(item)).filter((item): item is string => Boolean(item))
          : [];

        const uniqueSorted = Array.from(new Set(rows)).sort();
        setAvailableDates(uniqueSorted);
        setSelectedDates((prev) => prev.filter((item) => uniqueSorted.includes(item)));

        if (uniqueSorted.length > 0) {
          setRangeFrom((prev) => (prev && uniqueSorted.includes(prev) ? prev : uniqueSorted[0]));
          setRangeTo((prev) => (prev && uniqueSorted.includes(prev) ? prev : uniqueSorted[uniqueSorted.length - 1]));
        } else {
          setRangeFrom('');
          setRangeTo('');
        }

        if (uniqueSorted.length > 0) {
          const lastDate = uniqueSorted[uniqueSorted.length - 1];
          const date = new Date(`${lastDate}T00:00:00`);
          if (!Number.isNaN(date.getTime())) {
            setCalendarYear(date.getFullYear());
            setCalendarMonth(date.getMonth());
          }
        }
      })
      .catch(() => {
        if (!active) return;
        setAvailableDates([]);
        setSelectedDates([]);
        setRangeFrom('');
        setRangeTo('');
      });

    return () => {
      active = false;
    };
  }, [selectedClassId]);

  const selectedDateSet = useMemo(() => new Set(selectedDates), [selectedDates]);
  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);
  const selectedDatesSorted = useMemo(() => [...selectedDates].sort(), [selectedDates]);

  const previewDateCount = useMemo(() => {
    if (selectedDatesSorted.length > 0) return selectedDatesSorted.length;
    if (rangeFrom && rangeTo) {
      const start = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
      const end = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
      return availableDates.filter((date) => date >= start && date <= end).length;
    }
    return availableDates.length;
  }, [availableDates, rangeFrom, rangeTo, selectedDatesSorted]);

  const canLoadPreview = useMemo(() => {
    if (!selectedClassId) return false;
    if (selectedDatesSorted.length > 0) return true;
    if (rangeFrom && rangeTo) {
      const start = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
      const end = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
      return availableDates.some((date) => date >= start && date <= end);
    }
    return availableDates.length > 0;
  }, [availableDates, rangeFrom, rangeTo, selectedClassId, selectedDatesSorted]);

  const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-`;
  const monthMarkedDates = useMemo(
    () => availableDates.filter((date) => date.startsWith(monthPrefix)),
    [availableDates, monthPrefix],
  );

  const toggleDate = useCallback((date: string) => {
    setSelectedDates((prev) => {
      if (prev.includes(date)) return prev.filter((item) => item !== date);
      return [...prev, date];
    });
    setPreviewLoaded(false);
    setPreviewError('');
    setSelectedError('');
  }, []);

  const selectAllMonthMarkedDates = useCallback(() => {
    if (monthMarkedDates.length === 0) {
      setSelectedError('No marked dates available in this month.');
      return;
    }

    setSelectedDates((prev) => Array.from(new Set([...prev, ...monthMarkedDates])).sort());
    setPreviewLoaded(false);
    setPreviewError('');
    setSelectedError('');
  }, [monthMarkedDates]);

  const clearSelectedDates = useCallback(() => {
    setSelectedDates([]);
    setPreviewLoaded(false);
    setPreviewError('');
    setSelectedError('');
    setMonitorData(null);
  }, []);

  const applyDateRangeSelection = useCallback((append: boolean) => {
    if (!rangeFrom || !rangeTo) {
      setSelectedError('Select both From and To dates for range selection.');
      return;
    }

    const start = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
    const end = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
    const inRange = availableDates.filter((date) => date >= start && date <= end);

    if (inRange.length === 0) {
      setSelectedError('No marked dates found in the selected range.');
      return;
    }

    setSelectedDates((prev) => (append
      ? Array.from(new Set([...prev, ...inRange])).sort()
      : inRange));
    setPreviewLoaded(false);
    setPreviewError('');
    setSelectedError('');
  }, [availableDates, rangeFrom, rangeTo]);

  const loadPreview = useCallback(async () => {
    if (!selectedClassId) return;

    const requestSelection = (() => {
      if (selectedDatesSorted.length > 0) {
        return {
          from: selectedDatesSorted[0],
          to: selectedDatesSorted[selectedDatesSorted.length - 1],
          pickedDates: selectedDatesSorted,
        };
      }

      if (rangeFrom && rangeTo) {
        const start = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
        const end = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
        const inRange = availableDates.filter((date) => date >= start && date <= end);
        if (inRange.length > 0) {
          return {
            from: inRange[0],
            to: inRange[inRange.length - 1],
            pickedDates: inRange,
          };
        }
      }

      if (availableDates.length > 0) {
        return {
          from: availableDates[0],
          to: availableDates[availableDates.length - 1],
          pickedDates: availableDates,
        };
      }

      return null;
    })();

    if (!requestSelection) {
      setSelectedError(isAdvancedMode
        ? 'Select at least one date from the calendar.'
        : 'No marked dates found for the selected range.');
      setPreviewLoaded(false);
      setMonitorData(null);
      return;
    }

    if (selectedDatesSorted.length === 0) {
      setSelectedDates(requestSelection.pickedDates);
    }

    setLoadingPreview(true);
    setPreviewError('');
    setSelectedError('');

    try {
      const response = await api.get(`/attendance/class-attendance/class/${selectedClassId}/monitor`, {
        params: {
          from: requestSelection.from,
          to: requestSelection.to,
        },
      });

      setMonitorData(normalizeMonitorResponse(response.data));
      setPreviewLoaded(true);
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
          ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to load preview')
          : 'Failed to load preview';

      setPreviewLoaded(false);
      setMonitorData(null);
      setPreviewError(message);
    } finally {
      setLoadingPreview(false);
    }
  }, [
    availableDates,
    isAdvancedMode,
    rangeFrom,
    rangeTo,
    selectedClassId,
    selectedDatesSorted,
  ]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId],
  );

  useEffect(() => {
    if (!tableFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [tableFullscreen]);

  useEffect(() => {
    if (!tableFullscreen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTableFullscreen(false);
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [tableFullscreen]);

  const students = monitorData?.students || [];
  const selectedSlots = useMemo(() => {
    const allSlots = monitorData?.slots || [];
    return allSlots.filter((slot) => selectedDateSet.size === 0 || selectedDateSet.has(slot.date));
  }, [monitorData?.slots, selectedDateSet]);

  const filteredStudents = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) => {
      const fields = [student.fullName, student.instituteId, student.userId];
      return fields.some((field) => field.toLowerCase().includes(query));
    });
  }, [searchText, students]);

  const tableSummary = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;
    let notMarked = 0;

    filteredStudents.forEach((student) => {
      selectedSlots.forEach((slot) => {
        const status = statusForSlot(student, slot.key);
        if (status === 'PRESENT') present += 1;
        else if (status === 'LATE') late += 1;
        else if (status === 'ABSENT') absent += 1;
        else if (status === 'EXCUSED') excused += 1;
        else notMarked += 1;
      });
    });

    const totalCells = filteredStudents.length * selectedSlots.length;

    return {
      present,
      late,
      absent,
      excused,
      notMarked,
      totalCells,
    };
  }, [filteredStudents, selectedSlots]);

  const handleExportCsv = useCallback(() => {
    if (selectedSlots.length === 0 || filteredStudents.length === 0) return;

    const slotHeaders = selectedSlots.map((slot) => {
      const sessionLabel = slot.sessionCode || slot.date;
      const timeLabel = slot.sessionTime !== '00:00' ? ` ${slot.sessionTime}` : '';
      return `${slot.week} | ${sessionLabel}${timeLabel ? ` (${slot.date}${timeLabel})` : ''}`;
    });

    const headers = [
      'Student Name',
      'Institute ID',
      'User ID',
      ...slotHeaders,
      'Present',
      'Late',
      'Absent',
      'Excused',
      'Attendance %',
    ];

    const legendRow = [
      'Color Legend',
      'PRESENT=Green',
      'LATE=Amber',
      'ABSENT=Red',
      'EXCUSED=Blue',
      'NOT_MARKED=Gray',
    ];

    const rows = filteredStudents.map((student) => {
      const summary = summarizeStudent(student, selectedSlots);
      const statuses = selectedSlots.map((slot) => {
        const status = statusForSlot(student, slot.key);
        return toCsvStatusLabel(status);
      });

      return [
        student.fullName,
        student.instituteId || '',
        student.userId,
        ...statuses,
        summary.present,
        summary.late,
        summary.absent,
        summary.excused,
        `${summary.percentage}%`,
      ];
    });

    const csv = [legendRow, [], headers, ...rows]
      .map((row) => row.map((value) => csvEscape(value)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const from = selectedDatesSorted[0] || selectedSlots[0]?.date || 'from';
    const to = selectedDatesSorted[selectedDatesSorted.length - 1] || selectedSlots[selectedSlots.length - 1]?.date || 'to';
    const classSlug = (selectedClass?.name || 'class')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const sessionSlug = selectedSlots.length > 0 ? `sessions-${selectedSlots.length}` : 'sessions';

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `physical-attendance-${classSlug || 'class'}-${sessionSlug}-${from}-to-${to}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  }, [filteredStudents, selectedClass?.name, selectedDatesSorted, selectedSlots]);

  const handleExportXlsx = useCallback(async () => {
    if (selectedSlots.length === 0 || filteredStudents.length === 0) return;

    try {
      const ExcelJSImport = await import('exceljs');
      const workbook = new ExcelJSImport.Workbook();
      workbook.creator = 'Suraksha LMS';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Physical Attendance');
      const slotHeaders = selectedSlots.map((slot) => {
        const sessionLabel = slot.sessionCode || slot.date;
        const timeLabel = slot.sessionTime !== '00:00' ? ` ${slot.sessionTime}` : '';
        return `${slot.week}\n${sessionLabel}${timeLabel ? ` (${slot.date}${timeLabel})` : ''}`;
      });
      const headers = [
        'Student Name',
        'Institute ID',
        'User ID',
        ...slotHeaders,
        'Present',
        'Late',
        'Absent',
        'Excused',
        'Attendance %',
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
        cell.border = XLSX_BORDER_STYLE;
      });

      const statusColStart = 4;
      const summaryColStart = statusColStart + selectedSlots.length;

      filteredStudents.forEach((student) => {
        const summary = summarizeStudent(student, selectedSlots);
        const statusValues = selectedSlots.map((slot) => statusForSlot(student, slot.key));

        const rowValues: Array<string | number> = [
          student.fullName,
          student.instituteId || '',
          student.userId,
          ...statusValues.map((status) => STATUS_META[status].label),
          summary.present,
          summary.late,
          summary.absent,
          summary.excused,
          `${summary.percentage}%`,
        ];

        const row = worksheet.addRow(rowValues);
        row.height = 20;

        row.eachCell((cell) => {
          cell.border = XLSX_BORDER_STYLE;
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

        statusValues.forEach((status, index) => {
          const style = STATUS_XLSX_STYLE[status];
          const cell = row.getCell(statusColStart + index);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: style.fill },
          };
          cell.font = { bold: true, color: { argb: style.text } };
        });

        row.getCell(summaryColStart + 0).font = { bold: true, color: { argb: STATUS_XLSX_STYLE.PRESENT.text } };
        row.getCell(summaryColStart + 1).font = { bold: true, color: { argb: STATUS_XLSX_STYLE.LATE.text } };
        row.getCell(summaryColStart + 2).font = { bold: true, color: { argb: STATUS_XLSX_STYLE.ABSENT.text } };
        row.getCell(summaryColStart + 3).font = { bold: true, color: { argb: STATUS_XLSX_STYLE.EXCUSED.text } };
        row.getCell(summaryColStart + 4).font = { bold: true, color: { argb: 'FF0F172A' } };
      });

      const legendStartRow = filteredStudents.length + 3;
      worksheet.getCell(`A${legendStartRow}`).value = 'Status Legend';
      worksheet.getCell(`A${legendStartRow}`).font = { bold: true, color: { argb: 'FF1E293B' } };

      (Object.keys(STATUS_META) as CellStatus[]).forEach((status, idx) => {
        const rowIndex = legendStartRow + idx + 1;
        const labelCell = worksheet.getCell(`A${rowIndex}`);
        const colorCell = worksheet.getCell(`B${rowIndex}`);
        const style = STATUS_XLSX_STYLE[status];

        labelCell.value = STATUS_META[status].label;
        labelCell.border = XLSX_BORDER_STYLE;
        labelCell.alignment = { vertical: 'middle' };

        colorCell.value = `${status} (${STATUS_CSV_COLOR[status]})`;
        colorCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: style.fill },
        };
        colorCell.font = { bold: true, color: { argb: style.text } };
        colorCell.border = XLSX_BORDER_STYLE;
      });

      worksheet.columns.forEach((column, index) => {
        if (!column || typeof column.eachCell !== 'function') return;

        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const value = cell.value;
          const text = value == null
            ? ''
            : typeof value === 'object' && value !== null && 'text' in value
              ? String((value as { text?: unknown }).text ?? '')
              : String(value);
          maxLen = Math.max(maxLen, text.length);
        });

        if (index === 0) column.width = Math.max(24, maxLen + 3);
        else if (index === 1) column.width = Math.max(16, maxLen + 2);
        else if (index === 2) column.width = Math.max(36, maxLen + 2);
        else if (index >= summaryColStart - 1) column.width = Math.max(10, maxLen + 2);
        else column.width = Math.max(12, Math.min(16, maxLen + 2));
      });

      worksheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length },
      };

      const fileBuffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([fileBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = URL.createObjectURL(blob);
      const from = selectedDatesSorted[0] || selectedSlots[0]?.date || 'from';
      const to = selectedDatesSorted[selectedDatesSorted.length - 1] || selectedSlots[selectedSlots.length - 1]?.date || 'to';
      const classSlug = (selectedClass?.name || 'class')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const sessionSlug = selectedSlots.length > 0 ? `sessions-${selectedSlots.length}` : 'sessions';

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `physical-attendance-${classSlug || 'class'}-${sessionSlug}-${from}-to-${to}.xlsx`;
      anchor.click();

      URL.revokeObjectURL(url);
      setPreviewError('');
    } catch {
      setPreviewError('Failed to export XLSX file. Please try again.');
    }
  }, [filteredStudents, selectedClass?.name, selectedDatesSorted, selectedSlots]);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] px-3 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={adminBase}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            Dashboard
          </Link>
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">View Physical Attendance</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Review and export attendance only. Use mark pages to record attendance.</p>
          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
              <button
                onClick={() => setViewMode('simple')}
                className={`px-2.5 py-1.5 text-xs font-semibold transition ${
                  !isAdvancedMode
                    ? 'bg-blue-600 text-white'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                Simple
              </button>
              <button
                onClick={() => setViewMode('advanced')}
                className={`px-2.5 py-1.5 text-xs font-semibold transition ${
                  isAdvancedMode
                    ? 'bg-indigo-600 text-white'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                Advanced
              </button>
            </div>
            <Link
              to={markAttendancePath}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
            >
              Mark Attendance
            </Link>
            <Link
              to={externalDevicePath}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
            >
              External Device
            </Link>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Class</label>
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                disabled={loadingClasses || classes.length === 0}
                className="mt-1.5 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))]"
              >
                {classes.length === 0 ? (
                  <option value="">No classes found</option>
                ) : (
                  classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}{item.subject ? ` - ${item.subject}` : ''}
                    </option>
                  ))
                )}
              </select>

              <div className="mt-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Sessions</p>
                <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                  Load a class, choose dates, then preview all attendance sessions recorded in that range.
                </p>
              </div>

              {isAdvancedMode && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={selectAllMonthMarkedDates}
                    disabled={!selectedClassId}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                  >
                    Select Marked (Month)
                  </button>
                  <button
                    onClick={clearSelectedDates}
                    disabled={selectedDates.length === 0}
                    className="rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] disabled:opacity-50"
                  >
                    Clear Selection
                  </button>
                </div>
              )}

              <div className="mt-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Date Range</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    From
                    <input
                      type="date"
                      value={rangeFrom}
                      onChange={(event) => setRangeFrom(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs"
                    />
                  </label>
                  <label className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    To
                    <input
                      type="date"
                      value={rangeTo}
                      onChange={(event) => setRangeTo(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs"
                    />
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => applyDateRangeSelection(false)}
                    disabled={availableDates.length === 0}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50"
                  >
                    {isAdvancedMode ? 'Select Range' : 'Use This Range'}
                  </button>
                  {isAdvancedMode && (
                    <button
                      onClick={() => applyDateRangeSelection(true)}
                      disabled={availableDates.length === 0}
                      className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 disabled:opacity-50"
                    >
                      Add Range
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-3 text-[11px] text-[hsl(var(--muted-foreground))]">
                Marked days in this month: <span className="font-semibold text-[hsl(var(--foreground))]">{monthMarkedDates.length}</span>
              </p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {isAdvancedMode ? 'Selected dates:' : 'Dates in active range:'}{' '}
                <span className="font-semibold text-[hsl(var(--foreground))]">
                  {isAdvancedMode ? selectedDatesSorted.length : previewDateCount}
                </span>
              </p>

              {selectedError && (
                <p className="mt-2 text-xs font-medium text-red-600">{selectedError}</p>
              )}
            </div>

            {isAdvancedMode && (
              <>
                <MultiSelectCalendar
                  year={calendarYear}
                  month={calendarMonth}
                  selectedDateSet={selectedDateSet}
                  availableDateSet={availableDateSet}
                  onToggleDate={toggleDate}
                  onPrevMonth={() => {
                    if (calendarMonth === 0) {
                      setCalendarYear((year) => year - 1);
                      setCalendarMonth(11);
                      return;
                    }
                    setCalendarMonth((month) => month - 1);
                  }}
                  onNextMonth={() => {
                    if (calendarMonth === 11) {
                      setCalendarYear((year) => year + 1);
                      setCalendarMonth(0);
                      return;
                    }
                    setCalendarMonth((month) => month + 1);
                  }}
                />

                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Selected Dates</p>
                  {selectedDatesSorted.length === 0 ? (
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">No dates selected yet.</p>
                  ) : (
                    <div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto">
                      {selectedDatesSorted.map((date) => (
                        <button
                          key={date}
                          onClick={() => toggleDate(date)}
                          className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700"
                          title="Click to remove"
                        >
                          {date}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search student name, institute ID, or user ID"
                  className="min-w-[250px] flex-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                />
                <button
                  onClick={() => void loadPreview()}
                  disabled={!canLoadPreview || loadingPreview}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingPreview ? 'Loading Preview...' : 'Load Preview'}
                </button>
                <button
                  onClick={handleExportCsv}
                  disabled={!previewLoaded || filteredStudents.length === 0 || selectedSlots.length === 0}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => void handleExportXlsx()}
                  disabled={!previewLoaded || filteredStudents.length === 0 || selectedSlots.length === 0}
                  className="rounded-xl border border-lime-200 bg-lime-50 px-4 py-2 text-sm font-semibold text-lime-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Export XLSX (Colored)
                </button>
                <button
                  onClick={() => setTableFullscreen(true)}
                  disabled={!previewLoaded || filteredStudents.length === 0 || selectedSlots.length === 0}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Full Screen Table
                </button>
              </div>

              <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                Active sessions: <span className="font-semibold text-[hsl(var(--foreground))]">{selectedSlots.length}</span>
              </p>

              {previewError && (
                <p className="mt-2 text-sm font-medium text-red-600">{previewError}</p>
              )}

              <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                CSV includes status with color labels (for example: PRESENT (Green), ABSENT (Red)).
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                XLSX export contains true cell colors (Present green, Late amber, Absent red, Excused blue, Not Marked gray).
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(STATUS_META) as CellStatus[]).map((statusKey) => {
                  const meta = STATUS_META[statusKey];
                  return (
                    <span key={statusKey} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.pill}`}>
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-emerald-700">Present</p>
                <p className="text-lg font-bold text-emerald-800">{tableSummary.present}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-amber-700">Late</p>
                <p className="text-lg font-bold text-amber-800">{tableSummary.late}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-red-700">Absent</p>
                <p className="text-lg font-bold text-red-800">{tableSummary.absent}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-blue-700">Excused</p>
                <p className="text-lg font-bold text-blue-800">{tableSummary.excused}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-slate-600">Not Marked</p>
                <p className="text-lg font-bold text-slate-700">{tableSummary.notMarked}</p>
              </div>
            </div>

            {!selectedClassId ? (
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                Select a class to begin.
              </div>
            ) : !canLoadPreview ? (
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                {isAdvancedMode
                  ? 'Select one or more dates from the calendar, then click Load Preview.'
                  : 'No marked dates available in the selected range. Adjust date range.'}
              </div>
            ) : !previewLoaded ? (
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                Preview is ready to load for <span className="font-semibold text-[hsl(var(--foreground))]">{previewDateCount}</span> date{previewDateCount !== 1 ? 's' : ''}.
              </div>
            ) : selectedSlots.length === 0 ? (
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                No attendance sessions found for the selected dates.
              </div>
            ) : (
              <div className={`overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] ${tableFullscreen ? 'fixed inset-2 z-[95] md:inset-4 shadow-2xl' : ''}`}>
                {tableFullscreen && (
                  <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2">
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Physical Attendance Table</p>
                    <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {selectedClass?.name || 'Class'} | Sessions {selectedSlots.length} | {selectedDatesSorted[0]} to {selectedDatesSorted[selectedDatesSorted.length - 1]}
                    </p>
                    <button
                      onClick={handleExportCsv}
                      className="ml-auto rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={() => void handleExportXlsx()}
                      className="rounded-lg border border-lime-200 bg-lime-50 px-3 py-1.5 text-xs font-semibold text-lime-800"
                    >
                      Export XLSX
                    </button>
                    <button
                      onClick={() => setTableFullscreen(false)}
                      className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--foreground))]"
                    >
                      Close
                    </button>
                  </div>
                )}

                <div className={tableFullscreen ? 'h-[calc(100vh-74px)] overflow-auto' : 'overflow-auto'}>
                  <table className={`min-w-max ${tableFullscreen ? 'text-sm' : 'text-xs'}`}>
                    <thead className="bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                      <tr>
                        <th className="sticky left-0 z-20 border-r border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-left font-semibold">Student</th>
                        <th className="sticky left-[220px] z-20 border-r border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-left font-semibold">Institute ID</th>
                        {selectedSlots.map((slot) => {
                          const header = formatSlotHeader(slot);
                          return (
                            <th key={slot.key} className="min-w-[128px] border-r border-[hsl(var(--border))] px-2 py-2 text-center font-semibold">
                              <p className="text-[10px] opacity-80">{header.weekTag}</p>
                              <p>{header.session}{header.time ? ` ${header.time}` : ''}</p>
                              <p className="text-[10px] opacity-80">{header.day} {header.week}</p>
                            </th>
                          );
                        })}
                        <th className="min-w-[76px] border-r border-[hsl(var(--border))] px-2 py-2 text-center font-semibold">P</th>
                        <th className="min-w-[76px] border-r border-[hsl(var(--border))] px-2 py-2 text-center font-semibold">L</th>
                        <th className="min-w-[76px] border-r border-[hsl(var(--border))] px-2 py-2 text-center font-semibold">A</th>
                        <th className="min-w-[76px] border-r border-[hsl(var(--border))] px-2 py-2 text-center font-semibold">E</th>
                        <th className="min-w-[92px] px-2 py-2 text-center font-semibold">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={selectedSlots.length + 7} className="px-4 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                            No students match your search.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student) => {
                          const summary = summarizeStudent(student, selectedSlots);
                          const initials = student.fullName
                            .split(' ')
                            .map((part) => part[0] || '')
                            .join('')
                            .slice(0, 2)
                            .toUpperCase() || '?';

                          return (
                            <tr key={student.userId} className="border-t border-[hsl(var(--border))]">
                              <td className="sticky left-0 z-10 w-[220px] min-w-[220px] border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {student.avatarUrl ? (
                                    <img src={student.avatarUrl} alt={student.fullName} className="h-8 w-8 rounded-full object-cover" />
                                  ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                                      {initials}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{student.fullName}</p>
                                    <p className="truncate font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{student.userId}</p>
                                  </div>
                                </div>
                              </td>

                              <td className="sticky left-[220px] z-10 w-[140px] min-w-[140px] border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 font-mono text-[11px] text-[hsl(var(--foreground))]">
                                {student.instituteId || '-'}
                              </td>

                              {selectedSlots.map((slot) => {
                                const status = statusForSlot(student, slot.key);
                                const meta = STATUS_META[status];
                                return (
                                  <td key={`${student.userId}-${slot.key}`} className="border-r border-[hsl(var(--border))] px-2 py-2 text-center">
                                    <span className={`inline-flex min-w-[34px] items-center justify-center rounded-md border px-2 py-1 text-[10px] font-bold ${meta.pill}`} title={meta.label}>
                                      {meta.short}
                                    </span>
                                  </td>
                                );
                              })}

                              <td className="border-r border-[hsl(var(--border))] px-2 py-2 text-center font-semibold text-emerald-700">{summary.present}</td>
                              <td className="border-r border-[hsl(var(--border))] px-2 py-2 text-center font-semibold text-amber-700">{summary.late}</td>
                              <td className="border-r border-[hsl(var(--border))] px-2 py-2 text-center font-semibold text-red-700">{summary.absent}</td>
                              <td className="border-r border-[hsl(var(--border))] px-2 py-2 text-center font-semibold text-blue-700">{summary.excused}</td>
                              <td className="px-2 py-2 text-center font-semibold text-[hsl(var(--foreground))]">{summary.percentage}%</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Viewing class: <span className="font-semibold text-[hsl(var(--foreground))]">{selectedClass?.name || 'Not selected'}</span>
              {selectedDatesSorted.length > 0 && (
                <>
                  {' '}| Range: <span className="font-mono">{selectedDatesSorted[0]} to {selectedDatesSorted[selectedDatesSorted.length - 1]}</span>
                </>
              )}
              {' '}| Sessions: <span className="font-semibold text-[hsl(var(--foreground))]">{selectedSlots.length}</span>
              {' '}| Total cells: <span className="font-semibold text-[hsl(var(--foreground))]">{tableSummary.totalCells}</span>
            </p>
          </div>
        </div>
      </div>

      {tableFullscreen && (
        <button
          onClick={() => setTableFullscreen(false)}
          className="fixed inset-0 z-[90] cursor-default bg-black/35"
          aria-label="Close full screen table overlay"
        />
      )}
    </div>
  );
}
