import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  cardImageUrl?: string;
  bgMediaUrl?: string;
  sessionLink?: string;
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

function isVideo(url: string) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

/* ─── Welcome Message Overlay ─────────────────────────── */
function WelcomeOverlay({
  html,
  sessionLink,
  onSkip,
  avatarUrl,
  userName,
}: {
  html: string;
  sessionLink?: string;
  onSkip: () => void;
  avatarUrl?: string | null;
  userName?: string | null;
}) {
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          if (sessionLink) window.open(sessionLink, '_blank');
          onSkip();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full overflow-hidden ring-2 ring-white/40 shadow-lg">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/20 flex items-center justify-center">
                {userName ? (
                  <span className="text-white font-bold text-xl">{userName[0].toUpperCase()}</span>
                ) : (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
            )}
          </div>
          <h2 className="text-xl font-bold text-white">Welcome!</h2>
          <p className="text-blue-100 text-sm mt-0.5">Message from your instructor</p>
        </div>

        {/* Message body */}
        <div className="px-6 py-5 max-h-64 overflow-y-auto">
          <div
            className="prose prose-sm max-w-none text-slate-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 space-y-3">
          {sessionLink && (
            <a
              href={sessionLink}
              target="_blank"
              rel="noreferrer"
              onClick={onSkip}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2.5 hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/25"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open Meeting Now
            </a>
          )}
          <button
            onClick={onSkip}
            className="w-full py-2.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition flex items-center justify-center gap-2"
          >
            {sessionLink
              ? `Auto-redirecting in ${countdown}s — Skip`
              : `Close (${countdown}s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────── */

export default function LectureLiveJoinPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldAutoJoin = searchParams.get('autoJoin') === '1';

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

  const [stepError, setStepError] = useState('');
  const [useOtherAccount, setUseOtherAccount] = useState(false);

  // Enrollment check for ENROLLED_ONLY lectures
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);

  type Step = 'idle' | 'signing-in' | 'joining' | 'done';
  const [step, setStep] = useState<Step>('idle');

  const [joinResult, setJoinResult] = useState<{
    sessionLink?: string;
    meetingId?: string;
    meetingPassword?: string;
  } | null>(null);

  // Welcome message overlay
  const [showWelcome, setShowWelcome] = useState(false);
  const autoJoinTriggeredRef = useRef(false);

  // ── Fetch lecture from token ──────────────────────────
  useEffect(() => {
    if (!token) return;
    api.get(`/lectures/live/${token}`)
      .then(r => {
        setLecture(r.data);
      })
      .catch(() => setFetchError('This live lecture link is invalid or has expired.'));
  }, [token]);

  useEffect(() => {
    if (!lecture) return;
    if (lecture.status === 'ANYONE') {
      setJoinMode(user ? 'account' : 'guest');
      return;
    }
    setJoinMode('account');
  }, [lecture, user]);

  // Check enrollment for ENROLLED_ONLY lectures once user + lecture are known
  useEffect(() => {
    if (!lecture || !token || lecture.status !== 'ENROLLED_ONLY') {
      setIsEnrolled(null);
      return;
    }
    if (!user) {
      setIsEnrolled(null);
      return;
    }
    api.get(`/lectures/live/${token}/check-access`)
      .then(r => setIsEnrolled(r.data.enrolled))
      .catch(() => setIsEnrolled(false));
  }, [lecture, user, token]);

  // ── Core join call ────────────────────────────────────
  const doJoin = useCallback(async (skipWelcome = false) => {
    if (!token) return;
    setStep('joining');
    setStepError('');
    try {
      const res = await api.post(`/lectures/live/${token}/join`);
      setJoinResult(res.data);
      setStep('done');
      if (!skipWelcome && lecture?.welcomeMessage) {
        setShowWelcome(true);
      } else if (res.data.sessionLink) {
        setTimeout(() => window.open(res.data.sessionLink, '_blank'), 400);
      }
    } catch (err: any) {
      setStepError(err.response?.data?.message || 'Failed to join. Please try again.');
      setStep('idle');
    }
  }, [token, lecture]);

  useEffect(() => {
    if (!shouldAutoJoin) return;
    if (autoJoinTriggeredRef.current) return;
    if (authLoading || !lecture || !user) return;
    if (joinMode !== 'account' || step !== 'idle') return;

    autoJoinTriggeredRef.current = true;
    void doJoin(false);
  }, [shouldAutoJoin, authLoading, lecture, user, joinMode, step, doJoin]);

  // ── Guest join ────────────────────────────────────────
  const handleGuestJoin = async (e: React.FormEvent, skipWelcome = false) => {
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
      if (!skipWelcome && lecture?.welcomeMessage) {
        setShowWelcome(true);
      } else if (res.data.sessionLink) {
        setTimeout(() => window.open(res.data.sessionLink, '_blank'), 400);
      }
    } catch (err: any) {
      setStepError(err.response?.data?.message || 'Failed to join. Please try again.');
      setStep('idle');
    }
  };

  // ── Login → join ──────────────────────────────────────
  const handleLogin = async (e: React.FormEvent, skipWelcome = false) => {
    e.preventDefault();
    setStepError('');
    setStep('signing-in');
    try {
      await login(identifier, password);
      await doJoin(skipWelcome);
    } catch (err: any) {
      if (step !== 'done') {
        setStepError(err.response?.data?.message || 'Invalid credentials. Please try again.');
        setStep('idle');
      }
    }
  };

  // ── Derived ───────────────────────────────────────────
  const isProcessing = step === 'signing-in' || step === 'joining';
  const lectureState = lecture ? getLectureState(lecture) : 'upcoming';
  const classNameStr = lecture?.month?.class?.name || '';
  const monthNameStr = lecture?.month?.name || '';

  const leftBg =
    lectureState === 'live'     ? 'from-red-600 via-red-700 to-orange-700' :
    lectureState === 'upcoming' ? 'from-[hsl(222,47%,11%)] via-[hsl(221,70%,25%)] to-[hsl(221,83%,38%)]' :
    'from-slate-600 via-slate-700 to-slate-800';

  // ── Loading / error screens ───────────────────────────
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
    <>
      {/* Welcome overlay */}
      {showWelcome && joinResult && lecture.welcomeMessage && (
        <WelcomeOverlay
          html={lecture.welcomeMessage}
          sessionLink={joinResult.sessionLink}
          onSkip={() => setShowWelcome(false)}
          avatarUrl={(user as any)?.profile?.avatarUrl ?? null}
          userName={(user as any)?.profile?.fullName || (user as any)?.email || null}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center p-4 lg:p-8">
        {/* Fixed-size two-column card — right panel scrolls internally, card never resizes */}
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden lg:grid lg:grid-cols-[1fr_1fr] lg:h-[640px]">

          {/* ── Left panel ── */}
          <div className={`relative flex flex-col overflow-hidden ${lecture.bgMediaUrl ? '' : `bg-gradient-to-br ${leftBg}`}`}>
            {/* Background media */}
            {lecture.bgMediaUrl && (
              isVideo(lecture.bgMediaUrl) ? (
                <video
                  src={lecture.bgMediaUrl}
                  autoPlay muted loop playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <img src={lecture.bgMediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )
            )}
            {/* Overlay so text stays readable */}
            <div className={`absolute inset-0 ${lecture.bgMediaUrl ? 'bg-black/55' : `bg-gradient-to-br ${leftBg} opacity-90`}`} />

            {/* Decorative blobs */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4 pointer-events-none" />

            <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-10">
              <div>
                {/* Status badge */}
                <div className="mb-5">
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

                {/* Card image */}
                {lecture.cardImageUrl && (
                  <div className="mb-5 rounded-2xl overflow-hidden ring-2 ring-white/20 shadow-lg shadow-black/30">
                    <img src={lecture.cardImageUrl} alt={lecture.title} className="w-full h-32 object-cover" />
                  </div>
                )}

                {/* Title */}
                <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight mb-3">{lecture.title}</h1>

                {(classNameStr || monthNameStr) && (
                  <p className="text-white/75 text-sm mb-4">{classNameStr}{monthNameStr ? ` · ${monthNameStr}` : ''}</p>
                )}

                {lecture.mode === 'OFFLINE' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white border border-white/20">
                    🏫 Physical Class
                  </span>
                ) : lecture.platform ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white border border-white/20">
                    {lecture.platform}
                  </span>
                ) : null}
              </div>

              {/* Time info */}
              <div className="mt-6">
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
          </div>

          {/* ── Right panel — fixed height, scrollable content ── */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8 lg:p-10">

              {/* Mode switcher (ANYONE lectures) */}
              {step === 'idle' && lecture.status === 'ANYONE' && (
                <div className="flex rounded-xl border-2 border-slate-200 overflow-hidden mb-6">
                  <button
                    type="button"
                    onClick={() => { setJoinMode('guest'); setStepError(''); setUseOtherAccount(false); }}
                    className={`flex-1 py-2.5 text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
                      joinMode === 'guest' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
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
                      joinMode === 'account' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Sign in with Account
                  </button>
                </div>
              )}

              {/* Processing indicator */}
              {isProcessing && (
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center">
                    <svg className="w-7 h-7 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-700">
                      {step === 'signing-in' ? 'Signing in…' : 'Recording attendance…'}
                    </p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {step === 'signing-in' ? 'Verifying your credentials' : 'Please wait a moment'}
                    </p>
                  </div>
                </div>
              )}

              {/* Done */}
              {step === 'done' && joinResult && !showWelcome && (
                <div className="text-center py-6">
                  <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">You're in!</h2>
                  <p className="text-slate-500 mb-6 text-sm">
                    {joinResult.sessionLink
                      ? 'The meeting is opening now. Tap below if it didn\'t open automatically.'
                      : 'Your attendance has been recorded successfully.'}
                  </p>

                  {joinResult.sessionLink && (
                    <a
                      href={joinResult.sessionLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-xl shadow-blue-500/25"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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

              {/* Idle: logged-in confirm identity (account mode) */}
              {step === 'idle' && joinMode === 'account' && user && !useOtherAccount && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-1">Is this you?</h2>
                    <p className="text-slate-500 text-sm">Confirm your profile to mark attendance and join.</p>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50 border-2 border-blue-200">
                    {(user as any).profile?.avatarUrl ? (
                      <img src={(user as any).profile.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0 shadow-lg ring-2 ring-blue-200" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg shadow-blue-500/30">
                        {(user as any).profile?.fullName?.[0]?.toUpperCase() || (user as any).email?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 truncate text-base">
                        {(user as any).profile?.fullName || (user as any).email}
                      </p>
                      <p className="text-sm text-blue-600 font-medium">Currently signed in</p>
                    </div>
                  </div>

                  {/* ENROLLED_ONLY: enrollment check loading */}
                  {lecture.status === 'ENROLLED_ONLY' && isEnrolled === null && (
                    <div className="flex items-center justify-center gap-2 py-2 text-slate-500 text-sm">
                      <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Checking enrollment…
                    </div>
                  )}

                  {/* ENROLLED_ONLY: not enrolled — block join */}
                  {lecture.status === 'ENROLLED_ONLY' && isEnrolled === false && (
                    <div className="px-4 py-4 rounded-2xl bg-amber-50 border-2 border-amber-200 text-center space-y-2">
                      <svg className="w-8 h-8 text-amber-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <p className="font-bold text-amber-800 text-sm">Not enrolled in this class</p>
                      <p className="text-amber-700 text-xs leading-relaxed">This lecture is only available to students enrolled in the class. Please contact your instructor to get enrolled.</p>
                    </div>
                  )}

                  {stepError && (
                    <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">{stepError}</div>
                  )}

                  {/* Join buttons — only show if not ENROLLED_ONLY, or if enrolled */}
                  {(lecture.status !== 'ENROLLED_ONLY' || isEnrolled === true) && (
                    <>
                      {/* Join with welcome message */}
                      <button
                        onClick={() => doJoin(false)}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2.5"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Yes, that's me — Join Lecture
                      </button>

                      {/* Direct join (skip welcome message) */}
                      <button
                        onClick={() => doJoin(true)}
                        className="w-full py-3 rounded-2xl border-2 border-blue-200 text-blue-700 font-semibold text-sm hover:bg-blue-50 transition flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Join Directly (skip welcome message)
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => { setUseOtherAccount(true); setStepError(''); }}
                    className="w-full py-2.5 rounded-2xl border-2 border-slate-200 text-slate-500 font-medium text-sm hover:bg-slate-50 transition text-center"
                  >
                    Not me — use a different account
                  </button>
                </div>
              )}

              {/* Idle: not logged in / different account — login form (account mode) */}
              {step === 'idle' && joinMode === 'account' && (!user || useOtherAccount) && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-1">Sign in to join</h2>
                    <p className="text-slate-500 text-sm">Your attendance will be marked automatically after sign-in.</p>
                  </div>

                  {stepError && (
                    <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {stepError}
                    </div>
                  )}

                  <form className="space-y-4">
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
                          placeholder="••••••••"
                          className="w-full px-4 py-3.5 pr-12 rounded-xl border-2 border-slate-200 bg-slate-50 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition"
                        />
                        <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                          {showPw ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Primary: join with welcome message */}
                    <button
                      type="button"
                      onClick={e => handleLogin(e as any, false)}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2.5"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Sign in & Join Lecture
                    </button>

                    {/* Secondary: direct join, skip welcome */}
                    <button
                      type="button"
                      onClick={e => handleLogin(e as any, true)}
                      className="w-full py-3 rounded-2xl border-2 border-blue-200 text-blue-700 font-semibold text-sm hover:bg-blue-50 transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Sign in & Join Directly
                    </button>
                  </form>
                </div>
              )}

              {/* Idle: guest mode */}
              {step === 'idle' && joinMode === 'guest' && (
                <div className="space-y-4">
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
                      <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} required placeholder="e.g. Kamal Perera"
                        className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number <span className="text-red-500">*</span></label>
                      <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} required placeholder="e.g. 0771234567"
                        className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Email <span className="text-slate-400 font-normal">(optional)</span></label>
                      <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="you@example.com"
                        className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Note <span className="text-slate-400 font-normal">(optional)</span></label>
                      <input type="text" value={guestNote} onChange={e => setGuestNote(e.target.value)} placeholder="e.g. School, grade, or any message"
                        className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition" />
                    </div>

                    {/* Join with welcome */}
                    <button type="submit"
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2.5"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      Join Lecture
                    </button>

                    {/* Direct join (skip welcome) */}
                    <button
                      type="button"
                      onClick={e => handleGuestJoin(e as any, true)}
                      className="w-full py-3 rounded-2xl border-2 border-blue-200 text-blue-700 font-semibold text-sm hover:bg-blue-50 transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Join Directly (skip welcome message)
                    </button>
                  </form>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </>
  );
}
