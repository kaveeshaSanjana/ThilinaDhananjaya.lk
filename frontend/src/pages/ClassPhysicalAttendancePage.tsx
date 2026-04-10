import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getInstitutePath } from '../lib/instituteRoutes';

/* ─── Types ─────────────────────────────────────────── */
type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

interface AttRecord {
  id: string;
  userId: string;
  status: AttStatus;
  method?: string;
  note?: string;
  createdAt: string;
  user?: { id: string; name: string; profile?: { firstName?: string; lastName?: string; avatar?: string; studentId?: string } };
}

interface Student {
  id: string;
  name: string;
  profile?: { firstName?: string; lastName?: string; avatar?: string; studentId?: string };
}

/* ─── Helpers ────────────────────────────────────────── */
const STATUS_CFG: Record<AttStatus | 'NOT_MARKED', { label: string; badge: string }> = {
  PRESENT:    { label: 'Present',    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ABSENT:     { label: 'Absent',     badge: 'bg-red-100 text-red-700 border-red-200' },
  LATE:       { label: 'Late',       badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  EXCUSED:    { label: 'Excused',    badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  NOT_MARKED: { label: 'Not Marked', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const monthGradients = [
  'from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600', 'from-purple-500 to-violet-600',
  'from-rose-500 to-pink-600',   'from-cyan-500 to-sky-600',
  'from-fuchsia-500 to-pink-600','from-lime-500 to-green-600',
];

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function exportCsv(date: string, records: AttRecord[], students: Student[]) {
  const recordMap = new Map(records.map(r => [r.userId, r]));
  const rows: string[][] = [['Name', 'Student ID', 'Status', 'Method', 'Time', 'Note']];
  for (const student of students) {
    const rec = recordMap.get(student.id);
    const name = student.profile
      ? [student.profile.firstName, student.profile.lastName].filter(Boolean).join(' ') || student.name
      : student.name;
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

/* ─── Mini Calendar ──────────────────────────────────── */
function MiniCalendar({
  year, month,
  markedDates,
  selectedDate,
  onSelectDate,
  onPrevMonth, onNextMonth,
}: {
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
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrevMonth} className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] transition text-[hsl(var(--muted-foreground))]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-bold text-[hsl(var(--foreground))]">{MONTH_NAMES[month]} {year}</span>
        <button onClick={onNextMonth} className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] transition text-[hsl(var(--muted-foreground))]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-[hsl(var(--muted-foreground))] py-1">{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasRecord = markedDates.has(dateStr);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          return (
            <button
              key={i}
              onClick={() => onSelectDate(dateStr)}
              className={`relative flex flex-col items-center justify-center aspect-square rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                  : isToday
                    ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-200'
                    : 'hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
              }`}
            >
              {day}
              {hasRecord && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-purple-500'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Close Date Result Modal ────────────────────────── */
function CloseDateModal({
  result,
  date,
  onClose,
}: {
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
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {result.marked} student{result.marked !== 1 ? 's' : ''} auto-marked absent
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 max-h-80 overflow-y-auto">
          {result.absentStudents.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">All students were already marked — no changes made.</p>
          ) : (
            <div className="space-y-2">
              {result.absentStudents.map((s: any) => {
                const name = s.profile ? [s.profile.firstName, s.profile.lastName].filter(Boolean).join(' ') || s.name : s.name;
                return (
                  <div key={s.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-red-50 border border-red-100">
                    <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-xs font-bold text-red-700 shrink-0">
                      {(name || '?')[0].toUpperCase()}
                    </div>
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
  const { classId, instituteId } = useParams<{ classId: string; instituteId: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const now = new Date();
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth()); // 0-indexed

  const [selectedDate, setSelectedDate]   = useState('');
  const [classData,    setClassData]      = useState<any>(null);
  const [allMonths,    setAllMonths]      = useState<any[]>([]);
  const [allDates,     setAllDates]       = useState<string[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [dayRecords,   setDayRecords]     = useState<AttRecord[]>([]);

  const [loading,      setLoading]        = useState(true);
  const [dateLoading,  setDateLoading]    = useState(false);
  const [markingId,    setMarkingId]      = useState('');
  const [closingDate,  setClosingDate]    = useState(false);
  const [closeDateResult, setCloseDateResult] = useState<{ marked: number; absentStudents: any[] } | null>(null);
  const [error,        setError]          = useState('');

  /* ─── Initial fetch ──────────────────────────────── */
  useEffect(() => {
    if (!classId) return;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const [classRes, monthsRes, datesRes, studentsRes] = await Promise.all([
          api.get(`/classes/${classId}`),
          api.get(`/classes/${classId}/months`),
          api.get(`/attendance/class-attendance/class/${classId}/dates`),
          api.get(`/attendance/class-attendance/class/${classId}/students`),
        ]);
        setClassData(classRes.data?.class ?? classRes.data);
        setAllMonths(monthsRes.data || []);
        setAllDates(datesRes.data || []);
        setEnrolledStudents(studentsRes.data || []);
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load attendance data');
      } finally { setLoading(false); }
    };
    load();
  }, [classId]);

  /* ─── Load day attendance ────────────────────────── */
  const loadDayAttendance = useCallback(async (date: string) => {
    if (!classId || !date) return;
    setDateLoading(true);
    try {
      const res = await api.get(`/attendance/class-attendance/class/${classId}/date/${date}`);
      setDayRecords(res.data || []);
    } catch {
      setDayRecords([]);
    } finally { setDateLoading(false); }
  }, [classId]);

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    loadDayAttendance(date);
  };

  /* ─── Mark student ───────────────────────────────── */
  const handleMarkStudent = async (userId: string, status: AttStatus) => {
    if (!classId || !selectedDate) return;
    setMarkingId(userId);
    try {
      await api.post('/attendance/class-attendance/mark', {
        classId,
        identifier: userId,
        date: selectedDate,
        status,
        method: 'manual',
      });
      await loadDayAttendance(selectedDate);
      if (!allDates.includes(selectedDate)) {
        setAllDates(prev => [...prev, selectedDate].sort());
      }
    } catch (e: any) {
      console.error('Mark failed:', e.response?.data?.message);
    } finally { setMarkingId(''); }
  };

  /* ─── Close date ─────────────────────────────────── */
  const handleCloseDate = async () => {
    if (!classId || !selectedDate) return;
    setClosingDate(true);
    try {
      const res = await api.post(`/attendance/class-attendance/class/${classId}/close-date/${selectedDate}`);
      setCloseDateResult(res.data);
      await loadDayAttendance(selectedDate);
      if (!allDates.includes(selectedDate)) {
        setAllDates(prev => [...prev, selectedDate].sort());
      }
    } catch (e: any) {
      console.error('Close date failed:', e.response?.data?.message);
    } finally { setClosingDate(false); }
  };

  /* ─── Helpers ────────────────────────────────────── */
  const resolvedInstId = instituteId || classData?.instituteId || classData?.institute?.id || null;
  const mkPath = (suffix: string) => getInstitutePath(resolvedInstId, suffix);
  const markedDatesSet = new Set(allDates);

  const getStudentRecord = (userId: string) => dayRecords.find(r => r.userId === userId);

  const displayName = (s: Student) => {
    if (s.profile) {
      const full = [s.profile.firstName, s.profile.lastName].filter(Boolean).join(' ');
      if (full) return full;
    }
    return s.name;
  };

  /* ─── Stats ──────────────────────────────────────── */
  const presentCount  = dayRecords.filter(r => r.status === 'PRESENT').length;
  const absentCount   = dayRecords.filter(r => r.status === 'ABSENT').length;
  const lateCount     = dayRecords.filter(r => r.status === 'LATE').length;
  const totalEnrolled = enrolledStudents.length;

  /* ─── Loading ────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-[3px] border-purple-600 border-t-transparent animate-spin" />
    </div>
  );

  /* ─── Render ─────────────────────────────────────── */
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Back */}
      <Link
        to={mkPath(`/classes/${classId}`)}
        className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition font-medium group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to class
      </Link>

      <div className="flex gap-6 mt-6">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col gap-4 w-60 shrink-0">
          {/* Nav links */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] px-2 mb-2">Navigation</p>
            <div className="space-y-0.5">
              <Link
                to={mkPath(`/classes/${classId}`)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-all"
              >
                <span className="text-base">📋</span> Class Overview
              </Link>
              <Link
                to={mkPath(`/classes/${classId}/physical-attendance`)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold bg-purple-50 text-purple-700 ring-1 ring-purple-200 transition-all"
              >
                <span className="text-base">📅</span> Attendance
              </Link>
            </div>
          </div>
          {/* Month list */}
          {allMonths.length > 0 && (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] px-2 mb-2">Months</p>
              <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {allMonths.map((m: any, idx: number) => (
                  <Link
                    key={m.id}
                    to={mkPath(`/classes/${classId}/months/${m.id}`)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-all"
                  >
                    <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${monthGradients[idx % monthGradients.length]} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                      {idx + 1}
                    </div>
                    <span className="truncate">{m.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              {classData?.name && <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{classData.name}</p>}
              <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Physical Attendance</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                {allDates.length} date{allDates.length !== 1 ? 's' : ''} recorded · {totalEnrolled} enrolled
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-red-50 border border-red-200 text-red-700">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
            {/* Calendar column */}
            <div className="space-y-4">
              <MiniCalendar
                year={calYear}
                month={calMonth}
                markedDates={markedDatesSet}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                onPrevMonth={() => {
                  if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
                  else setCalMonth(m => m - 1);
                }}
                onNextMonth={() => {
                  if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
                  else setCalMonth(m => m + 1);
                }}
              />
              {/* Legend */}
              <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-3 shadow-sm text-xs space-y-1.5 text-[hsl(var(--muted-foreground))]">
                <p className="font-bold uppercase tracking-widest text-[10px] mb-2">Legend</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                  Date with records
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-lg bg-purple-600 text-white text-[8px] flex items-center justify-center shrink-0 font-bold">15</span>
                  Selected date
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-lg bg-purple-50 ring-1 ring-purple-200 flex items-center justify-center shrink-0" />
                  Today
                </div>
              </div>

              {/* Quick stats (only when date selected) */}
              {selectedDate && !dateLoading && (
                <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-3 shadow-sm space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Summary</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                      <p className="text-lg font-bold text-emerald-700">{presentCount}</p>
                      <p className="text-[10px] font-semibold text-emerald-600">Present</p>
                    </div>
                    <div className="text-center py-2 rounded-xl bg-red-50 border border-red-100">
                      <p className="text-lg font-bold text-red-700">{absentCount}</p>
                      <p className="text-[10px] font-semibold text-red-600">Absent</p>
                    </div>
                    <div className="text-center py-2 rounded-xl bg-amber-50 border border-amber-100">
                      <p className="text-lg font-bold text-amber-700">{lateCount}</p>
                      <p className="text-[10px] font-semibold text-amber-600">Late</p>
                    </div>
                    <div className="text-center py-2 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-lg font-bold text-slate-600">{totalEnrolled - dayRecords.length}</p>
                      <p className="text-[10px] font-semibold text-slate-500">Unmarked</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Day panel */}
            <div className="min-w-0">
              {!selectedDate ? (
                <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-14 text-center shadow-sm h-full flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">Select a date to view attendance</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {markedDatesSet.size > 0
                      ? `${markedDatesSet.size} date${markedDatesSet.size !== 1 ? 's' : ''} with records — dots on calendar`
                      : 'No attendance has been recorded yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Date header */}
                  <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <h2 className="text-base font-bold text-[hsl(var(--foreground))]">
                          {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', {
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                          })}
                        </h2>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                          {markedDatesSet.has(selectedDate) ? 'Class held on this date' : 'No records for this date yet'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {dayRecords.length > 0 && (
                          <button
                            onClick={() => exportCsv(selectedDate, dayRecords, enrolledStudents)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Export CSV
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={handleCloseDate}
                            disabled={closingDate || enrolledStudents.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-md shadow-orange-200/50 transition disabled:opacity-50"
                          >
                            {closingDate ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            )}
                            {closingDate ? 'Closing...' : 'Close Date'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Student list */}
                  {dateLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-6 h-6 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
                    </div>
                  ) : enrolledStudents.length === 0 ? (
                    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-10 text-center">
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">No enrolled students found for this class.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {enrolledStudents.map(student => {
                        const rec = getStudentRecord(student.id);
                        const status = (rec?.status ?? 'NOT_MARKED') as AttStatus | 'NOT_MARKED';
                        const cfg = STATUS_CFG[status];
                        const isMarking = markingId === student.id;
                        const name = displayName(student);
                        const initial = (name || '?')[0].toUpperCase();

                        return (
                          <div key={student.id} className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-3.5 shadow-sm flex items-center gap-3">
                            {/* Avatar */}
                            {student.profile?.avatar ? (
                              <img src={student.profile.avatar} alt={name} className="w-9 h-9 rounded-xl object-cover shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 text-sm font-bold shrink-0">
                                {initial}
                              </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{name}</p>
                              {student.profile?.studentId && (
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{student.profile.studentId}</p>
                              )}
                            </div>

                            {/* Status badge */}
                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 ${cfg.badge}`}>
                              {cfg.label}
                            </span>

                            {/* Mark buttons — admin only */}
                            {isAdmin && (
                              <div className="flex items-center gap-1 shrink-0">
                                {isMarking ? (
                                  <div className="p-2">
                                    <svg className="w-4 h-4 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleMarkStudent(student.id, 'PRESENT')}
                                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${status === 'PRESENT' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}
                                      title="Mark Present"
                                    >P</button>
                                    <button
                                      onClick={() => handleMarkStudent(student.id, 'LATE')}
                                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${status === 'LATE' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'}`}
                                      title="Mark Late"
                                    >L</button>
                                    <button
                                      onClick={() => handleMarkStudent(student.id, 'ABSENT')}
                                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${status === 'ABSENT' ? 'bg-red-600 text-white shadow-sm' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'}`}
                                      title="Mark Absent"
                                    >A</button>
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
        </div>
      </div>

      {/* Close date result modal */}
      {closeDateResult && (
        <CloseDateModal result={closeDateResult} date={selectedDate} onClose={() => setCloseDateResult(null)} />
      )}
    </div>
  );
}
