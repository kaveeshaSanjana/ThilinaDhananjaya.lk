import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

/** Format seconds as h:mm:ss or m:ss */
function fmtDuration(sec: number): string {
  if (!sec || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format time range "6:30 AM – 7:00 AM" */
function fmtTimeRange(startIso: string, endIso?: string): string {
  const start = new Date(startIso);
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (!endIso) return `${startStr} – ongoing`;
  const end = new Date(endIso);
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${startStr} – ${endStr}`;
}

export default function WatchHistoryPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/attendance/watch-history/my')
      .then(r => setSessions(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group sessions by date
  const grouped = sessions.reduce((acc: Record<string, any[]>, s) => {
    const dateKey = new Date(s.startedAt).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(s);
    return acc;
  }, {} as Record<string, any[]>);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          Watch History
        </h1>
        <span className="text-xs text-slate-400 font-medium">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 font-medium">No watch history yet</p>
          <p className="text-xs text-slate-400 mt-1">Start watching recordings to see your history here</p>
          <Link to="/classes" className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 font-semibold hover:text-blue-700">
            Browse Classes
          </Link>
        </div>
      ) : (
        Object.entries(grouped).map(([dateKey, daySessions]) => (
          <div key={dateKey} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            {/* Date header */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                {dateKey}
              </h2>
            </div>

            {/* Sessions for this date */}
            <div className="divide-y divide-slate-100">
              {daySessions.map((s: any) => (
                <div key={s.id} className="p-4 sm:p-5 hover:bg-slate-50 transition">
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="w-20 h-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                      {s.recording?.thumbnail ? (
                        <img src={s.recording.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {s.recording?.title || 'Unknown Recording'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {s.recording?.month?.class?.name && (
                          <span>{s.recording.month.class.name} &bull; </span>
                        )}
                        {s.recording?.month?.name || ''}
                      </p>

                      {/* Session details */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                        {/* Time range watched */}
                        <span className="flex items-center gap-1 text-slate-600">
                          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {fmtTimeRange(s.startedAt, s.endedAt)}
                        </span>

                        {/* Video position range */}
                        <span className="flex items-center gap-1 text-slate-600">
                          <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                          </svg>
                          Video {fmtDuration(s.videoStartPos)} → {fmtDuration(s.videoEndPos)}
                        </span>

                        {/* Total watched */}
                        <span className="flex items-center gap-1 text-slate-600">
                          <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                          </svg>
                          {fmtDuration(s.totalWatchedSec)} watched
                        </span>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'WATCHING'
                          ? 'bg-green-50 text-green-600 border border-green-200'
                          : s.status === 'PAUSED'
                          ? 'bg-yellow-50 text-yellow-600 border border-yellow-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          s.status === 'WATCHING' ? 'bg-green-500' :
                          s.status === 'PAUSED' ? 'bg-yellow-500' : 'bg-slate-400'
                        }`} />
                        {s.status === 'WATCHING' ? 'Live' : s.status === 'PAUSED' ? 'Paused' : 'Ended'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
