import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';

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
  const [months, setMonths] = useState<any[]>([]);
  const [selMonthId, setSelMonthId] = useState('');
  const [recordings, setRecordings] = useState<any[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch months
  useEffect(() => {
    api.get(`/classes/${id}/months`).then((monthsRes) => {
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

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Back */}
      <Link to="/classes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to classes
      </Link>

      {/* Month tabs ? Recordings grid */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm min-h-[calc(100vh-220px)]">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Months
          </h2>
        </div>

        {months.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-slate-500 text-sm">No months available yet</p>
          </div>
        ) : (
          <>
            {/* Month pills */}
            <div className="p-4 flex gap-2 flex-wrap border-b border-slate-100">
              {months.map(m => (
                <button key={m.id} onClick={() => setSelMonthId(m.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${selMonthId === m.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
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
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-slate-500 text-sm">No recordings in this month</p>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-slate-500">
                    {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recordings.map((rec: any) => (
                    <div key={rec.id}
                      className="bg-slate-50 rounded-xl overflow-hidden border border-blue-300 hover:border-blue-400 transition group cursor-pointer"
                      onClick={() => navigate(`/recording/${rec.id}`)}>
                      {/* Thumbnail */}
                      <div className="relative aspect-video bg-slate-200">
                        {rec.thumbnail ? (
                          <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                            <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          </div>
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition">
                          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition scale-75 group-hover:scale-100 shadow-xl">
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
                        <p className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition truncate">{rec.title}</p>
                        {rec.topic && <p className="text-xs text-blue-500 font-medium mt-0.5 truncate">{rec.topic}</p>}
                        {rec.createdAt && (
                          <p className="text-[10px] text-slate-400 mt-1">
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
