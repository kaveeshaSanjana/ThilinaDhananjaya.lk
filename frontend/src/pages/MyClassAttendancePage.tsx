import { useEffect, useState } from 'react';
import api from '../lib/api';

/* ─── Types ─────────────────────────────────────────────── */

interface AttendanceRecord {
  id: string;
  date: string;
  sessionTime?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  method: string | null;
  note: string | null;
}

interface ClassAttendanceSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendancePercentage: number;
}

interface ClassAttendanceEntry {
  class: { id: string; name: string; subject: string };
  records: AttendanceRecord[];
  summary: ClassAttendanceSummary;
}

interface ApiResponse {
  userId: string;
  totalClasses: number;
  classes: ClassAttendanceEntry[];
}

/* ─── Status config ──────────────────────────────────────── */

const STATUS_CFG = {
  PRESENT: { label: 'Present', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  LATE:    { label: 'Late',    cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  ABSENT:  { label: 'Absent',  cls: 'bg-red-100 text-red-600 border-red-200' },
  EXCUSED: { label: 'Excused', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
} as const;

/* ─── Helpers ────────────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtMonth(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function fmtTime(timeStr: string) {
  // Accepts HH:MM:SS or HH:MM
  const [h, m] = timeStr.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '—';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSessionLabel(rec: AttendanceRecord) {
  const start = rec.sessionTime && rec.sessionTime !== '00:00' ? rec.sessionTime : '';
  if (!start) return '—';
  return fmtTime(start);
}

function getMonthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ─── Summary ring ───────────────────────────────────────── */

function PercentRing({ pct }: { pct: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={72} height={72} viewBox="0 0 72 72" className="flex-shrink-0">
      <circle cx={36} cy={36} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-[hsl(var(--border))]" />
      <circle
        cx={36} cy={36} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x={36} y={40} textAnchor="middle" fontSize={13} fontWeight="bold" fill={color}>{pct}%</text>
    </svg>
  );
}

/* ─── Class attendance card ──────────────────────────────── */

function ClassCard({ entry }: { entry: ClassAttendanceEntry }) {
  const [expanded, setExpanded] = useState(true);
  const { summary, records, class: cls } = entry;

  const monthGroups = records.reduce<Record<string, { monthLabel: string; records: AttendanceRecord[]; summary: ClassAttendanceSummary }>>((acc, rec) => {
    const key = getMonthKey(rec.date);
    if (!acc[key]) {
      acc[key] = {
        monthLabel: fmtMonth(rec.date),
        records: [],
        summary: { total: 0, present: 0, late: 0, absent: 0, excused: 0, attendancePercentage: 0 },
      };
    }

    const group = acc[key];
    group.records.push(rec);
    group.summary.total += 1;
    if (rec.status === 'PRESENT') group.summary.present += 1;
    else if (rec.status === 'LATE') group.summary.late += 1;
    else if (rec.status === 'ABSENT') group.summary.absent += 1;
    else if (rec.status === 'EXCUSED') group.summary.excused += 1;

    return acc;
  }, {});

  const monthItems = Object.entries(monthGroups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, group]) => {
      group.summary.attendancePercentage = group.summary.total > 0
        ? Math.round(((group.summary.present + group.summary.late) / group.summary.total) * 100)
        : 0;
      return group;
    });

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[hsl(var(--muted)/0.4)] transition text-left"
      >
        <PercentRing pct={summary.attendancePercentage} />
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-[hsl(var(--foreground))] truncate">{cls.name}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{cls.subject}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Stat label="Present" value={summary.present} color="text-emerald-600" />
            <Stat label="Late"    value={summary.late}    color="text-amber-600" />
            <Stat label="Absent"  value={summary.absent}  color="text-red-600" />
            {summary.excused > 0 && <Stat label="Excused" value={summary.excused} color="text-slate-500" />}
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{summary.total} sessions</span>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-[hsl(var(--muted-foreground))] flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Records table */}
      {expanded && (
        <div className="border-t border-[hsl(var(--border))]">
          {records.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center text-[hsl(var(--muted-foreground))]">No attendance records yet.</p>
          ) : (
            <div className="space-y-4 p-4">
              {monthItems.map((group) => (
                <div key={`${cls.id}-${group.monthLabel}`} className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                  <div className="px-4 py-3 bg-[hsl(var(--muted)/0.4)] border-b border-[hsl(var(--border))]">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <p className="text-sm font-bold text-[hsl(var(--foreground))]">{group.monthLabel}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Stat label="Present" value={group.summary.present} color="text-emerald-600" />
                        <Stat label="Late" value={group.summary.late} color="text-amber-600" />
                        <Stat label="Absent" value={group.summary.absent} color="text-red-600" />
                        {group.summary.excused > 0 && <Stat label="Excused" value={group.summary.excused} color="text-slate-500" />}
                        <span className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">{group.summary.attendancePercentage}%</span>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const hasSession = group.records.some(r => Boolean(r.sessionTime && r.sessionTime !== '00:00'));
                    const hasCheckIn = group.records.some(r => Boolean(r.checkInAt));
                    const hasCheckOut = group.records.some(r => Boolean(r.checkOutAt));
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-[hsl(var(--muted)/0.25)]">
                              <th className="px-5 py-2.5 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Date</th>
                              {hasSession && <th className="px-5 py-2.5 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Session</th>}
                              {hasCheckIn && <th className="px-5 py-2.5 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Check In</th>}
                              {hasCheckOut && <th className="px-5 py-2.5 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Check Out</th>}
                              <th className="px-5 py-2.5 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Status</th>
                              <th className="px-5 py-2.5 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Method</th>
                              <th className="px-5 py-2.5 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Note</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[hsl(var(--border))]">
                            {group.records.map(rec => {
                              const cfg = STATUS_CFG[rec.status] ?? { label: rec.status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
                              return (
                                <tr key={rec.id} className="hover:bg-[hsl(var(--muted)/0.3)] transition">
                                  <td className="px-5 py-3 text-sm font-medium text-[hsl(var(--foreground))] whitespace-nowrap">{fmtDate(rec.date)}</td>
                                  {hasSession && (
                                    <td className="px-5 py-3 text-sm font-semibold text-[hsl(var(--foreground))] whitespace-nowrap">
                                      {getSessionLabel(rec)}
                                    </td>
                                  )}
                                  {hasCheckIn && (
                                    <td className="px-5 py-3 text-xs text-[hsl(var(--foreground))] whitespace-nowrap">
                                      {fmtDateTime(rec.checkInAt)}
                                    </td>
                                  )}
                                  {hasCheckOut && (
                                    <td className="px-5 py-3 text-xs text-[hsl(var(--foreground))] whitespace-nowrap">
                                      {fmtDateTime(rec.checkOutAt)}
                                    </td>
                                  )}
                                  <td className="px-5 py-3">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.cls}`}>
                                      {cfg.label}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))] capitalize">
                                    {rec.method ? rec.method.replace(/_/g, ' ') : '—'}
                                  </td>
                                  <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                                    {rec.note || '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={`text-[11px] font-semibold ${color}`}>
      {value} {label}
    </span>
  );
}

/* ─── Main page ──────────────────────────────────────────── */

export default function MyClassAttendancePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/attendance/my/class-attendance')
      .then(res => setData(res.data))
      .catch(e => setError(e.response?.data?.message || e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-[3px] border-[hsl(var(--primary))] border-t-transparent animate-spin" />
    </div>
  );

  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-12 shadow-sm">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
    </div>
  );

  const classes = data?.classes ?? [];
  const totalPresent  = classes.reduce((s, c) => s + c.summary.present, 0);
  const totalLate     = classes.reduce((s, c) => s + c.summary.late, 0);
  const totalAbsent   = classes.reduce((s, c) => s + c.summary.absent, 0);
  const totalSessions = classes.reduce((s, c) => s + c.summary.total, 0);
  const overallPct = totalSessions > 0
    ? Math.round(((totalPresent + totalLate) / totalSessions) * 100)
    : 0;

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">My Class Attendance</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            {classes.length} class{classes.length !== 1 ? 'es' : ''} · {totalSessions} total sessions
          </p>
        </div>
      </div>

      {/* Overall summary bar */}
      {totalSessions > 0 && (
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-3">Overall Summary</p>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <PercentRing pct={overallPct} />
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Overall attendance</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <SummaryPill label="Present" value={totalPresent} cls="bg-emerald-100 text-emerald-700 border-emerald-200" />
              <SummaryPill label="Late"    value={totalLate}    cls="bg-amber-100 text-amber-700 border-amber-200" />
              <SummaryPill label="Absent"  value={totalAbsent}  cls="bg-red-100 text-red-600 border-red-200" />
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-2.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${overallPct}%`,
                background: overallPct >= 75 ? '#10b981' : overallPct >= 50 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </div>
      )}

      {/* Per-class cards */}
      {classes.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-5 py-16 text-center">
          <svg className="w-10 h-10 text-[hsl(var(--muted-foreground))] mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">No attendance records found</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 opacity-70">Your attendance will appear here once sessions are recorded</p>
        </div>
      ) : (
        <div className="space-y-4">
          {classes.map(entry => (
            <ClassCard key={entry.class.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryPill({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${cls}`}>
      <span>{value}</span>
      <span className="font-medium opacity-80">{label}</span>
    </div>
  );
}
