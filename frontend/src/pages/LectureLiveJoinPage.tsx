import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

interface LectureInfo {
  id: string;
  title: string;
  description?: string;
  platform?: string;
  mode: 'ONLINE' | 'OFFLINE';
  startTime: string;
  endTime: string;
  status: string;
  welcomeMessage?: string;
  month?: {
    id: string;
    name: string;
    class?: { id: string; name: string; subject?: string };
  };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getLectureState(lecture: LectureInfo) {
  const now = Date.now();
  const start = new Date(lecture.startTime).getTime();
  const end = new Date(lecture.endTime).getTime();
  if (now >= start && now <= end) return 'live';
  if (now < start) return 'upcoming';
  return 'ended';
}

export default function LectureLiveJoinPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();

  const [lecture, setLecture]       = useState<LectureInfo | null>(null);
  const [fetchError, setFetchError] = useState('');

  // Login form
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);

  // Single error surface for both login and join errors
  const [stepError, setStepError] = useState('');

  // Step covers full flow: idle â†’ signing-in â†’ joining â†’ done
  type Step = 'idle' | 'signing-in' | 'joining' | 'done';
  const [step, setStep] = useState<Step>('idle');

  const [joinResult, setJoinResult] = useState<{
    sessionLink?: string;
    meetingId?: string;
    meetingPassword?: string;
  } | null>(null);

  // useRef flag prevents double-join on rerenders (avoids useState race)
  const joinAttempted = useRef(false);

  // â”€â”€ Fetch lecture from token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!token) return;
    api.get(`/lectures/live/${token}`)
      .then(r => setLecture(r.data))
      .catch(() => setFetchError('This live lecture link is invalid or has expired.'));
  }, [token]);

  // â”€â”€ Core join call (token must already be in sessionStorage) â”€
  const doJoin = async () => {
    if (!token) return;
    setStep('joining');
    setStepError('');
    try {
      const res = await api.post(`/lectures/live/${token}/join`);
      setJoinResult(res.data);
      setStep('done');
      if (res.data.sessionLink) {
        setTimeout(() => window.open(res.data.sessionLink, '_blank'), 1400);
      }
    } catch (err: any) {
      setStepError(err.response?.data?.message || 'Failed to join. Please try again.');
      setStep('idle');
    }
  };

  // â”€â”€ Auto-join when page opens with active session â”€â”€â”€â”€â”€
  useEffect(() => {
    if (authLoading || !user || !lecture || joinAttempted.current) return;
    joinAttempted.current = true;
    doJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, lecture]);

  // â”€â”€ Login â†’ then immediately join (no useEffect relay) â”€
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepError('');
    setStep('signing-in');
    try {
      await login(identifier, password);
      // JWT is now in sessionStorage â€” doJoin can call the API immediately
      await doJoin();
    } catch (err: any) {
      // Only show error if we haven't already succeeded at doJoin
      if (step !== 'done') {
        setStepError(err.response?.data?.message || 'Invalid credentials. Please try again.');
        setStep('idle');
      }
    }
  };

  // â”€â”€ Derived display values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const isProcessing  = step === 'signing-in' || step === 'joining';
  const lectureState  = lecture ? getLectureState(lecture) : 'upcoming';
  const classNameStr  = lecture?.month?.class?.name || '';
  const monthNameStr  = lecture?.month?.name || '';

  // â”€â”€ Full-page loading / error screens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (authLoading || (!lecture && !fetchError)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 flex items-center justify-center">
        <div className="animate-spin w-9 h-9 border-[3px] border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Link Invalid</h1>
          <p className="text-slate-500 mb-6">{fetchError}</p>
          <button onClick={() => navigate('/')} className="px-6 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 transition">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!lecture) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">

        {/* Top accent bar */}
        <div className={`h-1.5 w-full ${
          lectureState === 'live'     ? 'bg-gradient-to-r from-red-400 to-red-600' :
          lectureState === 'upcoming' ? 'bg-gradient-to-r from-violet-400 to-violet-600' :
          'bg-gradient-to-r from-slate-300 to-slate-400'
        }`} />

        <div className="p-8">

          {/* Status badge */}
          <div className="flex items-center justify-center mb-6">
            {lectureState === 'live' && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-200">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-sm font-bold text-red-600">LIVE NOW</span>
              </span>
            )}
            {lectureState === 'upcoming' && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-sm font-semibold text-amber-600">Upcoming</span>
              </span>
            )}
            {lectureState === 'ended' && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span className="text-sm font-semibold text-slate-500">Session Ended</span>
              </span>
            )}
          </div>

          {/* Lecture info */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800 mb-1">{lecture.title}</h1>
            {(classNameStr || monthNameStr) && (
              <p className="text-slate-500 text-sm">{classNameStr}{monthNameStr ? ` Â· ${monthNameStr}` : ''}</p>
            )}
            <p className="text-slate-400 text-xs mt-1.5">{formatTime(lecture.startTime)}</p>
          </div>

          {/* Platform / mode badge */}
          <div className="flex justify-center mb-6">
            {lecture.mode === 'OFFLINE' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-orange-50 text-orange-600 border-orange-200">
                ðŸ« Physical Class
              </span>
            ) : lecture.platform ? (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                lecture.platform.toLowerCase().includes('zoom') ? 'bg-blue-50 text-blue-600 border-blue-200' :
                lecture.platform.toLowerCase().includes('meet') ? 'bg-green-50 text-green-600 border-green-200' :
                'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                {lecture.platform}
              </span>
            ) : null}
          </div>

          {/* â”€â”€â”€ Processing: sign-in â†’ joining step indicator â”€â”€â”€ */}
          {isProcessing && (
            <div className="flex flex-col items-center py-2 gap-5">
              <div className="flex items-center gap-2">
                {/* Step 1 */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  step === 'signing-in'
                    ? 'bg-violet-50 text-violet-600 border-violet-300'
                    : 'bg-green-50 text-green-600 border-green-200'
                }`}>
                  {step === 'signing-in' ? (
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  )}
                  {step === 'signing-in' ? 'Signing inâ€¦' : 'Signed in âœ“'}
                </div>

                <svg className="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Step 2 */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  step === 'joining'
                    ? 'bg-violet-50 text-violet-600 border-violet-300'
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}>
                  {step === 'joining' && (
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Marking attendance
                </div>

                <svg className="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Step 3 */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-slate-50 text-slate-400 border-slate-200">
                  Open meeting
                </div>
              </div>

              <p className="text-sm text-slate-500 text-center">
                {step === 'signing-in' ? 'Verifying your credentialsâ€¦' : 'Recording your attendanceâ€¦'}
              </p>
            </div>
          )}

          {/* â”€â”€â”€ Done: attendance marked + open meeting â”€â”€â”€ */}
          {step === 'done' && joinResult && (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Attendance Marked!</h2>
              <p className="text-slate-500 text-sm mb-5">
                {joinResult.sessionLink
                  ? 'The meeting is opening now. Tap below if it didn\'t open automatically.'
                  : 'Your attendance has been recorded.'}
              </p>

              {joinResult.sessionLink && (
                <a
                  href={joinResult.sessionLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white font-semibold text-sm hover:from-violet-600 hover:to-violet-700 transition shadow-lg shadow-violet-500/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Meeting
                </a>
              )}

              {(joinResult.meetingId || joinResult.meetingPassword) && (
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-left text-sm text-slate-700 space-y-1">
                  {joinResult.meetingId && (
                    <p><span className="font-semibold">Meeting ID:</span> <span className="font-mono">{joinResult.meetingId}</span></p>
                  )}
                  {joinResult.meetingPassword && (
                    <p><span className="font-semibold">Password:</span> <span className="font-mono">{joinResult.meetingPassword}</span></p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ Idle + logged in: user card + join button â”€â”€â”€ */}
          {step === 'idle' && user && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {(user as any).profile?.fullName?.[0]?.toUpperCase() || (user as any).email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {(user as any).profile?.fullName || (user as any).email}
                  </p>
                  <p className="text-xs text-slate-400">Logged in</p>
                </div>
              </div>

              {stepError && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">{stepError}</div>
              )}

              <button
                onClick={doJoin}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white text-sm font-bold hover:from-violet-600 hover:to-violet-700 transition shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {lectureState === 'live' ? 'Join Live Lecture' : lectureState === 'upcoming' ? 'Mark Attendance & Get Link' : 'Mark Attendance'}
              </button>
            </div>
          )}

          {/* â”€â”€â”€ Idle + not logged in: inline login form â”€â”€â”€ */}
          {step === 'idle' && !user && (
            <div>
              <p className="text-sm text-slate-500 text-center mb-5">
                Sign in to join this lecture and mark your attendance.
              </p>

              {stepError && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {stepError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email or Phone</label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                      className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPw ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Flow hint */}
                <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-100 text-[11px] text-violet-600 font-medium">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sign in â†’ Attendance marked automatically â†’ Meeting opens
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white text-sm font-bold hover:from-violet-600 hover:to-violet-700 transition shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign in & Join Lecture
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
