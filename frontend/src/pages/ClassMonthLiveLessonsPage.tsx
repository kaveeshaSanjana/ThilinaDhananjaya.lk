import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getInstitutePath } from '../lib/instituteRoutes';
import WelcomeMessageEditor from '../components/WelcomeMessageEditor';

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
  cardImageUrl?: string | null;
  bgMediaUrl?: string | null;
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

interface LectureStudentJoinRow {
  userId: string;
  fullName: string;
  instituteId: string;
  email: string;
  phone: string;
  joined: boolean;
  joinedAt: string | null;
}

/* ─── Lecture Card ─────────────────────────────────────── */

function LectureLessonCard({
  lec,
  isAdmin,
  onEdit,
  onDelete,
  onStats,
}: {
  lec: Lecture;
  isAdmin?: boolean;
  onEdit?: (lec: Lecture) => void;
  onDelete?: (lec: Lecture) => void;
  onStats?: (lec: Lecture) => void;
}) {
  const [copied, setCopied] = useState('');
  const [localToken, setLocalToken] = useState<string | null>(lec.liveToken ?? null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);
  const timing = lectureTiming(lec);
  const studentJoinPath = !isAdmin && localToken
    ? (timing === 'ended' ? `/lecture-live/${localToken}` : `/lecture-live/${localToken}?autoJoin=1`)
    : null;
  const listThumbUrl = useMemo(() => {
    const cardImage = (lec.cardImageUrl ?? '').trim();
    if (cardImage) return cardImage;

    const bgMedia = (lec.bgMediaUrl ?? '').trim();
    if (!bgMedia) return null;
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(bgMedia)) return null;
    return bgMedia;
  }, [lec.cardImageUrl, lec.bgMediaUrl]);

  useEffect(() => {
    setThumbBroken(false);
  }, [listThumbUrl]);

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

        {/* Row 2: thumbnail + title + description */}
        <div className="mb-3 flex items-start gap-3">
          {listThumbUrl && !thumbBroken && (
            <div className="w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--muted))] shrink-0">
              <img
                src={listThumbUrl}
                alt={`${lec.title} thumbnail`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                onError={() => setThumbBroken(true)}
              />
            </div>
          )}
          <div className="min-w-0">
            <h3 className={`text-base font-bold leading-snug mb-0.5 ${timing === 'ended' ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'}`}>
              {lec.title}
            </h3>
            {lec.description && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{lec.description}</p>
            )}
          </div>
        </div>

        {/* Admin preview: show indicator if welcome message is set but no vars */}
        {lec.welcomeMessage && isAdmin && (
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
          {!isAdmin && studentJoinPath && (
            <Link
              to={studentJoinPath}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                timing === 'ended'
                  ? 'text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] border border-[hsl(var(--border))]'
                  : timing === 'ongoing'
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
              {timing === 'ongoing' ? 'Join Live Session' : timing === 'ended' ? 'Open Lecture Page' : 'Join Lecture'}
            </Link>
          )}
          {!isAdmin && !studentJoinPath && lec.sessionLink && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] border border-[hsl(var(--border))]">
              Preparing secure join link...
            </span>
          )}
          {isAdmin && localToken && (
            <a
              href={`/lecture-live/${localToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] hover:bg-[hsl(var(--primary)/0.16)] border border-[hsl(var(--primary)/0.25)] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open Join Page
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
  cardImageUrl: '',
  bgMediaUrl: '',
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
      if (form.cardImageUrl.trim()) body.cardImageUrl = form.cardImageUrl.trim();
      if (form.bgMediaUrl.trim()) body.bgMediaUrl = form.bgMediaUrl.trim();
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

            {/* Appearance */}
            <div className={sectionCls}>
              <p className={sectionLabelCls}>Join Page Appearance</p>
              <div>
                <label className={labelCls}>Card Image URL</label>
                <input className={inputCls} placeholder="https://... (image shown on join page panel)" value={form.cardImageUrl} onChange={e => set('cardImageUrl', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Background Image / Video URL</label>
                <input className={inputCls} placeholder="https://... (.jpg, .png or .mp4 — video loops automatically)" value={form.bgMediaUrl} onChange={e => set('bgMediaUrl', e.target.value)} />
                {form.bgMediaUrl && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    {/\.(mp4|webm|ogg)$/i.test(form.bgMediaUrl) ? '🎬 Video detected — will loop silently' : '🖼️ Image detected'}
                  </p>
                )}
              </div>
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
    cardImageUrl: lec.cardImageUrl ?? '',
    bgMediaUrl: lec.bgMediaUrl ?? '',
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
        cardImageUrl: form.cardImageUrl.trim() || null,
        bgMediaUrl: form.bgMediaUrl.trim() || null,
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
          <div className="space-y-3">
            <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">Join Page Appearance</p>
            <div>
              <label className={labelCls}>Card Image URL</label>
              <input className={inputCls} placeholder="https://... (image shown on join page panel)" value={form.cardImageUrl} onChange={e => set('cardImageUrl', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Background Image / Video URL</label>
              <input className={inputCls} placeholder="https://... (.jpg, .png or .mp4 — video loops automatically)" value={form.bgMediaUrl} onChange={e => set('bgMediaUrl', e.target.value)} />
              {form.bgMediaUrl && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  {/\.(mp4|webm|ogg)$/i.test(form.bgMediaUrl) ? '🎬 Video — will loop silently' : '🖼️ Image'}
                </p>
              )}
            </div>
          </div>
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

function LectureStatsModal({ lec, classId, onClose }: { lec: Lecture; classId?: string; onClose: () => void }) {
  const [data, setData]       = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      setLoading(true);
      setError('');
      try {
        const statsRes = await api.get(`/lectures/${lec.id}/stats`);
        if (!active) return;

        setData(statsRes.data);
        if (classId) {
          try {
            const enrollRes = await api.get(`/enrollments/class/${classId}`);
            if (!active) return;
            setEnrollments(Array.isArray(enrollRes.data) ? enrollRes.data : []);
          } catch {
            if (!active) return;
            setEnrollments([]);
          }
        } else {
          setEnrollments([]);
        }
      } catch {
        if (!active) return;
        setError('Failed to load statistics');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadStats();
    return () => {
      active = false;
    };
  }, [lec.id, classId]);

  const registeredJoins = useMemo(() => Array.isArray(data?.registeredJoins) ? data.registeredJoins : [], [data]);
  const guestJoins = useMemo(() => Array.isArray(data?.guestJoins) ? data.guestJoins : [], [data]);

  const enrolledStudentRows = useMemo<LectureStudentJoinRow[]>(() => {
    const joinedByUserId = new Map<string, any>();
    registeredJoins.forEach((join: any) => {
      const joinedUserId = (join?.user?.id || join?.userId || '') as string;
      if (joinedUserId) joinedByUserId.set(joinedUserId, join);
    });

    const rows: LectureStudentJoinRow[] = (Array.isArray(enrollments) ? enrollments : []).map((enr: any) => {
      const user = enr?.user || {};
      const profile = user?.profile || {};
      const userId = (enr?.userId || user?.id || '') as string;
      const joined = userId ? joinedByUserId.get(userId) : null;

      return {
        userId,
        fullName: profile?.fullName || user?.email || 'Unknown',
        instituteId: profile?.instituteId || '-',
        email: user?.email || '-',
        phone: profile?.phone || '-',
        joined: Boolean(joined),
        joinedAt: joined?.joinedAt || null,
      };
    });

    if (rows.length === 0 && registeredJoins.length > 0) {
      return registeredJoins.map((join: any) => {
        const user = join?.user || {};
        const profile = user?.profile || {};

        return {
          userId: (user?.id || join?.userId || '') as string,
          fullName: profile?.fullName || user?.email || 'Unknown',
          instituteId: profile?.instituteId || '-',
          email: user?.email || '-',
          phone: profile?.phone || '-',
          joined: true,
          joinedAt: join?.joinedAt || null,
        };
      });
    }

    return rows.sort((a, b) => {
      if (a.joined !== b.joined) return a.joined ? -1 : 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [enrollments, registeredJoins]);

  const joinedRegisteredCount = enrolledStudentRows.filter((row) => row.joined).length;
  const notJoinedCount = Math.max(enrolledStudentRows.length - joinedRegisteredCount, 0);
  const joinedRatePct = enrolledStudentRows.length > 0
    ? Math.round((joinedRegisteredCount / enrolledStudentRows.length) * 100)
    : 0;

  const handleExport = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const ExcelJSImport = await import('exceljs');
      const workbook = new ExcelJSImport.Workbook();
      workbook.creator = 'Thilina Dhananjaya';
      workbook.created = new Date();

      const XLSX_BORDER_STYLE = {
        top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
      };

      const applyHeaderStyle = (row: any) => {
        row.height = 22;
        row.eachCell((cell: any) => {
          cell.font = { bold: true, color: { argb: 'FF1E293B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = XLSX_BORDER_STYLE;
        });
      };

      const applyRowBorderRange = (worksheet: any, fromRow: number, toRow: number) => {
        for (let rowNo = fromRow; rowNo <= toRow; rowNo += 1) {
          const row = worksheet.getRow(rowNo);
          row.eachCell({ includeEmpty: true }, (cell: any) => {
            cell.border = XLSX_BORDER_STYLE;
            if (!cell.alignment) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
          });
        }
      };

      const autoFitColumns = (worksheet: any, minWidth = 10, maxWidth = 60) => {
        if (!worksheet?.columns) return;

        worksheet.columns.forEach((column: any) => {
          let maxLen = 0;
          column.eachCell({ includeEmpty: true }, (cell: any) => {
            const value = cell.value;
            let text = '';

            if (value == null) {
              text = '';
            } else if (typeof value === 'object') {
              if ('text' in value) text = String((value as { text?: unknown }).text ?? '');
              else if ('richText' in value) text = String((value as { richText?: Array<{ text?: string }> }).richText?.map((item) => item.text || '').join('') || '');
              else text = String(value);
            } else {
              text = String(value);
            }

            maxLen = Math.max(maxLen, text.length);
          });

          column.width = Math.max(minWidth, Math.min(maxLen + 2, maxWidth));
        });
      };

      const styleJoinStatusCell = (cell: any, joined: boolean) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: joined ? 'FFE8F7ED' : 'FFFDE8E8' },
        };
        cell.font = {
          bold: true,
          color: { argb: joined ? 'FF166534' : 'FFB91C1C' },
        };
      };

      const lectureTitle = (lec.title || 'Lecture').trim();
      const date = new Date().toISOString().split('T')[0];
      const safeLecture = lectureTitle.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'lecture';

      const summarySheet = workbook.addWorksheet('Summary');
      applyHeaderStyle(summarySheet.addRow(['Metric', 'Value']));
      [
        ['Lecture', lectureTitle],
        ['Total Joined', data.totalCount ?? 0],
        ['Registered Students Joined', data.registeredCount ?? 0],
        ['Enrolled Students', enrolledStudentRows.length],
        ['Not Joined Students', notJoinedCount],
        ['Student Join Rate', `${joinedRatePct}%`],
        ['Public Guests', data.guestCount ?? 0],
      ].forEach((entry) => summarySheet.addRow(entry));

      summarySheet.addRow([]);
      const sectionTitleRow = summarySheet.addRow(['Student Attendance Details']);
      summarySheet.mergeCells(sectionTitleRow.number, 1, sectionTitleRow.number, 6);
      const sectionCell = summarySheet.getCell(sectionTitleRow.number, 1);
      sectionCell.font = { bold: true, color: { argb: 'FF1E293B' } };
      sectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      sectionCell.alignment = { horizontal: 'left', vertical: 'middle' };
      sectionCell.border = XLSX_BORDER_STYLE;

      const summaryDetailsHeader = summarySheet.addRow(['Name', 'Student ID', 'Email', 'Phone', 'Status', 'Joined At']);
      applyHeaderStyle(summaryDetailsHeader);
      if (enrolledStudentRows.length > 0) {
        enrolledStudentRows.forEach((student) => {
          const row = summarySheet.addRow([
            student.fullName || '-',
            student.instituteId || '-',
            student.email || '-',
            student.phone || '-',
            student.joined ? 'Joined' : 'Not joined',
            student.joinedAt ? new Date(student.joinedAt).toLocaleString() : '-',
          ]);
          row.eachCell((cell: any) => {
            cell.border = XLSX_BORDER_STYLE;
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          });
          styleJoinStatusCell(row.getCell(5), student.joined);
          row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        });
      } else {
        const row = summarySheet.addRow(['No enrolled students found for this class.', '-', '-', '-', '-', '-']);
        row.eachCell((cell: any) => {
          cell.border = XLSX_BORDER_STYLE;
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        });
      }

      autoFitColumns(summarySheet, 12, 40);
      summarySheet.getColumn(1).width = Math.max(summarySheet.getColumn(1).width || 26, 26);
      summarySheet.views = [{ state: 'frozen', ySplit: 1 }];

      const statusSheet = workbook.addWorksheet('Student Status');
      applyHeaderStyle(statusSheet.addRow(['Name', 'Student ID', 'Email', 'Phone', 'Attendance', 'Joined At']));
      if (enrolledStudentRows.length > 0) {
        enrolledStudentRows.forEach((student) => {
          const row = statusSheet.addRow([
            student.fullName || '-',
            student.instituteId || '-',
            student.email || '-',
            student.phone || '-',
            student.joined ? 'Joined' : 'Not joined',
            student.joinedAt ? new Date(student.joinedAt).toLocaleString() : '-',
          ]);
          row.eachCell((cell: any) => {
            cell.border = XLSX_BORDER_STYLE;
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          });
          styleJoinStatusCell(row.getCell(5), student.joined);
          row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        });
      } else {
        statusSheet.addRow(['No enrolled students found for this class.', '-', '-', '-', '-', '-']);
      }
      applyRowBorderRange(statusSheet, 2, statusSheet.rowCount);
      autoFitColumns(statusSheet, 10, 42);
      statusSheet.views = [{ state: 'frozen', ySplit: 1 }];

      const joinedSheet = workbook.addWorksheet('Joined Students');
      applyHeaderStyle(joinedSheet.addRow(['Name', 'Student ID', 'Email', 'Phone', 'Status', 'Joined At']));
      if (registeredJoins.length > 0) {
        registeredJoins.forEach((join: any) => {
          const row = joinedSheet.addRow([
            join?.user?.profile?.fullName || join?.user?.email || '-',
            join?.user?.profile?.instituteId || '-',
            join?.user?.email || '-',
            join?.user?.profile?.phone || '-',
            'Joined',
            join?.joinedAt ? new Date(join.joinedAt).toLocaleString() : '-',
          ]);
          row.eachCell((cell: any) => {
            cell.border = XLSX_BORDER_STYLE;
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          });
          styleJoinStatusCell(row.getCell(5), true);
          row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        });
      } else {
        joinedSheet.addRow(['No registered students joined.', '-', '-', '-', '-', '-']);
      }
      applyRowBorderRange(joinedSheet, 2, joinedSheet.rowCount);
      autoFitColumns(joinedSheet, 10, 42);
      joinedSheet.views = [{ state: 'frozen', ySplit: 1 }];

      const notJoinedSheet = workbook.addWorksheet('Not Joined');
      applyHeaderStyle(notJoinedSheet.addRow(['Name', 'Student ID', 'Email', 'Phone', 'Status']));
      const notJoinedRows = enrolledStudentRows.filter((student) => !student.joined);
      if (notJoinedRows.length > 0) {
        notJoinedRows.forEach((student) => {
          const row = notJoinedSheet.addRow([
            student.fullName || '-',
            student.instituteId || '-',
            student.email || '-',
            student.phone || '-',
            'Not joined',
          ]);
          row.eachCell((cell: any) => {
            cell.border = XLSX_BORDER_STYLE;
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          });
          styleJoinStatusCell(row.getCell(5), false);
          row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        });
      } else {
        notJoinedSheet.addRow(['All enrolled students joined this lecture.', '-', '-', '-', '-']);
      }
      applyRowBorderRange(notJoinedSheet, 2, notJoinedSheet.rowCount);
      autoFitColumns(notJoinedSheet, 10, 42);
      notJoinedSheet.views = [{ state: 'frozen', ySplit: 1 }];

      const guestSheet = workbook.addWorksheet('Guests');
      applyHeaderStyle(guestSheet.addRow(['Name', 'Phone', 'Email', 'Note', 'Joined At']));
      if (guestJoins.length > 0) {
        guestJoins.forEach((guest: any) => {
          guestSheet.addRow([
            guest?.fullName || '-',
            guest?.phone || '-',
            guest?.email || '-',
            guest?.note || '-',
            guest?.joinedAt ? new Date(guest.joinedAt).toLocaleString() : '-',
          ]);
        });
      } else {
        guestSheet.addRow(['No public guests joined.', '-', '-', '-', '-']);
      }
      applyRowBorderRange(guestSheet, 2, guestSheet.rowCount);
      autoFitColumns(guestSheet, 10, 42);
      guestSheet.views = [{ state: 'frozen', ySplit: 1 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${safeLecture}_join_stats_${date}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

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
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={loading || !!error || !data || exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className={`w-3.5 h-3.5 ${exporting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                {exporting
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v4m0 8v4m8-8h-4M8 12H4m14.364 5.657l-2.828-2.828M8.464 8.464 5.636 5.636m12.728 0-2.828 2.828M8.464 15.536l-2.828 2.828" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />}
              </svg>
              {exporting ? 'Exporting...' : 'Export'}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <p className="text-2xl font-bold text-slate-800">{data.totalCount}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Total Joined</p>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-center">
                  <p className="text-2xl font-bold text-blue-700">{joinedRegisteredCount}</p>
                  <p className="text-xs text-blue-600 font-medium mt-0.5">Students Joined</p>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
                  <p className="text-2xl font-bold text-rose-700">{notJoinedCount}</p>
                  <p className="text-xs text-rose-600 font-medium mt-0.5">Not Joined</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{data.guestCount}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">Public Guests</p>
                </div>
              </div>

              <div className="px-4 py-3 rounded-xl border border-blue-100 bg-blue-50/60 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-blue-700">Student Join Rate</p>
                <p className="text-sm font-bold text-blue-800">{joinedRatePct}% ({joinedRegisteredCount}/{enrolledStudentRows.length || 0})</p>
              </div>

              {/* Student attendance table */}
              {enrolledStudentRows.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                    Student Attendance ({enrolledStudentRows.length})
                  </h3>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Name</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">ID</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Phone</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Status</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Joined At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {enrolledStudentRows.map((student) => (
                          <tr key={student.userId || `${student.instituteId}-${student.fullName}`} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{student.fullName || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{student.instituteId || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-500">{student.phone || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border ${
                                student.joined
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-100 text-rose-700 border-rose-200'
                              }`}>
                                {student.joined ? 'Joined' : 'Not joined'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-400 text-xs">
                              {student.joinedAt ? new Date(student.joinedAt).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Registered students table */}
              {registeredJoins.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Joined Students ({registeredJoins.length})
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
                        {registeredJoins.map((j: any) => (
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
              {guestJoins.length > 0 && (
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
                        {guestJoins.map((g: any) => (
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

interface ClassMonthLiveLessonsPageProps {
  embedded?: boolean;
  hideBackLink?: boolean;
}

export default function ClassMonthLiveLessonsPage({ embedded = false, hideBackLink = false }: ClassMonthLiveLessonsPageProps = {}) {
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
      {!embedded && !hideBackLink && (
        <Link to={getInstitutePath(instituteId, `/classes/${classId}/months/${monthId}`)} className="mt-4 inline-flex items-center gap-1.5 text-sm text-[hsl(var(--primary))] font-semibold hover:opacity-80">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to recordings
        </Link>
      )}
    </div>
  );

  const ongoingLectures  = lectures.filter(l => lectureTiming(l) === 'ongoing');
  const upcomingLectures = lectures.filter(l => lectureTiming(l) === 'upcoming');
  const endedLectures    = lectures.filter(l => lectureTiming(l) === 'ended');

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Back link */}
      {!embedded && !hideBackLink && (
        <Link
          to={getInstitutePath(instituteId, `/classes/${classId}/months/${monthId}`)}
          className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to recordings
        </Link>
      )}

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
                {ongoingLectures.map(lec => <LectureLessonCard key={lec.id} lec={lec} isAdmin={isAdmin} onEdit={setEditingLec} onDelete={setDeletingLec} onStats={setStatsLec} />)}
              </div>
            </div>
          )}

          {upcomingLectures.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">Upcoming</h2>
              <div className="grid gap-4">
                {upcomingLectures.map(lec => <LectureLessonCard key={lec.id} lec={lec} isAdmin={isAdmin} onEdit={setEditingLec} onDelete={setDeletingLec} onStats={setStatsLec} />)}
              </div>
            </div>
          )}

          {endedLectures.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">Past</h2>
              <div className="grid gap-4">
                {endedLectures.map(lec => <LectureLessonCard key={lec.id} lec={lec} isAdmin={isAdmin} onEdit={setEditingLec} onDelete={setDeletingLec} onStats={setStatsLec} />)}
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
          classId={classId}
          onClose={() => setStatsLec(null)}
        />
      )}
    </div>
  );
}
