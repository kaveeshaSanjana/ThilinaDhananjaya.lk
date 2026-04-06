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

const VIDEO_TYPE_CFG: Record<string, { label: string; color: string; icon: string }> = {
  ZOOM:    { label: 'Zoom',    color: 'bg-blue-100 text-blue-700 border-blue-200',     icon: '📹' },
  YOUTUBE: { label: 'YouTube', color: 'bg-red-100 text-red-700 border-red-200',         icon: '▶️' },
  DRIVE:   { label: 'Drive',   color: 'bg-green-100 text-green-700 border-green-200',   icon: '📂' },
  OTHER:   { label: 'Video',   color: 'bg-slate-100 text-slate-700 border-slate-200',   icon: '🎬' },
};

/* ─── Live Lecture Card ──────────────────────────────── */

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
          <div className={`relative w-24 h-16 sm:w-28 rounded-xl overflow-hidden shrink-0 ${isLive ? 'ring-2 ring-red-300 ring-offset-2' : ''}`}>
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
            {rec.topic && <p className={`text-xs font-medium mt-0.5 truncate ${isLive ? 'text-red-500' : 'text-blue-500'}`}>{rec.topic}</p>}
            {rec.description && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{rec.description}</p>}
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
              {hasEnded && rec.liveEndedAt && <><span>•</span><span>Ended {fmtTime(rec.liveEndedAt)}</span></>}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {isLive && (
            <button onClick={(e) => { e.stopPropagation(); onJoin(rec); }}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all shadow-md shadow-red-200 flex items-center justify-center gap-2">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span></span>
              Join Live Class
            </button>
          )}
          {rec.videoUrl && (
            <button onClick={(e) => { e.stopPropagation(); onWatch(rec); }}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                isLive ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200' : 'bg-slate-700 text-white hover:bg-slate-800'
              }`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              Watch Recording
            </button>
          )}
          {!isLive && !rec.videoUrl && !hasEnded && (
            <button onClick={(e) => { e.stopPropagation(); onJoin(rec); }}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2">
              Join Lecture
            </button>
          )}
          {rec.materials && (
            <a href={rec.materials} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition flex items-center gap-1.5">
              Materials
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Recording Card ─────────────────────────────────── */

function RecordingCard({ rec, idx, onClick }: { rec: any; idx: number; onClick: () => void }) {
  const vt = VIDEO_TYPE_CFG[rec.videoType] || VIDEO_TYPE_CFG.OTHER;
  return (
    <div className="bg-white rounded-2xl border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100/60 transition-all cursor-pointer group flex flex-col overflow-hidden"
      onClick={onClick}>
      <div className="relative w-full aspect-video bg-slate-100 overflow-hidden">
        {rec.thumbnail ? (
          <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/25">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-blue-600 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        {rec.duration && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/70 text-white">
            {typeof rec.duration === 'number' ? fmtDuration(rec.duration) : rec.duration}
          </span>
        )}
        <span className={`absolute top-2 right-2 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${vt.color}`}>{vt.label}</span>
        <span className="absolute top-2 left-2 w-6 h-6 rounded-lg bg-black/50 text-white text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
      </div>
      <div className="flex flex-col flex-1 p-3.5">
        <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition leading-snug line-clamp-2">{rec.title}</p>
        {rec.topic && <p className="text-xs text-blue-500 font-medium mt-1 truncate">{rec.topic}</p>}
        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400">
          {rec.createdAt && (
            <>
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span>{new Date(rec.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long' })} · {fmtDateShort(rec.createdAt)}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          <button onClick={e => { e.stopPropagation(); onClick(); }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            Watch
          </button>
          {rec.materials && (
            <a href={rec.materials} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /></svg>
              Files
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*              CLASS MONTH RECORDINGS PAGE               */
/* ═══════════════════════════════════════════════════════ */

export default function ClassMonthRecordingsPage() {
  const { classId, monthId } = useParams<{ classId: string; monthId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [classData, setClassData] = useState<any>(null);
  const [monthData, setMonthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, monthsRes] = await Promise.all([
          api.get(`/classes/${classId}`),
          api.get(`/classes/${classId}/months`),
        ]);
        setClassData(classRes.data);
        const month = (monthsRes.data || []).find((m: any) => m.id === monthId);
        if (!month) throw new Error('Month not found');
        setMonthData(month);
        if (token) { /* token used to attach auth header via interceptor */ }
      } catch (e: any) {
        setError(e.response?.data?.message || e.message || 'Failed to load');
      } finally { setLoading(false); }
    };
    fetchData();
  }, [classId, monthId, token]);

  const handleJoinLive = (rec: any) => {
    if (rec.liveToken) navigate(`/live/${rec.liveToken}`);
    else if (rec.liveUrl) window.open(rec.liveUrl, '_blank', 'noopener,noreferrer');
    else navigate(`/recording/${rec.id}`);
  };

  const handleWatch = (rec: any) => navigate(`/recording/${rec.id}`);

  const recordings: any[] = monthData?.recordings || [];
  const liveRecs = recordings.filter((r: any) => r.isLive || r.liveToken || r.liveUrl);
  const regularRecs = recordings.filter((r: any) => !(r.isLive || r.liveToken || r.liveUrl));

  const liveLectures = useMemo(() =>
    liveRecs.sort((a: any, b: any) => {
      const aLive = a.isLive && !a.liveEndedAt;
      const bLive = b.isLive && !b.liveEndedAt;
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return 0;
    }), [liveRecs]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-12 shadow-sm">
      <p className="text-[hsl(var(--muted-foreground))] text-sm font-medium">{error}</p>
      <Link to={`/classes/${classId}/class-recordings`} className="mt-4 inline-flex items-center gap-1.5 text-sm text-[hsl(var(--primary))] font-semibold hover:opacity-80">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to months
      </Link>
    </div>
  );

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Back link */}
      <Link to={`/classes/${classId}/class-recordings`}
        className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to months
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{classData?.name}</p>
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">{monthData?.name}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
            {liveRecs.length > 0 ? ` · ${liveRecs.length} live lecture${liveRecs.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
      </div>

      {/* Live Lectures */}
      {liveLectures.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Live Lectures</h3>
            <span className="text-[11px] text-[hsl(var(--muted-foreground))] font-medium">{liveLectures.length} lecture{liveLectures.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {liveLectures.map((rec: any) => (
              <LiveLectureCard key={rec.id} rec={rec} onJoin={handleJoinLive} onWatch={handleWatch} />
            ))}
          </div>
        </div>
      )}

      {/* Regular Recordings */}
      {regularRecs.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
            </svg>
            Recordings
            <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{regularRecs.length}</span>
          </h3>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {regularRecs.map((rec: any, idx: number) => (
              <RecordingCard key={rec.id} rec={rec} idx={idx} onClick={() => handleWatch(rec)} />
            ))}
          </div>
        </div>
      ) : recordings.length === 0 && (
        <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-14 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-[hsl(var(--muted-foreground)/0.4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">No recordings in this month yet</p>
        </div>
      )}
    </div>
  );
}
