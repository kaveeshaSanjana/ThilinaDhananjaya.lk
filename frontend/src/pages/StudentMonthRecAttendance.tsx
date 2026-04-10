import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { getInstitutePath } from '../lib/instituteRoutes';

/* ─── Types ─────────────────────────────────────────── */

interface AttendanceInfo {
  status: 'COMPLETED' | 'INCOMPLETE' | 'MANUAL';
  watchedSec: number;
  liveJoinedAt: string | null;
  completedAt: string | null;
  details: unknown[];
}

interface Session {
  startedAt: string;
  endedAt: string | null;
  videoStartPos: number;
  videoEndPos: number;
  totalWatchedSec: number;
  status: 'WATCHING' | 'PAUSED' | 'ENDED';
}

interface RecordingRow {
  id: string;
  title: string;
  duration: number | null;
  thumbnail: string | null;
  topic: string | null;
  isLive: boolean;
  order: number;
  videoType: 'DRIVE' | 'YOUTUBE' | 'ZOOM' | 'OTHER' | null;
  status: 'ANYONE' | 'STUDENTS_ONLY' | 'PAID_ONLY' | 'PRIVATE';
  attendance: AttendanceInfo | null;
  sessionCount: number;
  totalWatchedSec: number;
  lastWatchedAt: string | null;
}

interface MonthAttendanceResponse {
  month: {
    id: string;
    name: string;
    year: number;
    month: number;
    class: { id: string; name: string; subject: string | null };
  };
  recordings: RecordingRow[];
  summary: {
    total: number;
    completed: number;
    incomplete: number;
    notWatched: number;
  };
}

/* ─── Helpers ────────────────────────────────────────── */

function fmtSec(sec: number): string {
  if (!sec || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDateLocal(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function watchProgress(rec: RecordingRow): number {
  if (!rec.duration || rec.duration === 0) return 0;
  return Math.min(100, Math.round((rec.totalWatchedSec / rec.duration) * 100));
}

/* ─── Status Badge ──────────────────────────────────── */

function StatusBadge({ rec }: { rec: RecordingRow }) {
  const s = rec.attendance?.status;
  if (s === 'COMPLETED') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      Completed
    </span>
  );
  if (s === 'INCOMPLETE') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /><circle cx="12" cy="12" r="9" strokeLinecap="round" /></svg>
      In Progress
    </span>
  );
  if (s === 'MANUAL') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200">
      ✎ Manual
    </span>
  );
  if (rec.sessionCount > 0) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
      Viewed
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 text-slate-400 text-xs font-semibold border border-slate-200">
      — Not watched
    </span>
  );
}

/* ─── Recording Card ─────────────────────────────────── */

