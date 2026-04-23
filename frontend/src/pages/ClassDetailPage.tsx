import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getInstitutePath } from '../lib/instituteRoutes';

/* ─── Helpers ────────────────────────────────────────── */

function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateFull(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function statusRank(status: string): number {
  const ranks: Record<string, number> = { ANYONE: 0, STUDENTS_ONLY: 1, ENROLLED_ONLY: 1, PAID_ONLY: 2, PRIVATE: 3, INACTIVE: 4 };
  return ranks[status] ?? 4;
}

const VIDEO_TYPE_CFG: Record<string, { label: string; color: string; icon: string }> = {
  ZOOM:    { label: 'Zoom',    color: 'bg-blue-100 text-blue-700 border-blue-200',     icon: '📹' },
  YOUTUBE: { label: 'YouTube', color: 'bg-red-100 text-red-700 border-red-200',         icon: '▶️' },
  DRIVE:   { label: 'Drive',   color: 'bg-green-100 text-green-700 border-green-200',   icon: '📂' },
  OTHER:   { label: 'Video',   color: 'bg-slate-100 text-slate-700 border-slate-200',   icon: '🎬' },
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const VISIBILITY_OPTIONS = ['ANYONE', 'STUDENTS_ONLY', 'ENROLLED_ONLY', 'PAID_ONLY', 'PRIVATE', 'INACTIVE'];

const monthGradients = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-purple-500 to-violet-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
  'from-fuchsia-500 to-pink-600',
  'from-lime-500 to-green-600',
];

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

/* ═══════════════════════════════════════════════════════ */
/*                MAIN CLASS DETAIL PAGE                  */
/* ═══════════════════════════════════════════════════════ */

export default function ClassDetailPage() {
  const { id, instituteId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [classData, setClassData] = useState<any>(null);
  const [months, setMonths] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Month form (admin only)
  const [showMonthForm, setShowMonthForm] = useState(false);
  const [monthForm, setMonthForm] = useState({ name: '', year: new Date().getFullYear().toString(), month: (new Date().getMonth() + 1).toString(), status: 'ANYONE' });
  const [monthSaving, setMonthSaving] = useState(false);
  const [monthError, setMonthError] = useState('');

  // Enrollment access gate for ENROLLED_ONLY classes
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);

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

  // Check enrollment when class is ENROLLED_ONLY and user is logged in
  useEffect(() => {
    if (!classData || !id) return;
    if (classData.status !== 'ENROLLED_ONLY') { setIsEnrolled(null); return; }
    if (user?.role === 'ADMIN') { setIsEnrolled(true); return; }
    if (!token) { setIsEnrolled(false); return; }
    api.get(`/classes/${id}/check-access`)
      .then(r => setIsEnrolled(r.data.enrolled))
      .catch(() => setIsEnrolled(false));
  }, [classData, id, user, token]);

  const reloadMonths = async () => {
    try {
      const res = await api.get(`/classes/${id}/months`);
      const all = res.data || [];
      setMonths(user?.role === 'ADMIN' ? all : all.filter((m: any) => m.status !== 'INACTIVE' && m.status !== 'PRIVATE'));
    } catch {}
  };

  const saveMonth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMonthError('');
    setMonthSaving(true);
    try {
      await api.post(`/classes/${id}/months`, {
        name: monthForm.name,
        year: Number(monthForm.year),
        month: Number(monthForm.month),
        status: monthForm.status,
      });
      setShowMonthForm(false);
      await reloadMonths();
    } catch (err: any) {
      setMonthError(err.response?.data?.message || 'Failed to save month');
    } finally {
      setMonthSaving(false);
    }
  };

  const toggleMonth = (monthId: string) => {
    navigate(getInstitutePath(instituteId || classData?.instituteId || classData?.institute?.id || null, `/classes/${id}/months/${monthId}`));
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

  // ENROLLED_ONLY gate: check in progress
  if (classStatus === 'ENROLLED_ONLY' && isEnrolled === null && token) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  // ENROLLED_ONLY gate: not logged in
  if (classStatus === 'ENROLLED_ONLY' && !token) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center bg-white rounded-2xl border border-slate-100 p-12 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Enrolled Students Only</h2>
        <p className="text-slate-500 text-sm mb-6">This class is restricted to enrolled students. Please sign in to access it.</p>
        <button onClick={() => navigate('/login')} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:opacity-90 transition">
          Sign In
        </button>
        <Link to="/classes" className="mt-4 block text-sm text-slate-400 hover:text-slate-600 transition">Back to classes</Link>
      </div>
    );
  }

  // ENROLLED_ONLY gate: logged in but not enrolled
  if (classStatus === 'ENROLLED_ONLY' && isEnrolled === false) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center bg-white rounded-2xl border border-slate-100 p-12 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Not Enrolled in This Class</h2>
        <p className="text-slate-500 text-sm mb-2">This class is only accessible to enrolled students.</p>
        <p className="text-slate-400 text-xs mb-6">Please contact your instructor to get enrolled.</p>
        <Link to="/classes" className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-semibold hover:text-blue-700">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to classes
        </Link>
      </div>
    );
  }

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

      {/* Month cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-base">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Select a Month
          </h2>
          <div className="flex items-center gap-2">
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => { setMonthForm({ name: '', year: new Date().getFullYear().toString(), month: (new Date().getMonth() + 1).toString(), status: 'ANYONE' }); setMonthError(''); setShowMonthForm(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-md shadow-blue-500/25"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add Month
              </button>
            )}
            <span className="text-xs font-medium text-slate-400">{months.length} month{months.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Add Month Modal (admin only) */}
        {showMonthForm && createPortal(
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowMonthForm(false)}>
            <div className="min-h-full flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 rounded-t-2xl">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">New Month</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Add a new month to organize recordings</p>
                  </div>
                  <button onClick={() => setShowMonthForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <form onSubmit={saveMonth} className="overflow-y-auto max-h-[80vh]">
                  <div className="p-6 space-y-5">
                    {monthError && (
                      <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {monthError}
                      </div>
                    )}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Month Details</p>
                      <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1.5">Month Name</label>
                        <input type="text" value={monthForm.name} onChange={e => setMonthForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. January 2025" required
                          className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Year</label>
                          <input type="number" value={monthForm.year} onChange={e => setMonthForm(p => ({ ...p, year: e.target.value }))} required
                            className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Month</label>
                          <select value={monthForm.month} onChange={e => setMonthForm(p => ({ ...p, month: e.target.value }))}
                            className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Visibility</label>
                          <select value={monthForm.status} onChange={e => setMonthForm(p => ({ ...p, status: e.target.value }))}
                            className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                            {VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2 pb-2">
                      <button type="button" onClick={() => setShowMonthForm(false)} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                      <button type="submit" disabled={monthSaving} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                        {monthSaving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                        {monthSaving ? 'Saving...' : 'Create Month'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        , document.body)}

        {months.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-slate-500 text-sm">No months available yet</p>
          </div>
        ) : (
          <div className="grid [grid-template-columns:repeat(auto-fit,minmax(280px,340px))] justify-center sm:justify-start gap-5">
            {months.map((m, idx) => {
              const recs: any[] = m.recordings || [];
              const recCount = m._count?.recordings ?? recs.length;
              const liveRecs = recs.filter((r: any) => r.isLive || r.liveToken || r.liveUrl);
              const hasLive = liveRecs.some((r: any) => r.isLive && !r.liveEndedAt);
              const grad = monthGradients[idx % monthGradients.length];

              return (
                <div key={m.id}
                  className="relative w-full max-w-[420px] flex flex-col rounded-xl bg-white shadow-md border border-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg cursor-pointer"
                  onClick={() => toggleMonth(m.id)}
                >
                  {/* Gradient header */}
                  <div className={`relative mx-3 mt-3 h-40 overflow-hidden rounded-xl bg-gradient-to-r ${grad} flex items-center justify-center`}>
                    <span className="text-white/20 text-7xl font-black select-none">{(m.name?.[0] || 'M').toUpperCase()}</span>
                    {/* Live badge */}
                    {hasLive && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500 border border-red-400">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                        </span>
                        <span className="text-[9px] font-bold text-white uppercase">Live</span>
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4 flex-1">
                    <h5 className="text-lg font-semibold text-slate-900 truncate mb-1">{m.name}</h5>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        {recCount} recording{recCount !== 1 ? 's' : ''}
                      </span>
                      {liveRecs.length > 0 && (
                        <span className="flex items-center gap-1 text-red-500 font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>
                          {liveRecs.length} lecture{liveRecs.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 pt-0 mt-auto flex flex-col gap-2">
                    <PaymentBadge month={m} classStatus={classStatus} payments={payments} user={user} />
                    <button
                      onClick={e => { e.stopPropagation(); toggleMonth(m.id); }}
                      className="w-full select-none rounded-lg bg-blue-500 py-2.5 text-center text-[11px] font-bold uppercase text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:shadow-blue-500/35 hover:bg-blue-600"
                    >
                      Select Month
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
