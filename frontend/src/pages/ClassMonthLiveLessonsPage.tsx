import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getInstitutePath } from '../lib/instituteRoutes';
import WelcomeMessageEditor, { resolveWelcomeMessage } from '../components/WelcomeMessageEditor';

/* ─── Helpers ─────────────────────────────────────────── */

function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtLectureDuration(start: string, end: string): string {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ─── Types ────────────────────────────────────────────── */

type LectureMode = 'ONLINE' | 'OFFLINE';

interface Lecture {
  id: string;
  monthId: string;
  title: string;
  description?: string | null;
  mode: LectureMode;
  platform?: string | null;
  startTime: string;
  endTime: string;
  sessionLink?: string | null;
  meetingId?: string | null;
  meetingPassword?: string | null;
  maxParticipants?: number | null;
  welcomeMessage?: string | null;
  liveToken?: string | null;
  status: string;
  createdAt: string;
}

function lectureTiming(lec: Lecture): 'upcoming' | 'ongoing' | 'ended' {
  const now = Date.now();
  const start = new Date(lec.startTime).getTime();
  const end   = new Date(lec.endTime).getTime();
  if (now < start) return 'upcoming';
  if (now > end)   return 'ended';
  return 'ongoing';
}

/* ─── Lecture Card ─────────────────────────────────────── */

function LectureLessonCard({
  lec,
  isAdmin,
  welcomeVars,
  onEdit,
  onDelete,
  onStats,
}: {
  lec: Lecture;
  isAdmin?: boolean;
  welcomeVars?: Record<string, string>;
  onEdit?: (lec: Lecture) => void;
  onDelete?: (lec: Lecture) => void;
  onStats?: (lec: Lecture) => void;
}) {
  const [copied, setCopied] = useState('');
  const [localToken, setLocalToken] = useState<string | null>(lec.liveToken ?? null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const timing = lectureTiming(lec);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    });
  };

  const handleShareLink = async () => {
    if (localToken) {
      copyText(`${window.location.origin}/lecture-live/${localToken}`, 'share');
      return;
    }
    setGeneratingToken(true);
    try {
      const res = await api.post(`/lectures/${lec.id}/generate-token`);
      const token = res.data.liveToken as string;
      setLocalToken(token);
      copyText(`${window.location.origin}/lecture-live/${token}`, 'share');
    } catch {
      // silently fail
    } finally {
      setGeneratingToken(false);
    }
  };

  const timingCfg = {
    upcoming: {
      label: 'Upcoming',
      dot: 'bg-blue-400',
      banner: 'border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/60',
      badge: 'bg-blue-100 text-blue-700 border-blue-200',
      accent: 'text-blue-600',
      bar: 'bg-blue-200',
    },
    ongoing: {
      label: 'Live Now',
      dot: 'bg-red-500',
      banner: 'border-red-300 bg-gradient-to-br from-red-50/80 via-white to-orange-50/60',
      badge: 'bg-red-100 text-red-700 border-red-200',
      accent: 'text-red-600',
      bar: 'bg-red-200',
    },
    ended: {
      label: 'Ended',
      dot: 'bg-slate-400',
      banner: 'border-slate-200 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60',
      badge: 'bg-slate-100 text-slate-500 border-slate-200',
      accent: 'text-slate-500',
      bar: 'bg-slate-200',
    },
  }[timing];

  const dateStr = new Date(lec.startTime).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const duration = fmtLectureDuration(lec.startTime, lec.endTime);

  return (
    <div className={`rounded-2xl border-2 overflow-hidden shadow-md transition-all hover:shadow-lg ${timingCfg.banner}`}>
      {/* Top accent bar */}
      <div className={`h-1 w-full ${timingCfg.bar}`} />

      <div className="p-4">
        {/* Row 1: timing badge + mode/platform badges */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Timing badge */}
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${timingCfg.badge}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                timing === 'ongoing' ? `${timingCfg.dot} animate-pulse` : timingCfg.dot
              }`} />
              {timingCfg.label}
            </span>
            {/* Mode */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              lec.mode === 'ONLINE'
                ? 'bg-violet-100 text-violet-700 border-violet-200'
                : 'bg-orange-100 text-orange-700 border-orange-200'
            }`}>
              {lec.mode === 'ONLINE' ? '🌐' : '🏫'} {lec.mode === 'ONLINE' ? 'Online' : 'Offline'}
            </span>
            {/* Platform */}
            {lec.platform && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                {lec.platform}
              </span>
            )}
            {/* Visibility — admin only */}
            {isAdmin && (() => {
              const visMap: Record<string, { label: string; cls: string }> = {
                ANYONE:        { label: '🌍 Anyone',        cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                STUDENTS_ONLY: { label: '🎓 Students Only', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
                PAID_ONLY:     { label: '💳 Paid Only',     cls: 'bg-amber-100 text-amber-700 border-amber-200' },
                PRIVATE:       { label: '🔒 Private',       cls: 'bg-rose-100 text-rose-700 border-rose-200' },
                INACTIVE:      { label: '⏸ Inactive',      cls: 'bg-slate-100 text-slate-500 border-slate-200' },
              };
              const vis = visMap[lec.status] ?? { label: lec.status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
              return (
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${vis.cls}`}>
                  {vis.label}
                </span>
              );
            })()}
          </div>
          {/* Duration pill */}
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]">
            ⏱ {duration}
          </span>
        </div>

        {/* Row 2: title + description */}
        <h3 className={`text-base font-bold leading-snug mb-0.5 ${timing === 'ended' ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'}`}>
          {lec.title}
        </h3>
        {lec.description && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 leading-relaxed">{lec.description}</p>
        )}

        {/* Welcome message (resolved for current user) */}
        {lec.welcomeMessage && welcomeVars && (() => {
          const resolved = resolveWelcomeMessage(lec.welcomeMessage, welcomeVars);
          return (
            <div
              className={`mt-2 mb-2 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                timing === 'ongoing'
                  ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200 text-red-900'
                  : timing === 'upcoming'
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-900'
                  : 'bg-[hsl(var(--muted))] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'
              }`}
              dangerouslySetInnerHTML={{ __html: resolved }}
            />
          );
        })()}
        {/* Admin preview: show indicator if welcome message is set but no vars */}
        {lec.welcomeMessage && !welcomeVars && isAdmin && (
          <div className="mt-2 mb-2 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-600">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Welcome message set ✓
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-[hsl(var(--border))] my-3" />

        {/* Row 3: date/time details */}
        <div className="flex items-center gap-4 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${timingCfg.badge} border`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Date</p>
              <p className="text-xs font-bold text-[hsl(var(--foreground))]">{dateStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${timingCfg.badge} border`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Time</p>
              <p className="text-xs font-bold text-[hsl(var(--foreground))]">
                {fmtTime(lec.startTime)} – {fmtTime(lec.endTime)}
              </p>
            </div>
          </div>
          {lec.maxParticipants && (
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${timingCfg.badge} border`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Capacity</p>
                <p className="text-xs font-bold text-[hsl(var(--foreground))]">{lec.maxParticipants} participants</p>
              </div>
            </div>
          )}
        </div>

        {/* Row 4: meeting details (Online only) */}
        {lec.mode === 'ONLINE' && (lec.meetingId || lec.meetingPassword || lec.sessionLink) && (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-3 mb-3 space-y-2">
            <p className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">Session Details</p>
            <div className="flex items-center gap-3 flex-wrap">
              {lec.meetingId && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm">
                  <span className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Meeting ID</span>
                  <span className="text-sm font-mono font-bold text-[hsl(var(--foreground))]">{lec.meetingId}</span>
                  <button
                    onClick={() => copyText(lec.meetingId!, 'id')}
                    className="ml-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition"
                    title="Copy Meeting ID"
                  >
                    {copied === 'id'
                      ? <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    }
                  </button>
                </div>
              )}
              {lec.meetingPassword && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm">
                  <span className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Password</span>
                  <span className="text-sm font-mono font-bold text-[hsl(var(--foreground))]">{lec.meetingPassword}</span>
                  <button
                    onClick={() => copyText(lec.meetingPassword!, 'pass')}
                    className="ml-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition"
                    title="Copy Password"
                  >
                    {copied === 'pass'
                      ? <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    }
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Row 5: action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {lec.sessionLink && timing !== 'ended' && (
            <a
              href={lec.sessionLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                timing === 'ongoing'
                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200'
                  : 'bg-[hsl(var(--primary))] text-white hover:opacity-90 shadow-[hsl(var(--primary)/0.25)]'
              }`}
            >
              {timing === 'ongoing' && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
              )}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {timing === 'ongoing' ? 'Join Live Session' : 'Join Lecture'}
            </a>
          )}
          {lec.sessionLink && timing === 'ended' && (
            <a
              href={lec.sessionLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] transition border border-[hsl(var(--border))]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Link
            </a>
          )}
          {isAdmin && (
            <div className="ml-auto flex items-center gap-1.5">
              {/* Share / Generate live link */}
              <button
                onClick={handleShareLink}
                disabled={generatingToken}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border ${
                  localToken
                    ? copied === 'share'
                      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                      : 'text-violet-600 bg-violet-50 hover:bg-violet-100 border-violet-200'
                    : 'text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
                title={localToken ? 'Copy shareable join link' : 'Generate shareable join link'}
              >
                {generatingToken ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : copied === 'share' ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                )}
                {generatingToken ? 'Generating…' : copied === 'share' ? 'Copied!' : localToken ? 'Copy Link' : 'Get Link'}
              </button>
              <button
                onClick={() => onEdit?.(lec)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition"
                title="Edit lesson"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <button
                onClick={() => onStats?.(lec)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition"
                title="View join statistics"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Stats
              </button>
              <button
                onClick={() => onDelete?.(lec)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition"
                title="Delete lesson"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          )}
          {lec.mode === 'OFFLINE' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-700 font-semibold">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              In-person lecture — attend at venue
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Create / Edit Modal ─────────────────────────────── */

const EMPTY_FORM = {
  title: '',
  description: '',
  mode: 'ONLINE' as LectureMode,
  platform: '',
  startTime: '',
  endTime: '',
  sessionLink: '',
  meetingId: '',
  meetingPassword: '',
  maxParticipants: '',
  welcomeMessage: '',
  status: 'STUDENTS_ONLY',
};

function CreateLectureModal({
  monthId,
  onClose,
  onCreated,
}: {
  monthId: string;
  onClose: () => void;
  onCreated: (lec: Lecture) => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setErr('Title is required'); return; }
    if (!form.startTime || !form.endTime) { setErr('Start and end time are required'); return; }
    if (new Date(form.endTime) <= new Date(form.startTime)) { setErr('End time must be after start time'); return; }
    setSaving(true); setErr('');
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        mode: form.mode,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        status: form.status,
      };
      if (form.description.trim()) body.description = form.description.trim();
      if (form.platform.trim())   body.platform    = form.platform.trim();
      if (form.sessionLink.trim()) body.sessionLink = form.sessionLink.trim();
      if (form.meetingId.trim())  body.meetingId   = form.meetingId.trim();
      if (form.meetingPassword.trim()) body.meetingPassword = form.meetingPassword.trim();
      if (form.maxParticipants)   body.maxParticipants = Number(form.maxParticipants);
      if (form.welcomeMessage.trim()) body.welcomeMessage = form.welcomeMessage.trim();
      const res = await api.post(`/lectures/month/${monthId}`, body);
      onCreated(res.data?.lecture ?? res.data);
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Failed to create lecture');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/30 focus:border-[hsl(var(--ring))] transition';
  const labelCls = 'block text-sm font-semibold text-[hsl(var(--foreground))]/80 mb-1.5';
  const sectionCls = 'bg-[hsl(var(--muted))]/50 rounded-2xl p-4 space-y-4 ring-1 ring-[hsl(var(--border))]/50';
  const sectionLabelCls = 'text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl bg-[hsl(var(--card))] rounded-2xl shadow-2xl border border-[hsl(var(--border))] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">Create Live Lesson</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Schedule a new live class session</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">
            {err && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                <p className="text-sm text-red-500">{err}</p>
              </div>
            )}

            {/* Basic Info */}
            <div className={sectionCls}>
              <p className={sectionLabelCls}>Basic Info</p>
              <div>
                <label className={labelCls}>Title <span className="text-red-500">*</span></label>
                <input className={inputCls} placeholder="e.g. Chapter 5 — Grammar" value={form.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Optional details..." value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Visibility</label>
                  <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
                    <option value="ANYONE">Anyone</option>
                    <option value="STUDENTS_ONLY">Students Only</option>
                    <option value="PAID_ONLY">Paid Only</option>
                    <option value="PRIVATE">Private</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Max Participants</label>
                  <input type="number" min={1} className={inputCls} placeholder="e.g. 100" value={form.maxParticipants} onChange={e => set('maxParticipants', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className={sectionCls}>
              <p className={sectionLabelCls}>Schedule</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Start Time <span className="text-red-500">*</span></label>
                  <input type="datetime-local" className={inputCls} value={form.startTime} onChange={e => set('startTime', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>End Time <span className="text-red-500">*</span></label>
                  <input type="datetime-local" className={inputCls} value={form.endTime} onChange={e => set('endTime', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Session */}
            <div className={sectionCls}>
              <p className={sectionLabelCls}>Session</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Mode <span className="text-red-500">*</span></label>
                  <select className={inputCls} value={form.mode} onChange={e => set('mode', e.target.value)}>
                    <option value="ONLINE">Online</option>
                    <option value="OFFLINE">Offline</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Platform</label>
                  <input className={inputCls} placeholder="Zoom, Meet, etc." value={form.platform} onChange={e => set('platform', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Session Link</label>
                <input className={inputCls} placeholder="https://zoom.us/j/..." value={form.sessionLink} onChange={e => set('sessionLink', e.target.value)} />
              </div>
              {form.mode === 'ONLINE' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Meeting ID</label>
                    <input className={inputCls} placeholder="123 456 7890" value={form.meetingId} onChange={e => set('meetingId', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Password</label>
                    <input className={inputCls} placeholder="abc123" value={form.meetingPassword} onChange={e => set('meetingPassword', e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            {/* Welcome Message */}
            <div className={sectionCls}>
              <p className={sectionLabelCls}>Welcome Message</p>
              <WelcomeMessageEditor value={form.welcomeMessage} onChange={v => set('welcomeMessage', v)} />
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-2 pb-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm font-semibold hover:bg-[hsl(var(--muted))] transition">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-semibold hover:from-purple-600 hover:to-indigo-700 transition shadow-lg shadow-purple-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {saving ? 'Creating...' : 'Create Lesson'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ─── Edit Lecture Modal ───────────────────────────────── */

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditLectureModal({
  lec,
  onClose,
  onUpdated,
}: {
  lec: Lecture;
  onClose: () => void;
  onUpdated: (updated: Lecture) => void;
}) {
  const [form, setForm] = useState({
    title: lec.title,
    description: lec.description ?? '',
    mode: lec.mode,
    platform: lec.platform ?? '',
    startTime: toLocalDatetime(lec.startTime),
    endTime: toLocalDatetime(lec.endTime),
    sessionLink: lec.sessionLink ?? '',
    meetingId: lec.meetingId ?? '',
    meetingPassword: lec.meetingPassword ?? '',
    maxParticipants: lec.maxParticipants ? String(lec.maxParticipants) : '',
    welcomeMessage: lec.welcomeMessage ?? '',
    status: lec.status,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setErr('Title is required'); return; }
    if (!form.startTime || !form.endTime) { setErr('Start and end time are required'); return; }
    if (new Date(form.endTime) <= new Date(form.startTime)) { setErr('End time must be after start time'); return; }
    setSaving(true); setErr('');
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        mode: form.mode,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        status: form.status,
        description: form.description.trim() || null,
        platform: form.platform.trim() || null,
        sessionLink: form.sessionLink.trim() || null,
        meetingId: form.meetingId.trim() || null,
        meetingPassword: form.meetingPassword.trim() || null,
        maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : null,
        welcomeMessage: form.welcomeMessage.trim() || null,
      };
      const res = await api.patch(`/lectures/${lec.id}`, body);
      onUpdated(res.data?.lecture ?? res.data);
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Failed to update lecture');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-base text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.4)] transition';
  const labelCls = 'block text-sm font-semibold text-[hsl(var(--muted-foreground))] mb-1.5';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl bg-[hsl(var(--card))] rounded-2xl shadow-2xl border border-[hsl(var(--border))] max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-7 py-5 border-b border-[hsl(var(--border))] shrink-0">
          <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">Edit Live Lesson</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-7 py-6 space-y-5">
          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{err}</p>}
          <div>
            <label className={labelCls}>Title <span className="text-red-500">*</span></label>
            <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Mode <span className="text-red-500">*</span></label>
              <select className={inputCls} value={form.mode} onChange={e => set('mode', e.target.value)}>
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Platform</label>
              <input className={inputCls} value={form.platform} onChange={e => set('platform', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Time <span className="text-red-500">*</span></label>
              <input type="datetime-local" className={inputCls} value={form.startTime} onChange={e => set('startTime', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>End Time <span className="text-red-500">*</span></label>
              <input type="datetime-local" className={inputCls} value={form.endTime} onChange={e => set('endTime', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Session Link</label>
            <input className={inputCls} value={form.sessionLink} onChange={e => set('sessionLink', e.target.value)} />
          </div>
          {form.mode === 'ONLINE' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Meeting ID</label>
                <input className={inputCls} value={form.meetingId} onChange={e => set('meetingId', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input className={inputCls} value={form.meetingPassword} onChange={e => set('meetingPassword', e.target.value)} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Max Participants</label>
              <input type="number" min={1} className={inputCls} value={form.maxParticipants} onChange={e => set('maxParticipants', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Visibility</label>
              <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="ANYONE">Anyone</option>
                <option value="STUDENTS_ONLY">Students Only</option>
                <option value="PAID_ONLY">Paid Only</option>
                <option value="PRIVATE">Private</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
          <WelcomeMessageEditor value={form.welcomeMessage} onChange={v => set('welcomeMessage', v)} />
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[hsl(var(--border))]">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-7 py-3 rounded-xl text-sm font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 transition flex items-center gap-2 shadow-lg shadow-violet-500/20">
              {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ─── Delete Confirm Modal ─────────────────────────────── */

function DeleteConfirmModal({
  lec,
  onClose,
  onDeleted,
}: {
  lec: Lecture;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  const handleDelete = async () => {
    setDeleting(true); setErr('');
    try {
      await api.delete(`/lectures/${lec.id}`);
      onDeleted(lec.id);
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Failed to delete');
      setDeleting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-[hsl(var(--card))] rounded-2xl shadow-2xl border border-[hsl(var(--border))] p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-100 mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-[hsl(var(--foreground))] text-center mb-1">Delete Lesson</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] text-center mb-5">
          Are you sure you want to delete <span className="font-semibold text-[hsl(var(--foreground))]">"{lec.title}"</span>? This cannot be undone.
        </p>
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{err}</p>}
        <div className="flex items-center gap-3">
          <button onClick={onClose} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] transition">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition flex items-center justify-center gap-2">
            {deleting && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ───────────────────────────────────────────────────────── */
/*              LECTURE STATS MODAL                        */
/* ═══════════════════════════════════════════════════════ */

function LectureStatsModal({ lec, onClose }: { lec: Lecture; onClose: () => void }) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get(`/lectures/${lec.id}/stats`)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load statistics'))
      .finally(() => setLoading(false));
  }, [lec.id]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Join Statistics</h2>
              <p className="text-xs text-slate-500 truncate max-w-xs">{lec.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <svg className="w-7 h-7 animate-spin text-sky-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            </div>
          )}
          {error && <p className="text-sm text-red-600 text-center py-6">{error}</p>}
          {!loading && !error && data && (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <p className="text-2xl font-bold text-slate-800">{data.totalCount}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Total Joined</p>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-center">
                  <p className="text-2xl font-bold text-blue-700">{data.registeredCount}</p>
                  <p className="text-xs text-blue-600 font-medium mt-0.5">Registered Students</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{data.guestCount}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">Public Guests</p>
                </div>
              </div>

              {/* Registered students table */}
              {data.registeredJoins.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Registered Students ({data.registeredCount})
                  </h3>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Name</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">ID</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Phone</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Joined At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.registeredJoins.map((j: any) => (
                          <tr key={j.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{j.user?.profile?.fullName || j.user?.email || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{j.user?.profile?.instituteId || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-500">{j.user?.profile?.phone || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-400 text-xs">{new Date(j.joinedAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Public guests table */}
              {data.guestJoins.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Public Guests ({data.guestCount})
                  </h3>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Name</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Phone</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Email</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Note</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Joined At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.guestJoins.map((g: any) => (
                          <tr key={g.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{g.fullName}</td>
                            <td className="px-4 py-2.5 text-slate-600">{g.phone}</td>
                            <td className="px-4 py-2.5 text-slate-500">{g.email || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-400 text-xs">{g.note || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-400 text-xs">{new Date(g.joinedAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {data.totalCount === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <p className="text-sm font-medium">No one has joined yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ───────────────────────────────────────────────────────── */
/*              CLASS MONTH LIVE LESSONS PAGE             */
/* ═══════════════════════════════════════════════════════ */

export default function ClassMonthLiveLessonsPage() {
  const { classId, monthId, instituteId } = useParams<{ classId: string; monthId: string; instituteId: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [lectures, setLectures]     = useState<Lecture[]>([]);
  const [monthName, setMonthName]   = useState('');
  const [className, setClassName]   = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showCreate, setShowCreate]   = useState(false);
  const [editingLec, setEditingLec]     = useState<Lecture | null>(null);
  const [deletingLec, setDeletingLec]   = useState<Lecture | null>(null);
  const [statsLec, setStatsLec]         = useState<Lecture | null>(null);

  const welcomeVars = useMemo(() => ({
    '{{studentName}}': (user as any)?.profile?.fullName || user?.email?.split('@')[0] || 'Student',
    '{{month}}': monthName,
    '{{date}}': new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    '{{className}}': className,
    '{{teacherName}}': 'Sir',
    '{{recordingTitle}}': '',
  }), [user, monthName, className]);

  useEffect(() => {
    if (!classId || !monthId) return;
    const load = async () => {
      try {
        const [classRes, lecturesRes] = await Promise.all([
          api.get(`/classes/${classId}`),
          api.get(`/lectures/month/${monthId}`),
        ]);
        setClassName(classRes.data?.name || '');
        const payload = lecturesRes.data;
        setMonthName(payload?.month?.name || '');
        const list = Array.isArray(payload) ? payload : (payload?.lectures ?? payload?.data ?? []);
        setLectures(list);
      } catch (e: any) {
        setError(e.response?.data?.message || e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [classId, monthId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-[3px] border-violet-500 border-t-transparent animate-spin" />
    </div>
  );

  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-12 shadow-sm">
      <p className="text-[hsl(var(--muted-foreground))] text-sm font-medium">{error}</p>
      <Link to={getInstitutePath(instituteId, `/classes/${classId}/months/${monthId}`)} className="mt-4 inline-flex items-center gap-1.5 text-sm text-[hsl(var(--primary))] font-semibold hover:opacity-80">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to recordings
      </Link>
    </div>
  );

  const ongoingLectures  = lectures.filter(l => lectureTiming(l) === 'ongoing');
  const upcomingLectures = lectures.filter(l => lectureTiming(l) === 'upcoming');
  const endedLectures    = lectures.filter(l => lectureTiming(l) === 'ended');

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Back link */}
      <Link
        to={getInstitutePath(instituteId, `/classes/${classId}/months/${monthId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to recordings
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            {className && <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{className}</p>}
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">
              {monthName ? `${monthName} — Live Lessons` : 'Live Lessons'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {lectures.length} lesson{lectures.length !== 1 ? 's' : ''}
              </p>
              {ongoingLectures.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold border border-red-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {ongoingLectures.length} Live Now
                </span>
              )}
              {upcomingLectures.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-200">
                  {upcomingLectures.length} Upcoming
                </span>
              )}
            </div>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Create
          </button>
        )}
      </div>

      {/* Lessons grid */}
      {lectures.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-5 py-16 text-center">
          <svg className="w-10 h-10 text-[hsl(var(--muted-foreground))] mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">No live lessons scheduled for this month</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 opacity-70">Check back later for upcoming sessions</p>
        </div>
      ) : (
        <>
          {ongoingLectures.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-red-600 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Live Now
              </h2>
              <div className="grid gap-4">
                {ongoingLectures.map(lec => <LectureLessonCard key={lec.id} lec={lec} isAdmin={isAdmin} welcomeVars={welcomeVars} onEdit={setEditingLec} onDelete={setDeletingLec} onStats={setStatsLec} />)}
              </div>
            </div>
          )}

          {upcomingLectures.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">Upcoming</h2>
              <div className="grid gap-4">
                {upcomingLectures.map(lec => <LectureLessonCard key={lec.id} lec={lec} isAdmin={isAdmin} welcomeVars={welcomeVars} onEdit={setEditingLec} onDelete={setDeletingLec} onStats={setStatsLec} />)}
              </div>
            </div>
          )}

          {endedLectures.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">Past</h2>
              <div className="grid gap-4">
                {endedLectures.map(lec => <LectureLessonCard key={lec.id} lec={lec} isAdmin={isAdmin} welcomeVars={welcomeVars} onEdit={setEditingLec} onDelete={setDeletingLec} onStats={setStatsLec} />)}
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && monthId && (
        <CreateLectureModal
          monthId={monthId}
          onClose={() => setShowCreate(false)}
          onCreated={lec => { setLectures(prev => [...prev, lec]); setShowCreate(false); }}
        />
      )}
      {editingLec && (
        <EditLectureModal
          lec={editingLec}
          onClose={() => setEditingLec(null)}
          onUpdated={updated => {
            setLectures(prev => prev.map(l => l.id === updated.id ? updated : l));
            setEditingLec(null);
          }}
        />
      )}
      {deletingLec && (
        <DeleteConfirmModal
          lec={deletingLec}
          onClose={() => setDeletingLec(null)}
          onDeleted={id => {
            setLectures(prev => prev.filter(l => l.id !== id));
            setDeletingLec(null);
          }}
        />
      )}
      {statsLec && (
        <LectureStatsModal
          lec={statsLec}
          onClose={() => setStatsLec(null)}
        />
      )}
    </div>
  );
}