function RecordingCard({ rec }: { rec: RecordingRow }) {
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const pct = watchProgress(rec);
  const hasSessions = rec.sessionCount > 0;

  const toggleSessions = async () => {
    if (showSessions) { setShowSessions(false); return; }
    setShowSessions(true);
    if (sessions !== null) return; // already fetched
    setLoadingSessions(true);
    try {
      const res = await api.get(`/attendance/my/recording/${rec.id}/sessions`);
      setSessions(res.data);
    } catch { setSessions([]); }
    finally { setLoadingSessions(false); }
  };

  const cardBorder =
    rec.attendance?.status === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50/30' :
    rec.attendance?.status === 'INCOMPLETE' ? 'border-amber-200 bg-amber-50/20' :
    rec.attendance?.status === 'MANUAL'     ? 'border-blue-200 bg-blue-50/20' :
    rec.sessionCount > 0                    ? 'border-slate-200 bg-slate-50/30' :
    'border-[hsl(var(--border))]';

  return (
    <div className={`rounded-2xl border ${cardBorder} bg-[hsl(var(--card))] overflow-hidden shadow-sm transition-all`}>
      <div className="flex items-start gap-4 p-4">
        {/* Thumbnail */}
        <div className="w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-200">
          {rec.thumbnail ? (
            <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center">
              <svg className="w-5 h-5 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="text-[11px] font-bold text-[hsl(var(--muted-foreground)/0.6)] tabular-nums">#{rec.order}</span>
                {rec.isLive && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                  </span>
                )}
                {rec.topic && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] text-[10px] font-medium">
                    {rec.topic}
                  </span>
                )}
              </div>
              <p className="font-semibold text-[hsl(var(--foreground))] text-sm leading-snug">{rec.title}</p>
            </div>
            <StatusBadge rec={rec} />
          </div>

          {/* Progress bar */}
          {(rec.totalWatchedSec > 0 || rec.attendance) && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  {fmtSec(rec.totalWatchedSec)}
                  {rec.duration ? ` / ${fmtSec(rec.duration)}` : ''}
                </span>
                {rec.duration && (
                  <span className={`text-[11px] font-bold ${
                    pct >= 80 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-slate-500'
                  }`}>{pct}%</span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-[hsl(var(--border))] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-slate-400'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Meta row */}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {rec.lastWatchedAt && (
              <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Last: {fmtDateLocal(rec.lastWatchedAt)}
              </span>
            )}
            {rec.attendance?.completedAt && (
              <span className="text-[11px] text-emerald-600 font-medium">
                Completed: {fmtDateLocal(rec.attendance.completedAt)}
              </span>
            )}
            {rec.sessionCount > 0 && (
              <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {rec.sessionCount} session{rec.sessionCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sessions toggle */}
      {hasSessions && (
        <>
          <div className="px-4 pb-3">
            <button
              onClick={toggleSessions}
              className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-glow))] transition"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${showSessions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              {showSessions ? 'Hide' : 'Show'} watch sessions ({rec.sessionCount})
            </button>
          </div>

          {showSessions && (
            <div className="border-t border-[hsl(var(--border))] px-4 py-3 bg-[hsl(var(--muted)/0.2)] space-y-2">
              {loadingSessions && (
                <div className="flex items-center justify-center py-3">
                  <div className="w-5 h-5 rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent animate-spin" />
                </div>
              )}
              {sessions && sessions.map((sess, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-[11px] py-1.5 border-b border-[hsl(var(--border))/0.5] last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      sess.status === 'ENDED' ? 'bg-slate-400' :
                      sess.status === 'WATCHING' ? 'bg-emerald-400 animate-pulse' :
                      'bg-amber-400'
                    }`} />
                    <span className="text-[hsl(var(--muted-foreground))] font-mono truncate">
                      {fmtDateLocal(sess.startedAt)}
                    </span>
                    {sess.endedAt && (
                      <span className="text-[hsl(var(--muted-foreground)/0.6)] font-mono">
                        → {new Date(sess.endedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[hsl(var(--foreground))] font-semibold">{fmtSec(sess.totalWatchedSec)}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                      sess.status === 'ENDED'    ? 'bg-slate-100 text-slate-500' :
                      sess.status === 'WATCHING' ? 'bg-emerald-100 text-emerald-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>{sess.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────── */

export default function StudentMonthRecAttendance() {
  const { classId, monthId, instituteId } = useParams<{ classId: string; monthId: string; instituteId: string }>();
  const [data, setData] = useState<MonthAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!monthId) return;
    setLoading(true);
    setError('');
    api.get(`/attendance/my/month/${monthId}`)
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load attendance data'))
      .finally(() => setLoading(false));
  }, [monthId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-[3px] border-[hsl(var(--primary))] border-t-transparent animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <p className="text-sm font-medium text-red-600">{error}</p>
      <Link to={getInstitutePath(instituteId, `/classes/${classId}/months/${monthId}`)} className="text-xs text-[hsl(var(--primary))] hover:underline">← Back to Recordings</Link>
    </div>
  );

  if (!data) return null;

  const { month, recordings, summary } = data;
  const completionPct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <Link
          to={getInstitutePath(instituteId, `/classes/${classId}/months/${monthId}`)}
          className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] flex items-center gap-1 transition mb-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Recordings
        </Link>
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">My Recording Attendance</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
          {month.class.name}
          {month.class.subject ? ` · ${month.class.subject}` : ''}
          {' · '}{month.name}
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{month.name} — Overall Progress</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {summary.completed} of {summary.total} recording{summary.total !== 1 ? 's' : ''} completed
            </p>
          </div>
          <span className={`text-3xl font-extrabold tabular-nums ${
            completionPct >= 80 ? 'text-emerald-600' :
            completionPct >= 40 ? 'text-amber-600' : 'text-slate-500'
          }`}>{completionPct}%</span>
        </div>

        {/* Overall progress bar */}
        <div className="h-2.5 rounded-full bg-[hsl(var(--border))] overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all ${
              completionPct >= 80 ? 'bg-emerald-500' :
              completionPct >= 40 ? 'bg-amber-400' : 'bg-slate-400'
            }`}
            style={{ width: `${completionPct}%` }}
          />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-slate-700">{summary.total}</p>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">Total</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-emerald-700">{summary.completed}</p>
            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide mt-0.5">Completed</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-amber-700">{summary.incomplete}</p>
            <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mt-0.5">In Progress</p>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-red-600">{summary.notWatched}</p>
            <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wide mt-0.5">Not Watched</p>
          </div>
        </div>
      </div>

      {/* Recordings list */}
      {recordings.length === 0 ? (
        <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">No recordings in this month yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recordings.map(rec => (
            <RecordingCard key={rec.id} rec={rec} />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center text-[11px] text-[hsl(var(--muted-foreground))] pt-2 pb-4">
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          Completed — watched &ge;80% of recording
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-amber-400" />
          In Progress — partially watched
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-300" />
          Not watched
        </span>
      </div>
    </div>
  );
}
