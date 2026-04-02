import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

/* ─── Helpers ────────────────────────────────────────── */

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtDateFull(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function statusRank(status: string): number {
  const ranks: Record<string, number> = { ANYONE: 0, STUDENTS_ONLY: 1, PAID_ONLY: 2, PRIVATE: 3, INACTIVE: 4 };
  return ranks[status] ?? 4;
}

const VIDEO_TYPE_CFG: Record<string, { label: string; color: string; icon: string }> = {
  ZOOM:    { label: 'Zoom',    color: 'bg-blue-100 text-blue-700 border-blue-200',     icon: '📹' },
  YOUTUBE: { label: 'YouTube', color: 'bg-red-100 text-red-700 border-red-200',         icon: '▶️' },
  DRIVE:   { label: 'Drive',   color: 'bg-green-100 text-green-700 border-green-200',   icon: '📂' },
  OTHER:   { label: 'Video',   color: 'bg-slate-100 text-slate-700 border-slate-200',   icon: '🎬' },
};

/* ─── Sub-components ─────────────────────────────────── */

function PaymentBadge({ month, classStatus, payments, user }: {
  month: any; classStatus: string; payments: any[]; user: any;
}) {
  if (user?.role === 'ADMIN') {
    return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">Admin</span>;
  }
  const highestReq = Math.max(statusRank(classStatus), statusRank(month.status));
  if (highestReq === 0) return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Free</span>;
  if (highestReq === 1) return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">Enrolled</span>;
  const hasPaid = payments.some((p: any) => p.monthId === month.id && p.type === 'MONTHLY' && p.status === 'VERIFIED');
  if (hasPaid) return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Paid ✓</span>;
  const hasPending = payments.some((p: any) => p.monthId === month.id && p.type === 'MONTHLY' && p.status === 'PENDING');
  if (hasPending) return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Pending</span>;
  return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-100 text-orange-700 border border-orange-200">Pay Now</span>;
}

/** Live lecture card — prominent red/emerald card */
function LiveLectureCard({ rec, onJoin, onWatch }: { rec: any; onJoin: (rec: any) => void; onWatch: (rec: any) => void }) {
  const isLive = rec.isLive && !rec.liveEndedAt;
  const hasEnded = !!rec.liveEndedAt;
  const hasTime = !!rec.liveStartedAt;
  const vt = VIDEO_TYPE_CFG[rec.videoType] || VIDEO_TYPE_CFG.OTHER;

  return (
    <div className={`relative rounded-2xl border-2 overflow-hidden transition-all ${
      isLive
        ? 'border-red-300 bg-gradient-to-br from-red-50 via-white to-orange-50 shadow-lg shadow-red-100/50'
        : hasEnded
          ? 'border-slate-200 bg-gradient-to-br from-slate-50 to-white'
          : 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50'
    }`}>
      {/* Live pulse indicator */}
      {isLive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Live Now</span>
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {/* Thumbnail or live icon */}
          <div className={`relative w-24 h-16 sm:w-28 sm:h-18 rounded-xl overflow-hidden shrink-0 ${
            isLive ? 'ring-2 ring-red-300 ring-offset-2' : ''
          }`}>
            {rec.thumbnail ? (
              <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${
                isLive ? 'bg-gradient-to-br from-red-400 to-orange-500' : hasEnded ? 'bg-gradient-to-br from-slate-300 to-slate-400' : 'bg-gradient-to-br from-emerald-400 to-blue-500'
              }`}>
                <span className="text-2xl">{isLive ? '🔴' : hasEnded ? '📼' : '📅'}</span>
              </div>
            )}
            {isLive && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${vt.color}`}>
                {vt.icon} {vt.label}
              </span>
              {hasEnded && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Ended</span>
              )}
            </div>

            <h3 className={`text-sm sm:text-base font-bold truncate ${isLive ? 'text-red-800' : 'text-slate-800'}`}>{rec.title}</h3>

            {rec.topic && (
              <p className={`text-xs font-medium mt-0.5 truncate ${isLive ? 'text-red-500' : 'text-blue-500'}`}>{rec.topic}</p>
            )}

            {rec.description && (
              <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{rec.description}</p>
            )}

            {/* Time info */}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
              {hasTime ? (
                <>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Started {fmtTime(rec.liveStartedAt)}
                  </span>
                  <span>•</span>
                  <span>{fmtDateFull(rec.liveStartedAt)}</span>
                </>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Always Available
                </span>
              )}
              {hasEnded && rec.liveEndedAt && (
                <>
                  <span>•</span>
                  <span>Ended {fmtTime(rec.liveEndedAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {isLive && (
            <button
              onClick={(e) => { e.stopPropagation(); onJoin(rec); }}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all shadow-md shadow-red-200 flex items-center justify-center gap-2"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              Join Live Class
            </button>
          )}
          {rec.videoUrl && (
            <button
              onClick={(e) => { e.stopPropagation(); onWatch(rec); }}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                isLive
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  : 'bg-slate-700 text-white hover:bg-slate-800'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              Watch Recording
            </button>
          )}
          {!isLive && !rec.videoUrl && !hasEnded && (
            <button
              onClick={(e) => { e.stopPropagation(); onJoin(rec); }}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Join Lecture
            </button>
          )}
          {rec.materials && (
            <a href={rec.materials} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              Materials
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** Regular recording card — richer than before with description */
function RecordingCard({ rec, idx, onClick }: { rec: any; idx: number; onClick: () => void }) {
  const vt = VIDEO_TYPE_CFG[rec.videoType] || VIDEO_TYPE_CFG.OTHER;

  return (
    <div onClick={onClick}
      className="flex gap-3 p-3 sm:p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Order */}
      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition self-center">
        <span className="text-xs font-bold text-slate-500 group-hover:text-blue-600 transition">{idx + 1}</span>
      </div>

      {/* Thumbnail */}
      <div className="relative w-24 h-16 sm:w-28 sm:h-18 rounded-xl overflow-hidden shrink-0 bg-slate-200 self-center">
        {rec.thumbnail ? (
          <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
            </svg>
          </div>
        )}
        {/* Duration badge on thumbnail */}
        {rec.duration && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/70 text-white">
            {typeof rec.duration === 'number' ? fmtDuration(rec.duration) : rec.duration}
          </span>
        )}
        {/* Hover play */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/20">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${vt.color}`}>
            {vt.icon} {vt.label}
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition truncate">{rec.title}</p>
        {rec.topic && <p className="text-xs text-blue-500 font-medium mt-0.5 truncate">{rec.topic}</p>}
        {rec.description && (
          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{rec.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
          {rec.createdAt && <span>{fmtDateShort(rec.createdAt)}</span>}
          {rec.materials && (
            <>
              <span>•</span>
              <span className="flex items-center gap-0.5 text-blue-500">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /></svg>
                Materials
              </span>
            </>
          )}
        </div>
      </div>

      {/* Arrow */}
      <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition shrink-0 self-center" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*                MAIN CLASS DETAIL PAGE                  */
/* ═══════════════════════════════════════════════════════ */

export default function ClassDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [classData, setClassData] = useState<any>(null);
  const [months, setMonths] = useState<any[]>([]);
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, monthsRes] = await Promise.all([
          api.get(`/classes/${id}`),
          api.get(`/classes/${id}/months`),
        ]);
        setClassData(classRes.data);
        const visibleMonths = (monthsRes.data || []).filter(
          (m: any) => m.status !== 'INACTIVE' && m.status !== 'PRIVATE',
        );
        setMonths(visibleMonths);
        if (token) {
          try { const payRes = await api.get('/payments/my'); setPayments(payRes.data || []); } catch { /* guest */ }
        }
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load class');
      } finally { setLoading(false); }
    };
    fetchData();
  }, [id, token]);

  const toggleMonth = (monthId: string) => {
    setExpandedMonthId(prev => prev === monthId ? null : monthId);
  };

  /** Handle join for live lectures */
  const handleJoinLive = (rec: any) => {
    if (rec.liveToken) {
      navigate(`/live/${rec.liveToken}`);
    } else if (rec.liveUrl) {
      window.open(rec.liveUrl, '_blank', 'noopener,noreferrer');
    } else {
      navigate(`/recording/${rec.id}`);
    }
  };

  /** Handle watch recording for a lecture that has videoUrl */
  const handleWatchRecording = (rec: any) => {
    navigate(`/recording/${rec.id}`);
  };

  /** Collect all live lectures across all months, sorted: live first, then upcoming, then ended */
  const liveLectures = useMemo(() => {
    const all: any[] = [];
    for (const m of months) {
      for (const r of (m.recordings || [])) {
        if (r.isLive || r.liveToken || r.liveUrl) all.push(r);
      }
    }
    return all.sort((a, b) => {
      const aLive = a.isLive && !a.liveEndedAt;
      const bLive = b.isLive && !b.liveEndedAt;
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      const aEnded = !!a.liveEndedAt;
      const bEnded = !!b.liveEndedAt;
      if (!aEnded && bEnded) return -1;
      if (aEnded && !bEnded) return 1;
      return 0;
    });
  }, [months]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center bg-white rounded-2xl border border-slate-100 p-12 shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <p className="text-slate-600 text-sm font-medium">{error}</p>
      <Link to="/classes" className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 font-semibold hover:text-blue-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to classes
      </Link>
    </div>
  );

  const classStatus = classData?.status || 'ANYONE';

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Back */}
      <Link to="/classes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to classes
      </Link>

      {/* Live Lectures banner — across all months, shown at top when any exist */}
      {liveLectures.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <h3 className="text-sm font-bold text-slate-800">Live Lectures</h3>
            <span className="text-[11px] text-slate-400 font-medium">{liveLectures.length} lecture{liveLectures.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {liveLectures.map(rec => (
              <LiveLectureCard key={rec.id} rec={rec} onJoin={handleJoinLive} onWatch={handleWatchRecording} />
            ))}
          </div>
        </div>
      )}

      {/* Month list */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm min-h-[calc(100vh-220px)]">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Months
          </h2>
          <span className="text-xs font-medium text-slate-400">{months.length} month{months.length !== 1 ? 's' : ''}</span>
        </div>

        {months.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-slate-500 text-sm">No months available yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {months.map((m) => {
              const isExpanded = expandedMonthId === m.id;
              const recs: any[] = m.recordings || [];
              const recCount = m._count?.recordings ?? recs.length;

              // Separate live and regular recordings
              const liveRecs = recs.filter((r: any) => r.isLive || r.liveToken || r.liveUrl);
              const regularRecs = recs.filter((r: any) => !(r.isLive || r.liveToken || r.liveUrl));
              const hasLive = liveRecs.some((r: any) => r.isLive && !r.liveEndedAt);

              return (
                <div key={m.id}>
                  {/* Month row */}
                  <button
                    onClick={() => toggleMonth(m.id)}
                    className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 ${isExpanded ? 'bg-blue-50/50' : ''}`}
                  >
                    <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isExpanded ? 'bg-blue-100' : 'bg-slate-100'}`}>
                      <svg className={`w-5 h-5 ${isExpanded ? 'text-blue-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${isExpanded ? 'text-blue-700' : 'text-slate-800'}`}>{m.name}</p>
                        {/* Live indicator on month row */}
                        {hasLive && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 border border-red-200">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                            </span>
                            <span className="text-[9px] font-bold text-red-600 uppercase">Live</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{recCount} recording{recCount !== 1 ? 's' : ''}{liveRecs.length > 0 ? ` • ${liveRecs.length} lecture${liveRecs.length !== 1 ? 's' : ''}` : ''}</p>
                    </div>

                    <PaymentBadge month={m} classStatus={classStatus} payments={payments} user={user} />
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="bg-slate-50/50 border-t border-slate-100 px-4 sm:px-5 py-4">
                      {recs.length === 0 ? (
                        <div className="py-8 text-center">
                          <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <p className="text-slate-400 text-sm">No recordings in this month</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Live lecture cards first */}
                          {liveRecs.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                Live Lectures
                              </p>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {liveRecs.map((rec: any) => (
                                  <LiveLectureCard key={rec.id} rec={rec} onJoin={handleJoinLive} onWatch={handleWatchRecording} />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Regular recordings */}
                          {regularRecs.length > 0 && (
                            <div className="space-y-2">
                              {liveRecs.length > 0 && (
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mt-2">
                                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
                                  Recordings
                                </p>
                              )}
                              {regularRecs.map((rec: any, idx: number) => (
                                <RecordingCard key={rec.id} rec={rec} idx={idx} onClick={() => navigate(`/recording/${rec.id}`)} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
