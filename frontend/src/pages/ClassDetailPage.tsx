import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';

/** Extract YouTube video ID from various URL formats */
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Renders either a YouTube iframe or HTML5 video tag */
function EmbedVideo({ url, title }: { url: string; title?: string }) {
  const ytId = getYouTubeId(url);
  if (ytId) {
    return (
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${ytId}?rel=0`}
          title={title || 'Video'}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return <video src={url} controls className="w-full h-full" />;
}

/** Format seconds as h:mm:ss or m:ss */
function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ClassDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cls, setCls] = useState<any>(null);
  const [months, setMonths] = useState<any[]>([]);
  const [selMonthId, setSelMonthId] = useState('');
  const [recordings, setRecordings] = useState<any[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showIntro, setShowIntro] = useState(false);

  // Fetch class info + months
  useEffect(() => {
    Promise.all([
      api.get(`/classes/${id}`),
      api.get(`/classes/${id}/months`),
    ]).then(([clsRes, monthsRes]) => {
      setCls(clsRes.data);
      const visibleMonths = (monthsRes.data || []).filter(
        (m: any) => m.status !== 'INACTIVE' && m.status !== 'PRIVATE',
      );
      setMonths(visibleMonths);
      if (visibleMonths.length > 0) setSelMonthId(visibleMonths[0].id);
    }).catch(e => setError(e.response?.data?.message || 'Failed to load class')).finally(() => setLoading(false));
  }, [id]);

  // Fetch recordings when selected month changes
  useEffect(() => {
    if (!selMonthId) {
      setRecordings([]);
      return;
    }
    setRecsLoading(true);
    api.get(`/recordings/by-month/${selMonthId}`)
      .then(res => setRecordings(res.data || []))
      .catch(() => setRecordings([]))
      .finally(() => setRecsLoading(false));
  }, [selMonthId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-12 shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">{error}</p>
      <Link to="/classes" className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 font-semibold hover:text-blue-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to classes
      </Link>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Back */}
      <Link to="/classes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to classes
      </Link>

      {/* Header card with thumbnail */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
        {cls?.thumbnail && (
          <div className="relative h-48 sm:h-56">
            <img src={cls.thumbnail} alt={cls.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6">
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">{cls?.name}</h1>
              {cls?.subject && <p className="text-white/80 text-sm mt-0.5">{cls.subject}</p>}
            </div>
          </div>
        )}
        <div className="p-6">
          {!cls?.thumbnail && (
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
                <span className="text-white text-xl font-bold">{cls?.name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{cls?.name}</h1>
                {cls?.subject && <p className="text-slate-500 dark:text-slate-400 text-sm">{cls.subject}</p>}
              </div>
            </div>
          )}
          {cls?.description && <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{cls.description}</p>}

          <div className="flex flex-wrap items-center gap-2 mt-4">
            {cls?.monthlyFee != null && (
              <span className="inline-flex px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-100 dark:border-blue-800">
                Rs. {Number(cls.monthlyFee).toLocaleString()} / month
              </span>
            )}
            <span className="inline-flex px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs font-medium border border-slate-100 dark:border-slate-600">
              {months.length} month{months.length !== 1 ? 's' : ''}
            </span>
            {cls?.introVideoUrl && (
              <button onClick={() => setShowIntro(!showIntro)}
                className="inline-flex px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                {showIntro ? 'Hide Intro' : 'Watch Intro'}
              </button>
            )}
          </div>

          {/* Vision & Mission */}
          {(cls?.vision || cls?.mission) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              {cls.vision && (
                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Vision</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{cls.vision}</p>
                </div>
              )}
              {cls.mission && (
                <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                  <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1">Mission</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{cls.mission}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Intro Video */}
      {showIntro && cls?.introVideoUrl && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm animate-fade-in">
          <div className="bg-black rounded-t-2xl overflow-hidden">
            <EmbedVideo url={cls.introVideoUrl} title={`${cls.name} - Introduction`} />
          </div>
          <div className="p-4 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Class Introduction</p>
            <button onClick={() => setShowIntro(false)} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition">Close</button>
          </div>
        </div>
      )}

      {/* Month tabs → Recordings grid */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Months
          </h2>
        </div>

        {months.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">No months available yet</p>
          </div>
        ) : (
          <>
            {/* Month pills */}
            <div className="p-4 flex gap-2 flex-wrap border-b border-slate-100 dark:border-slate-700">
              {months.map(m => (
                <button key={m.id} onClick={() => setSelMonthId(m.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${selMonthId === m.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                  {m.name}
                </button>
              ))}
            </div>

            {/* Recordings for selected month */}
            {recsLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              </div>
            ) : recordings.length === 0 ? (
              <div className="p-14 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">No recordings in this month</p>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recordings.map((rec: any) => (
                    <div key={rec.id}
                      className="bg-slate-50 dark:bg-slate-700/50 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700 transition group cursor-pointer"
                      onClick={() => navigate(`/recording/${rec.id}`)}>
                      {/* Thumbnail */}
                      <div className="relative aspect-video bg-slate-200 dark:bg-slate-600">
                        {rec.thumbnail ? (
                          <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700">
                            <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          </div>
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition">
                          <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition scale-75 group-hover:scale-100 shadow-xl">
                            <svg className="w-5 h-5 text-blue-600 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                        {rec.duration && (
                          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
                            {typeof rec.duration === 'number' ? fmtDuration(rec.duration) : rec.duration}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 group-hover:text-blue-600 transition truncate">{rec.title}</p>
                        {rec.topic && <p className="text-xs text-blue-500 dark:text-blue-400 font-medium mt-0.5 truncate">{rec.topic}</p>}
                        {rec.createdAt && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            {new Date(rec.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
