import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function LiveJoinPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [lecture, setLecture] = useState<any>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);

  // Resolve the live token to get lecture info
  useEffect(() => {
    if (!token) return;
    api.get(`/recordings/live/${token}`)
      .then(r => setLecture(r.data))
      .catch(() => setError('This live lecture link is invalid or has expired.'));
  }, [token]);

  // If not authenticated, redirect to login with return URL
  useEffect(() => {
    if (authLoading) return;
    if (!user && lecture) {
      const returnUrl = `/live/${token}`;
      navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
    }
  }, [authLoading, user, lecture, token, navigate]);

  const handleJoin = async () => {
    if (!token || !user) return;
    setJoining(true);
    setError('');
    try {
      const res = await api.post(`/recordings/live/${token}/join`);
      const data = res.data.recording;
      setJoined(true);

      // If lecture is currently live and has a live URL, redirect to meeting
      if (data.isLive && data.liveUrl) {
        setTimeout(() => {
          window.open(data.liveUrl, '_blank');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to join live lecture.');
    } finally {
      setJoining(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !lecture) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Link Invalid</h1>
          <p className="text-slate-500 mb-6">{error}</p>
          <button onClick={() => navigate('/')} className="px-6 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!lecture) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full animate-fade-in">
        {/* Live badge */}
        <div className="flex items-center justify-center mb-6">
          {lecture.isLive ? (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-200">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-sm font-bold text-red-600">LIVE NOW</span>
            </span>
          ) : lecture.liveEndedAt ? (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200">
              <span className="w-3 h-3 rounded-full bg-slate-400" />
              <span className="text-sm font-semibold text-slate-600">Lecture Ended</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200">
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-sm font-semibold text-amber-600">Scheduled</span>
            </span>
          )}
        </div>

        {/* Lecture info */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{lecture.title}</h1>
          {lecture.className && (
            <p className="text-slate-500 text-sm">
              {lecture.className}{lecture.monthName ? ` · ${lecture.monthName}` : ''}
            </p>
          )}
        </div>

        {/* Video type badge */}
        {lecture.videoType && (
          <div className="flex justify-center mb-6">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
              lecture.videoType === 'ZOOM' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
              lecture.videoType === 'YOUTUBE' ? 'bg-red-50 text-red-600 border border-red-200' :
              lecture.videoType === 'DRIVE' ? 'bg-green-50 text-green-600 border border-green-200' :
              'bg-slate-50 text-slate-600 border border-slate-200'
            }`}>
              {lecture.videoType === 'ZOOM' && (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 3h12a4 4 0 014 4v10a4 4 0 01-4 4H4a4 4 0 01-4-4V7a4 4 0 014-4zm16.5 3.5l3.5-2v15l-3.5-2v-11z" /></svg>
              )}
              {lecture.videoType}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Join / Status actions */}
        {joined ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center animate-fade-in">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Attendance Marked!</h2>
            <p className="text-slate-500 text-sm mb-4">
              {lecture.isLive
                ? 'Opening live meeting. If it doesn\'t open automatically, click below.'
                : 'Your attendance has been recorded.'}
            </p>
            {lecture.isLive && lecture.liveUrl && (
              <a
                href={lecture.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Meeting
              </a>
            )}
            {lecture.videoUrl && !lecture.isLive && (
              <button
                onClick={() => navigate(`/recording/${lecture.id}`)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Watch Recording
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {user && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  {(user as any).email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{(user as any).email}</p>
                  <p className="text-xs text-slate-400">Logged in</p>
                </div>
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-bold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {joining ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Joining...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {lecture.isLive ? 'Join Live Lecture' : 'Mark Attendance & View'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
