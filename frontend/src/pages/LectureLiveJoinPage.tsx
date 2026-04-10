import { useEffect, useState } from 'react';
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

  // 'guest' = public guest form, 'account' = login with credentials
  const [joinMode, setJoinMode] = useState<'guest' | 'account'>('guest');

  // Login form
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);

  // Guest form
  const [guestName,  setGuestName]  = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestNote,  setGuestNote]  = useState('');

  // Single error surface for both login and join errors
  const [stepError, setStepError] = useState('');

  // When true, show login form even if user is already logged in
  const [useOtherAccount, setUseOtherAccount] = useState(false);

  // Step covers full flow: idle ? signing-in ? joining ? done
  type Step = 'idle' | 'signing-in' | 'joining' | 'done';
  const [step, setStep] = useState<Step>('idle');

  const [joinResult, setJoinResult] = useState<{
    sessionLink?: string;
    meetingId?: string;
    meetingPassword?: string;
  } | null>(null);

  // -- Fetch lecture from token ------------------------------
  useEffect(() => {
    if (!token) return;
    api.get(`/lectures/live/${token}`)
      .then(r => {
        setLecture(r.data);
        // Default to guest mode for public lectures, account mode otherwise
        if (r.data.status === 'ANYONE') {
          setJoinMode('guest');
        } else {
          setJoinMode('account');
        }
      })
      .catch(() => setFetchError('This live lecture link is invalid or has expired.'));
  }, [token]);

  // -- Core join call (token must already be in sessionStorage) --
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

  // -- Guest join (no auth) --
  const handleGuestJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setStepError('');
    setStep('joining');
    try {
      const res = await api.post(`/lectures/live/${token}/join-guest`, {
        fullName: guestName.trim(),
        phone: guestPhone.trim(),
        email: guestEmail.trim() || undefined,
        note: guestNote.trim() || undefined,
      });
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

  // -- Login ? then immediately join (no useEffect relay) --
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepError('');
    setStep('signing-in');
    try {
      await login(identifier, password);
      // JWT is now in sessionStorage — doJoin can call the API immediately
      await doJoin();
    } catch (err: any) {
      // Only show error if we haven't already succeeded at doJoin
      if (step !== 'done') {
        setStepError(err.response?.data?.message || 'Invalid credentials. Please try again.');
        setStep('idle');
      }
    }
  };

  // ── Derived display values ────────────────────────────
  const isProcessing  = step === 'signing-in' || step === 'joining';
  const lectureState  = lecture ? getLectureState(lecture) : 'upcoming';
  const classNameStr  = lecture?.month?.class?.name || '';
  const monthNameStr  = lecture?.month?.name || '';

  // ── Full-page loading / error screens ────────────────
  if (authLoading || (!lecture && !fetchError)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin w-9 h-9 border-[3px] border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Link Invalid</h1>
          <p className="text-slate-500 mb-6">{fetchError}</p>
          <button onClick={() => navigate('/')} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold hover:opacity-90 transition">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!lecture) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center p-4 lg:p-8">
      {/* Desktop: two-column card. Mobile: single column */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden lg:grid lg:grid-cols-[1fr_1fr]">

        {/* -- Left panel: Lecture info (desktop) / header (mobile) -- */}
        <div className={`relative flex flex-col justify-between p-8 lg:p-10 ${
          lectureState === 'live'     ? 'bg-gradient-to-br from-red-500 via-red-600 to-orange-600' :
          lectureState === 'upcoming' ? 'bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(221,70%,25%)] to-[hsl(221,83%,38%)]' :
          'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800'
        }`}>
          {/* decorative blobs */}
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4 pointer-events-none" />

          <div className="relative z-10">
            {/* Status badge */}
            <div className="mb-6">
              {lectureState === 'live' && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/30 text-white text-sm font-bold backdrop-blur-sm">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                  </span>
                  LIVE NOW
                </span>
              )}
              {lectureState === 'upcoming' && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/30 text-white text-sm font-semibold backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-300" />
                  Upcoming
                </span>
              )}
              {lectureState === 'ended' && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/30 text-white text-sm font-semibold backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  Session Ended
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight mb-3">{lecture.title}</h1>

            {/* Class + month */}
            {(classNameStr || monthNameStr) && (
              <p className="text-white/75 text-sm mb-4">{classNameStr}{monthNameStr ? ` � ${monthNameStr}` : ''}</p>
            )}

            {/* Platform badge */}
            {lecture.mode === 'OFFLINE' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white border border-white/20">
                ?? Physical Class
              </span>
            ) : lecture.platform ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white border border-white/20">
                {lecture.platform}
              </span>
            ) : null}
          </div>

          {/* Time info at bottom */}
          <div className="relative z-10 mt-8">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm">
              <svg className="w-5 h-5 text-white/70 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-0.5">Scheduled Time</p>
                <p className="text-white text-sm font-semibold">{formatTime(lecture.startTime)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* -- Right panel: action area -- */}
        <div className="p-8 lg:p-10 flex flex-col justify-center">

          {/* --- Mode switcher (only for public ANYONE lectures) --- */}
          {step === 'idle' && lecture.status === 'ANYONE' && (
            <div className="flex rounded-xl border-2 border-slate-200 overflow-hidden mb-6">
              <button
                type="button"
                onClick={() => { setJoinMode('guest'); setStepError(''); setUseOtherAccount(false); }}
                className={`flex-1 py-2.5 text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
                  joinMode === 'guest'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Join as Guest
              </button>
              <button
                type="button"
                onClick={() => { setJoinMode('account'); setStepError(''); }}
                className={`flex-1 py-2.5 text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
                  joinMode === 'account'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign in with Account
              </button>
            </div>
          )}

          {/* --- Processing step indicator --- */}
          {isProcessing && (
            <div className="flex flex-col items-center py-6 gap-6">
              <div className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
                {/* Step 1 � only shown for account login flow */}
                {joinMode === 'account' && (
                  <>
                    <div className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      step === 'signing-in' ? 'bg-blue-50 border-blue-300' : 'bg-green-50 border-green-200'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        step === 'signing-in' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {step === 'signing-in' ? (
                          <svg className="w-4 h-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        )}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${step === 'signing-in' ? 'text-blue-700' : 'text-green-700'}`}>
                          {step === 'signing-in' ? 'Signing in�' : 'Signed in ?'}
                        </p>
                        {step === 'signing-in' && <p className="text-xs text-blue-500">Verifying your credentials</p>}
                      </div>
                    </div>
                    {/* Connector */}
                    <div className="w-0.5 h-4 bg-slate-200 rounded-full" />
                  </>
                )}

                {/* Step 2 */}
                <div className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  step === 'joining' ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step === 'joining' ? 'bg-blue-100' : 'bg-slate-100'
                  }`}>
                    {step === 'joining' ? (
                      <svg className="w-4 h-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${step === 'joining' ? 'text-blue-700' : 'text-slate-400'}`}>
                      Recording attendance
                    </p>
                    {step === 'joining' && <p className="text-xs text-blue-500">Marking you as present</p>}
                  </div>
                </div>

                {/* Connector */}
                <div className="w-0.5 h-4 bg-slate-200 rounded-full" />

                {/* Step 3 */}
                <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border bg-slate-50 border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-400">Open meeting</p>
                </div>
              </div>
            </div>
          )}

          {/* --- Done --- */}
          {step === 'done' && joinResult && (
            <div className="text-center py-4">
              <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Attendance Marked!</h2>
              <p className="text-slate-500 mb-6">
                {joinResult.sessionLink
                  ? 'The meeting is opening now. Tap the button below if it didn\'t open.'
                  : 'Your attendance has been recorded successfully.'}
              </p>

              {joinResult.sessionLink && (
                <a
                  href={joinResult.sessionLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-base hover:from-blue-700 hover:to-blue-800 transition shadow-xl shadow-blue-500/25"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Meeting
                </a>
              )}

              {(joinResult.meetingId || joinResult.meetingPassword) && (
                <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2">
                  {joinResult.meetingId && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500 font-medium">Meeting ID</span>
                      <span className="text-sm font-mono font-bold text-slate-800">{joinResult.meetingId}</span>
                    </div>
                  )}
                  {joinResult.meetingPassword && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500 font-medium">Password</span>
                      <span className="text-sm font-mono font-bold text-slate-800">{joinResult.meetingPassword}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* --- Idle: logged in ? confirm identity (account mode) --- */}
          {step === 'idle' && joinMode === 'account' && user && !useOtherAccount && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Is this you?</h2>
                <p className="text-slate-500 text-sm">Confirm your profile to mark attendance and join the lecture.</p>
              </div>

              {/* User card */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50 border-2 border-blue-200">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg shadow-blue-500/30">
                  {(user as any).profile?.fullName?.[0]?.toUpperCase() || (user as any).email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800 truncate text-base">
                    {(user as any).profile?.fullName || (user as any).email}
                  </p>
                  <p className="text-sm text-blue-600 font-medium">Currently signed in</p>
                </div>
                <svg className="w-6 h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>

              {stepError && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">{stepError}</div>
              )}

              {/* Yes � join as this user */}
              <button
                onClick={doJoin}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-base hover:from-blue-700 hover:to-blue-800 transition shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Yes, that's me � {lectureState === 'live' ? 'Join Lecture' : lectureState === 'upcoming' ? 'Mark Attendance & Get Link' : 'Mark Attendance'}
              </button>

              {/* Not me */}
              <button
                onClick={() => { setUseOtherAccount(true); setStepError(''); }}
                className="w-full py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Not me � use a different account
              </button>
            </div>
          )}

          {/* --- Idle: not logged in (or chose different account) ? login form (account mode) --- */}
          {step === 'idle' && joinMode === 'account' && (!user || useOtherAccount) && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Sign in to join</h2>
                <p className="text-slate-500 text-sm">Your attendance will be marked automatically after login.</p>
              </div>

              {stepError && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {stepError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email or Phone</label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder="you@example.com"
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="��������"
                      className="w-full px-4 py-3.5 pr-12 rounded-xl border-2 border-slate-200 bg-slate-50 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPw ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Flow hint */}
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-600 font-medium">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sign in ? Attendance marked automatically ? Meeting opens
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-base hover:from-blue-700 hover:to-blue-800 transition shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2.5"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign in & Join Lecture
                </button>
              </form>
            </div>
          )}

          {/* --- Idle: guest mode form --- */}
          {step === 'idle' && joinMode === 'guest' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Join as Guest</h2>
                <p className="text-slate-500 text-sm">Enter your details to join this public lecture. No account needed.</p>
              </div>

              {stepError && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {stepError}
                </div>
              )}

              <form onSubmit={handleGuestJoin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    required
                    placeholder="e.g. Kamal Perera"
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={e => setGuestPhone(e.target.value)}
                    required
                    placeholder="e.g. 0771234567"
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Note <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={guestNote}
                    onChange={e => setGuestNote(e.target.value)}
                    placeholder="e.g. School, grade, or any message"
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-base hover:from-blue-700 hover:to-blue-800 transition shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2.5"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Join Lecture
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
