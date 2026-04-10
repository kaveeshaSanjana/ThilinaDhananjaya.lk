import { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getInstituteAdminPath } from '../lib/instituteRoutes';

/* ─── Types ─────────────────────────────────────────── */
type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
type ViewMode = 'day' | 'range';

interface AttRecord {
  id: string;
  userId: string;
  status: AttStatus;
  method?: string;
  note?: string;
  createdAt: string;
}

interface Student {
  id: string;
  name: string;
  profile?: { firstName?: string; lastName?: string; avatarUrl?: string; avatar?: string; studentId?: string; fullName?: string };
}

interface MonitorStudent {
  userId: string;
  fullName: string;
  instituteId: string;
  avatarUrl: string | null;
  statuses: Record<string, string>;
  present: number;
  late: number;
  absent: number;
  excused: number;
  percentage: number;
}

interface MonitorData {
  dates: string[];
  students: MonitorStudent[];
}

/* ─── Helpers ────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; badge: string; cell: string; short: string }> = {
  PRESENT:    { label: 'Present',    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', cell: 'bg-emerald-100 text-emerald-700', short: 'P' },
  ABSENT:     { label: 'Absent',     badge: 'bg-red-100 text-red-700 border-red-200',             cell: 'bg-red-100 text-red-700',         short: 'A' },
  LATE:       { label: 'Late',       badge: 'bg-amber-100 text-amber-700 border-amber-200',       cell: 'bg-amber-100 text-amber-700',     short: 'L' },
  EXCUSED:    { label: 'Excused',    badge: 'bg-blue-100 text-blue-700 border-blue-200',          cell: 'bg-blue-100 text-blue-700',       short: 'E' },
  NOT_MARKED: { label: '—',          badge: 'bg-slate-100 text-slate-400 border-slate-200',       cell: 'bg-transparent text-slate-300',   short: '—' },
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function exportDayCsv(date: string, records: AttRecord[], students: Student[]) {
  const recordMap = new Map(records.map(r => [r.userId, r]));
  const rows: string[][] = [['Name', 'Student ID', 'Status', 'Method', 'Time', 'Note']];
  for (const student of students) {
    const rec = recordMap.get(student.id);
    const name = student.profile?.fullName
      || [student.profile?.firstName, student.profile?.lastName].filter(Boolean).join(' ')
      || student.name;
    rows.push([
      name,
      student.profile?.studentId || '',
      rec ? rec.status : 'NOT_MARKED',
      rec?.method || '',
      rec ? new Date(rec.createdAt).toLocaleTimeString('en-GB') : '',
      rec?.note || '',
    ]);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `attendance-${date}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportRangeCsv(from: string, to: string, data: MonitorData) {
  const header = ['Name', 'Student ID', ...data.dates.map(d => { const [,m,day] = d.split('-'); return `${MONTH_NAMES[parseInt(m)-1].slice(0,3)} ${parseInt(day)}`; }), 'Present', 'Late', 'Absent', 'Excused', 'Attendance %'];
  const rows = data.students.map(s => [
    s.fullName, s.instituteId,
    ...data.dates.map(d => s.statuses[d] || '—'),
    s.present, s.late, s.absent, s.excused, `${s.percentage}%`,
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `attendance-range-${from}-to-${to}.csv`; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Mini Calendar ──────────────────────────────────── */
function MiniCalendar({ year, month, markedDates, selectedDate, onSelectDate, onPrevMonth, onNextMonth }: {
  year: number; month: number;
  markedDates: Set<string>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void; onNextMonth: () => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toLocalDateStr(new Date());
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrevMonth} className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] transition text-[hsl(var(--muted-foreground))]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-bold text-[hsl(var(--foreground))]">{MONTH_NAMES[month]} {year}</span>
        <button onClick={onNextMonth} className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] transition text-[hsl(var(--muted-foreground))]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-[hsl(var(--muted-foreground))] py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasRecord = markedDates.has(dateStr);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          return (
            <button key={i} onClick={() => onSelectDate(dateStr)}
              className={`relative flex flex-col items-center justify-center aspect-square rounded-lg text-xs font-medium transition-all ${
                isSelected ? 'bg-[hsl(var(--primary))] text-white shadow-md'
                  : isToday ? 'bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary)/0.3)]'
                  : 'hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
              }`}>
              {day}
              {hasRecord && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[hsl(var(--primary))]'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Close Date Result Modal ────────────────────────── */
function CloseDateModal({ result, date, onClose }: {
  result: { marked: number; absentStudents: any[] };
  date: string;
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-[hsl(var(--card))] rounded-2xl shadow-2xl border border-[hsl(var(--border))]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))]">
          <div>
            <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Date Closed — {date}</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{result.marked} student{result.marked !== 1 ? 's' : ''} auto-marked absent</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 max-h-80 overflow-y-auto">
          {result.absentStudents.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">All students were already marked.</p>
          ) : (
            <div className="space-y-2">
              {result.absentStudents.map((s: any) => {
                const name = s.profile ? [s.profile.firstName, s.profile.lastName].filter(Boolean).join(' ') || s.name : s.name;
                return (
                  <div key={s.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-red-50 border border-red-100">
                    <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-xs font-bold text-red-700 shrink-0">{(name || '?')[0].toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{name}</p>
                      {s.profile?.studentId && <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.profile.studentId}</p>}
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">Absent</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))] transition">Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════ */
/*         CLASS PHYSICAL ATTENDANCE PAGE                 */
/* ═══════════════════════════════════════════════════════ */
export default function ClassPhysicalAttendancePage() {
  const { classId, instituteId } = useParams<{ classId: string; instituteId?: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const now = new Date();

  /* ─── View mode ───────────────────────────────────── */
  const [viewMode, setViewMode] = useState<ViewMode>('day');

  /* ─── Day view state ──────────────────────────────── */
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState('');
  const [dayRecords,   setDayRecords]   = useState<AttRecord[]>([]);
  const [dateLoading,  setDateLoading]  = useState(false);
  const [markingId,    setMarkingId]    = useState('');
  const [closingDate,  setClosingDate]  = useState(false);
  const [closeDateResult, setCloseDateResult] = useState<{ marked: number; absentStudents: any[] } | null>(null);

  /* ─── Range view state ────────────────────────────── */
  const [rangeFrom,      setRangeFrom]      = useState('');
  const [rangeTo,        setRangeTo]        = useState('');
  const [filterMonthIdx, setFilterMonthIdx] = useState<number>(-1);
  const [monitorData,    setMonitorData]    = useState<MonitorData | null>(null);
  const [rangeLoading,   setRangeLoading]   = useState(false);
  const [myRangeData,    setMyRangeData]    = useState<{ date: string; status: string }[]>([]);

  /* ─── Common state ────────────────────────────────── */
  const [classData,        setClassData]       = useState<any>(null);
  const [allMonths,        setAllMonths]        = useState<any[]>([]);
  const [allDates,         setAllDates]         = useState<string[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState('');

  /* ─── Initial fetch ───────────────────────────────── */
  useEffect(() => {
    if (!classId) return;
    (async () => {
      setLoading(true); setError('');
      try {
        const promises: Promise<any>[] = [
          api.get(`/classes/${classId}`),
          api.get(`/classes/${classId}/months`),
          api.get(`/attendance/class-attendance/class/${classId}/dates`),
        ];
        if (isAdmin) promises.push(api.get(`/attendance/class-attendance/class/${classId}/students`));
        const [classRes, monthsRes, datesRes, studentsRes] = await Promise.all(promises);
        setClassData(classRes.data?.class ?? classRes.data);
        setAllMonths(monthsRes.data || []);
        setAllDates(datesRes.data || []);
        if (studentsRes) setEnrolledStudents(studentsRes.data || []);
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load attendance data');
      } finally { setLoading(false); }
    })();
  }, [classId, isAdmin]);

  /* ─── Load day attendance ─────────────────────────── */
  const loadDayAttendance = useCallback(async (date: string) => {
    if (!classId || !date) return;
    setDateLoading(true);
    try {
      const res = await api.get(`/attendance/class-attendance/class/${classId}/date/${date}`);
      setDayRecords(res.data || []);
    } catch { setDayRecords([]); }
    finally { setDateLoading(false); }
  }, [classId]);

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    loadDayAttendance(date);
  };

  /* ─── Mark student ────────────────────────────────── */
  const handleMarkStudent = async (userId: string, status: AttStatus) => {
    if (!classId || !selectedDate) return;
    setMarkingId(userId);
    try {
      await api.post('/attendance/class-attendance/mark', { classId, identifier: userId, date: selectedDate, status, method: 'manual' });
      await loadDayAttendance(selectedDate);
      if (!allDates.includes(selectedDate)) setAllDates(prev => [...prev, selectedDate].sort());
    } catch (e: any) { console.error('Mark failed:', e.response?.data?.message); }
    finally { setMarkingId(''); }
  };

  /* ─── Close date ──────────────────────────────────── */
  const handleCloseDate = async () => {
    if (!classId || !selectedDate) return;
    setClosingDate(true);
    try {
      const res = await api.post(`/attendance/class-attendance/class/${classId}/close-date/${selectedDate}`);
      setCloseDateResult(res.data);
      await loadDayAttendance(selectedDate);
      if (!allDates.includes(selectedDate)) setAllDates(prev => [...prev, selectedDate].sort());
    } catch (e: any) { console.error('Close date failed:', e.response?.data?.message); }
    finally { setClosingDate(false); }
  };

  /* ─── Month quick-filter ──────────────────────────── */
  const applyMonthFilter = (monthIdx: number) => {
    setFilterMonthIdx(monthIdx);
    if (monthIdx < 0 || monthIdx >= allMonths.length) return;
    const m = allMonths[monthIdx];
    const yr = m.year ?? now.getFullYear();
    const mo = m.month ?? (now.getMonth() + 1);
    const firstDay = `${yr}-${String(mo).padStart(2, '0')}-01`;
    const lastDay = toLocalDateStr(new Date(yr, mo, 0));
    setRangeFrom(firstDay);
    setRangeTo(lastDay);
  };

  /* ─── Load range data ─────────────────────────────── */
  const loadRange = async () => {
    if (!classId || !rangeFrom || !rangeTo) return;
    setRangeLoading(true);
    setMonitorData(null);
    setMyRangeData([]);
    try {
      if (isAdmin) {
        const res = await api.get(`/attendance/class-attendance/class/${classId}/monitor?from=${rangeFrom}&to=${rangeTo}`);
        setMonitorData(res.data);
      } else {
        const res = await api.get(`/attendance/my/class-attendance?classId=${classId}`);
        const classes = res.data || [];
        const classEntry = Array.isArray(classes) ? classes.find((c: any) => c.class?.id === classId) : classes;
        const records: any[] = classEntry?.records || [];
        const from = new Date(rangeFrom);
        const to = new Date(rangeTo + 'T23:59:59');
        setMyRangeData(records
          .filter((r: any) => { const d = new Date(r.date); return d >= from && d <= to; })
          .map((r: any) => ({ date: toLocalDateStr(new Date(r.date)), status: r.status })));
      }
    } catch (e: any) { console.error('Range load failed:', e); }
    finally { setRangeLoading(false); }
  };

  /* ─── Derived ─────────────────────────────────────── */
  const markedDatesSet = new Set(allDates);
  const totalEnrolled  = enrolledStudents.length;
  const dayPresent = dayRecords.filter(r => r.status === 'PRESENT').length;
  const dayAbsent  = dayRecords.filter(r => r.status === 'ABSENT').length;
  const dayLate    = dayRecords.filter(r => r.status === 'LATE').length;

  const studentRangeDates = useMemo(() => Array.from(new Set(myRangeData.map(r => r.date))).sort(), [myRangeData]);
  const studentRangeMap   = useMemo(() => { const m: Record<string,string> = {}; for (const r of myRangeData) m[r.date] = r.status; return m; }, [myRangeData]);

  const displayName = (s: Student) => {
    if (s.profile?.fullName) return s.profile.fullName;
    const full = [s.profile?.firstName, s.profile?.lastName].filter(Boolean).join(' ');
    return full || s.name;
  };

  /* ─── Loading ─────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-[3px] border-[hsl(var(--primary))] border-t-transparent animate-spin" />
    </div>
  );

  /* ─── Render ──────────────────────────────────────── */
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            {classData?.name && <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{classData.name}</p>}
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Physical Attendance</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {allDates.length} day{allDates.length !== 1 ? 's' : ''} recorded{totalEnrolled > 0 && ` · ${totalEnrolled} enrolled`}
            </p>
          </div>
        </div>
        {isAdmin && allMonths.length > 0 && (
          <Link
            to={`${getInstituteAdminPath(instituteId, '/slips')}?tab=physical&classId=${classId}&monthId=${allMonths[allMonths.length - 1].id}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition shadow-sm shrink-0"
          >
            <svg className="w-4 h-4 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
            Class Payments
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          {error}
        </div>
      )}

      {/* ── View mode tabs ── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border))] w-fit">
        {(['day', 'range'] as ViewMode[]).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === mode ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}>
            {mode === 'day' ? 'Day View' : 'Range / Grid'}
          </button>
        ))}
      </div>

      {/* ══════════════════════ DAY VIEW ══════════════════════ */}
      {viewMode === 'day' && (
        <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
          {/* Left: Calendar + legend + stats */}
          <div className="space-y-4">
            <MiniCalendar
              year={calYear} month={calMonth}
              markedDates={markedDatesSet}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onPrevMonth={() => { if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11); } else setCalMonth(m => m-1); }}
              onNextMonth={() => { if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0); } else setCalMonth(m => m+1); }}
            />
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-3 shadow-sm text-xs space-y-1.5 text-[hsl(var(--muted-foreground))]">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2">Legend</p>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] shrink-0" />Date with records</div>
              <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-lg bg-[hsl(var(--primary))] text-white text-[8px] flex items-center justify-center shrink-0 font-bold">15</span>Selected date</div>
              <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-lg bg-[hsl(var(--primary)/0.08)] ring-1 ring-[hsl(var(--primary)/0.3)] flex items-center justify-center shrink-0" />Today</div>
            </div>
            {selectedDate && !dateLoading && (
              <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-3 shadow-sm space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Summary</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { count: dayPresent,                     label: 'Present',  bg: 'bg-emerald-50 border-emerald-100', t: 'text-emerald-700' },
                    { count: dayAbsent,                      label: 'Absent',   bg: 'bg-red-50 border-red-100',        t: 'text-red-700' },
                    { count: dayLate,                        label: 'Late',     bg: 'bg-amber-50 border-amber-100',    t: 'text-amber-700' },
                    { count: totalEnrolled - dayRecords.length, label: 'Unmarked', bg: 'bg-slate-50 border-slate-100', t: 'text-slate-600' },
                  ].map(({ count, label, bg, t }) => (
                    <div key={label} className={`text-center py-2 rounded-xl border ${bg}`}>
                      <p className={`text-lg font-bold ${t}`}>{count}</p>
                      <p className={`text-[10px] font-semibold ${t}`}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Day panel */}
          <div className="min-w-0">
            {!selectedDate ? (
              <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-14 text-center shadow-sm h-full flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-[hsl(var(--muted-foreground)/0.4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">Select a date to view attendance</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {markedDatesSet.size > 0 ? `${markedDatesSet.size} date${markedDatesSet.size !== 1 ? 's' : ''} with records — dots on calendar` : 'No attendance has been recorded yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="text-base font-bold text-[hsl(var(--foreground))]">
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </h2>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        {markedDatesSet.has(selectedDate) ? 'Class held on this date' : 'No records for this date yet'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {dayRecords.length > 0 && (
                        <button onClick={() => exportDayCsv(selectedDate, dayRecords, enrolledStudents)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Export CSV
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={handleCloseDate} disabled={closingDate || enrolledStudents.length === 0}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-md shadow-orange-200/50 transition disabled:opacity-50">
                          {closingDate
                            ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                          {closingDate ? 'Closing...' : 'Close Date'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {dateLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent animate-spin" />
                  </div>
                ) : enrolledStudents.length === 0 ? (
                  <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-10 text-center">
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">No enrolled students found for this class.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {enrolledStudents.map(student => {
                      const rec = dayRecords.find(r => r.userId === student.id);
                      const statusKey = rec?.status ?? 'NOT_MARKED';
                      const cfg = STATUS_CFG[statusKey] ?? STATUS_CFG.NOT_MARKED;
                      const isMarking = markingId === student.id;
                      const name = displayName(student);
                      const avatarUrl = student.profile?.avatarUrl || student.profile?.avatar;
                      return (
                        <div key={student.id} className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-3.5 shadow-sm flex items-center gap-3">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={name} className="w-9 h-9 rounded-xl object-cover shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-sm font-bold shrink-0">
                              {(name || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{name}</p>
                            {student.profile?.studentId && <p className="text-xs text-[hsl(var(--muted-foreground))]">{student.profile.studentId}</p>}
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 ${cfg.badge}`}>{cfg.label}</span>
                          {isAdmin && (
                            <div className="flex items-center gap-1 shrink-0">
                              {isMarking ? (
                                <div className="p-2"><svg className="w-4 h-4 animate-spin text-[hsl(var(--primary))]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
                              ) : (
                                <>
                                  {([['PRESENT','#059669'],['LATE','#d97706'],['ABSENT','#dc2626']] as [AttStatus, string][]).map(([s, activeColor]) => {
                                    const c = STATUS_CFG[s];
                                    const isActive = statusKey === s;
                                    return (
                                      <button key={s} onClick={() => handleMarkStudent(student.id, s)} title={`Mark ${c.label}`}
                                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition border ${c.badge}`}
                                        style={isActive ? { background: activeColor, color: 'white', borderColor: 'transparent' } : {}}>
                                        {c.short}
                                      </button>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════ RANGE / GRID VIEW ══════════════════ */}
      {viewMode === 'range' && (
        <div className="space-y-5">
          {/* Filters */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              {allMonths.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Quick: Month</label>
                  <select value={filterMonthIdx} onChange={e => applyMonthFilter(parseInt(e.target.value))}
                    className="text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl px-3 py-2 text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] outline-none min-w-[160px]">
                    <option value={-1}>— All / Custom —</option>
                    {allMonths.map((m: any, i: number) => <option key={m.id} value={i}>{m.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">From</label>
                <input type="date" value={rangeFrom} onChange={e => { setRangeFrom(e.target.value); setFilterMonthIdx(-1); }}
                  className="text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl px-3 py-2 text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">To</label>
                <input type="date" value={rangeTo} onChange={e => { setRangeTo(e.target.value); setFilterMonthIdx(-1); }}
                  className="text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl px-3 py-2 text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] outline-none" />
              </div>
              <button onClick={loadRange} disabled={!rangeFrom || !rangeTo || rangeLoading}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-[hsl(var(--primary))] text-white hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2">
                {rangeLoading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {rangeLoading ? 'Loading...' : 'Load Report'}
              </button>
              {isAdmin && filterMonthIdx >= 0 && filterMonthIdx < allMonths.length && (
                <Link
                  to={`${getInstituteAdminPath(instituteId, '/slips')}?tab=physical&classId=${classId}&monthId=${allMonths[filterMonthIdx].id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.2)] hover:bg-[hsl(var(--primary)/0.15)] transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                  View Payments
                </Link>
              )}
              {isAdmin && monitorData && monitorData.dates.length > 0 && (
                <button onClick={() => exportRangeCsv(rangeFrom, rangeTo, monitorData)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {/* Admin grid */}
          {isAdmin && monitorData && (
            monitorData.dates.length === 0 ? (
              <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-12 text-center">
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">No attendance records in this range</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Try a different date range</p>
              </div>
            ) : (
              <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{monitorData.students.length} students · {monitorData.dates.length} days</span>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold flex-wrap">
                    {[['P','bg-emerald-100 text-emerald-700'],['L','bg-amber-100 text-amber-700'],['A','bg-red-100 text-red-700'],['E','bg-blue-100 text-blue-700'],['—','bg-slate-100 text-slate-400']].map(([s,cls]) => (
                      <span key={s} className={`px-1.5 py-0.5 rounded-md ${cls}`}>{s}</span>
                    ))}
                    <span className="text-[hsl(var(--muted-foreground))]">= Present / Late / Absent / Excused / —</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[hsl(var(--muted)/0.4)]">
                        <th className="sticky left-0 z-10 bg-[hsl(var(--muted)/0.4)] text-left px-4 py-3 font-bold text-[hsl(var(--foreground))] whitespace-nowrap border-r border-[hsl(var(--border))] min-w-[200px]">Student</th>
                        {monitorData.dates.map(d => (
                          <th key={d} className="px-2 py-3 font-bold text-[hsl(var(--muted-foreground))] text-center whitespace-nowrap min-w-[52px] border-r border-[hsl(var(--border)/0.5)]">
                            <button onClick={() => { setViewMode('day'); setSelectedDate(d); const dt = new Date(d+'T00:00:00'); setCalYear(dt.getFullYear()); setCalMonth(dt.getMonth()); loadDayAttendance(d); }}
                              className="hover:text-[hsl(var(--primary))] transition">
                              <span className="block text-[10px]">{MONTH_NAMES[parseInt(d.split('-')[1])-1].slice(0,3)}</span>
                              <span className="block text-base font-extrabold">{parseInt(d.split('-')[2])}</span>
                            </button>
                          </th>
                        ))}
                        <th className="sticky right-0 z-10 bg-[hsl(var(--muted)/0.4)] px-3 py-3 font-bold text-[hsl(var(--foreground))] text-center whitespace-nowrap border-l border-[hsl(var(--border))] min-w-[80px]">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitorData.students.map((s, si) => {
                        const pct = s.percentage;
                        const pctColor = pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600';
                        const pctBg   = pct >= 80 ? 'bg-emerald-50'    : pct >= 60 ? 'bg-amber-50'    : 'bg-red-50';
                        return (
                          <tr key={s.userId} className={`border-t border-[hsl(var(--border)/0.5)] transition-colors ${si % 2 ? 'bg-[hsl(var(--muted)/0.12)]' : ''} hover:bg-[hsl(var(--muted)/0.25)]`}>
                            <td className="sticky left-0 z-10 px-4 py-2.5 border-r border-[hsl(var(--border))]" style={{ background: 'hsl(var(--card))' }}>
                              <div className="flex items-center gap-2.5">
                                {s.avatarUrl ? (
                                  <img src={s.avatarUrl} alt={s.fullName} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
                                    {(s.fullName || '?')[0].toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold text-[hsl(var(--foreground))] truncate max-w-[140px]">{s.fullName}</p>
                                  {s.instituteId && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{s.instituteId}</p>}
                                </div>
                              </div>
                            </td>
                            {monitorData.dates.map(d => {
                              const st = s.statuses[d] || 'NOT_MARKED';
                              const cfg = STATUS_CFG[st] ?? STATUS_CFG.NOT_MARKED;
                              return (
                                <td key={d} className="px-1 py-2.5 text-center border-r border-[hsl(var(--border)/0.5)]">
                                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-bold ${cfg.cell}`}>{cfg.short}</span>
                                </td>
                              );
                            })}
                            <td className={`sticky right-0 z-10 px-3 py-2.5 border-l border-[hsl(var(--border))] text-center ${pctBg}`} style={{ background: '' }}>
                              <p className={`text-base font-extrabold ${pctColor}`}>{pct}%</p>
                              <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{s.present+s.late}/{monitorData.dates.length}</p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Student grid */}
          {!isAdmin && studentRangeDates.length > 0 && (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
                <p className="text-sm font-bold text-[hsl(var(--foreground))]">My Attendance</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{rangeFrom} → {rangeTo}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[hsl(var(--muted)/0.4)]">
                      <th className="sticky left-0 z-10 bg-[hsl(var(--muted)/0.4)] text-left px-4 py-3 font-bold text-[hsl(var(--foreground))] whitespace-nowrap border-r border-[hsl(var(--border))] min-w-[180px]">Student</th>
                      {studentRangeDates.map(d => (
                        <th key={d} className="px-2 py-3 font-bold text-[hsl(var(--muted-foreground))] text-center whitespace-nowrap min-w-[52px] border-r border-[hsl(var(--border)/0.5)]">
                          <span className="block text-[10px]">{MONTH_NAMES[parseInt(d.split('-')[1])-1].slice(0,3)}</span>
                          <span className="block text-base font-extrabold">{parseInt(d.split('-')[2])}</span>
                        </th>
                      ))}
                      <th className="sticky right-0 z-10 bg-[hsl(var(--muted)/0.4)] px-3 py-3 font-bold text-center whitespace-nowrap border-l border-[hsl(var(--border))] min-w-[80px]">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-[hsl(var(--border)/0.5)]">
                      <td className="sticky left-0 z-10 px-4 py-3 border-r border-[hsl(var(--border))]" style={{ background: 'hsl(var(--card))' }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
                            {(user?.profile?.fullName || user?.email || 'Me')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[hsl(var(--foreground))] truncate">{user?.profile?.fullName || 'Me'}</p>
                            {user?.profile?.instituteId && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{user.profile.instituteId}</p>}
                          </div>
                        </div>
                      </td>
                      {studentRangeDates.map(d => {
                        const st = studentRangeMap[d] || 'NOT_MARKED';
                        const cfg = STATUS_CFG[st] ?? STATUS_CFG.NOT_MARKED;
                        return (
                          <td key={d} className="px-1 py-3 text-center border-r border-[hsl(var(--border)/0.5)]">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-bold ${cfg.cell}`}>{cfg.short}</span>
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 px-3 py-3 border-l border-[hsl(var(--border))] text-center" style={{ background: 'hsl(var(--card))' }}>
                        {(() => {
                          const attended = myRangeData.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
                          const pct = studentRangeDates.length > 0 ? Math.round((attended / studentRangeDates.length) * 100) : 0;
                          const c = pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600';
                          return <>
                            <p className={`text-base font-extrabold ${c}`}>{pct}%</p>
                            <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{attended}/{studentRangeDates.length}</p>
                          </>;
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty before load */}
          {!monitorData && !rangeLoading && myRangeData.length === 0 && (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center">
              <svg className="w-10 h-10 text-[hsl(var(--muted-foreground)/0.3)] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Select a date range and load the report</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Use the month quick-select or enter a custom range</p>
            </div>
          )}
        </div>
      )}

      {closeDateResult && (
        <CloseDateModal result={closeDateResult} date={selectedDate} onClose={() => setCloseDateResult(null)} />
      )}
    </div>
  );
}
