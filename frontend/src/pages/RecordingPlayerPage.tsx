import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import type { SessionState } from '../components/VideoPlayer';
import VideoPlayer, { fmtTime } from '../components/VideoPlayer';
import { resolveWelcomeMessage } from '../components/WelcomeMessageEditor';
import { useAuth } from '../context/AuthContext';

export default function RecordingPlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [recording, setRecording] = useState<any>(null);
  const [siblings, setSiblings] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Session save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [failedSession, setFailedSession] = useState<SessionState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const classIdRef = useRef<string | null>(null);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const endSessionRef = useRef<(() => Promise<{ ok: boolean; error?: string; session: SessionState }>) | null>(null);
  const isGuest = !user;

  // Fetch recording + sibling recordings from same month
  useEffect(() => {
    setLoading(true);
    setError('');
    setSaveError('');
    setFailedSession(null);
    setShowWelcome(false);
    api.get(`/recordings/${id}`)
      .then(async (r) => {
        const rec = r.data;
        setRecording(rec);
        classIdRef.current = rec.month?.class?.id || null;
        setShowWelcome(true);
        // Fetch other recordings from same month
        if (rec.monthId) {
          try {
            const sibs = await api.get(`/recordings/by-month/${rec.monthId}`);
            setSiblings((sibs.data || []).filter((s: any) => s.id !== rec.id));
          } catch { setSiblings([]); }
        }
      })
      .catch(err => setError(err.response?.data?.message || 'Cannot access this recording'))
      .finally(() => setLoading(false));
  }, [id]);

  // ─── Back handler: end session, check result ────────────

  const handleBack = useCallback(async () => {
    if (endSessionRef.current) {
      setSaving(true);
      setSaveError('');
      const result = await endSessionRef.current();
      setSaving(false);
      if (result.ok) {
        navigate(-1);
      } else {
        setSaveError(result.error || 'Failed to save watch session');
        setFailedSession(result.session);
      }
    } else {
      navigate(-1);
    }
  }, [navigate]);

  // Skip welcome overlay
  const handleSkip = useCallback(() => {
    if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; }
    setShowWelcome(false);
  }, []);

  // Typing animation for welcome message
  useEffect(() => {
    if (!showWelcome || !recording) return;
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    const name = user?.profile?.fullName || 'Guest';
    const monthName = recording?.month?.name || '';
    const className = recording?.month?.class?.name || '';
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const rawMsg = recording?.welcomeMessage || '';
    const stripHtml = (html: string) => {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.textContent || div.innerText || '';
    };
    const resolvedMsg = rawMsg ? stripHtml(resolveWelcomeMessage(rawMsg, {
      '{{studentName}}': name,
      '{{month}}': monthName,
      '{{date}}': dateStr,
      '{{className}}': className,
      '{{recordingTitle}}': recording?.title || '',
      '{{teacherName}}': 'Sir',
    })) : '';

    let lines = `${greet}, ${name}! 👋`;
    if (resolvedMsg) {
      lines += `\n\n${resolvedMsg}`;
    } else {
      lines += `\n\nYou're about to watch "${recording?.title}"`;
      if (className) lines += ` from ${className}`;
      if (monthName) lines += ` — ${monthName}`;
      lines += '.';
      if (!isGuest) {
        lines += '\n\nYour attendance will be recorded once you start.';
      }
    }
    setTypedText('');
    setTypingDone(false);

    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i <= lines.length) {
        setTypedText(lines.slice(0, i));
      } else {
        clearInterval(interval);
        setTypingDone(true);
      }
    }, 28);
    typingRef.current = interval;
    return () => { clearInterval(interval); typingRef.current = null; };
  }, [showWelcome, recording, user]);

  // Parse materials
  const materials = (() => {
    if (!recording?.materials) return [];
    try {
      const m = JSON.parse(recording.materials);
      return Array.isArray(m) ? m : [];
    } catch { return []; }
  })();

  // ─── Error state ────────────────────────────────────────

  if (error) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center z-50">
        <div className="max-w-sm text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">{error}</h2>
          <p className="text-slate-500 text-sm mb-6">You may need to submit payment to access this recording.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition">Go Back</button>
            <Link to="/payments/submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-500/25">Upload Payment</Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-3 text-slate-500 text-sm">
          <div className="w-10 h-10 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
          Loading recording...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleBack}
            disabled={saving}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition disabled:opacity-50 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {saving ? 'Saving...' : 'Back'}
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <h1 className="text-sm font-semibold text-slate-800 truncate">{recording?.title}</h1>
          {recording?.topic && <span className="hidden sm:inline text-xs text-blue-500 font-medium bg-blue-50 px-2 py-0.5 rounded-full">{recording.topic}</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle sidebar */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Save error overlay */}
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex-shrink-0">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-red-800 text-sm font-medium">Failed to save your watch session</p>
              <p className="text-red-600 text-xs mt-0.5">{saveError}</p>
              <p className="text-red-500 text-xs mt-2">
                Take a screenshot of this for proof. Your session details:
              </p>
              {failedSession && (
                <div className="mt-2 bg-red-100 rounded-lg p-3 text-xs font-mono text-red-700 overflow-auto max-h-40 border border-red-200">
                  <p>Recording: {recording?.title} (ID: {recording?.id})</p>
                  <p>Watch time: {fmtTime(failedSession.watchedSec)}</p>
                  <p>Events: {failedSession.events.length}</p>
                  <p>Time: {new Date().toLocaleString()}</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-red-500 hover:text-red-700">Show full event log</summary>
                    <pre className="mt-1 text-[10px] whitespace-pre-wrap">{JSON.stringify(failedSession.events, null, 2)}</pre>
                  </details>
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={async () => {
                    setSaving(true);
                    setSaveError('');
                    if (endSessionRef.current) {
                      const r = await endSessionRef.current();
                      if (r.ok) { navigate(-1); return; }
                      setSaveError(r.error || 'Still failed');
                      setFailedSession(r.session);
                    }
                    setSaving(false);
                  }}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition disabled:opacity-50"
                >
                  {saving ? 'Retrying...' : 'Retry Save'}
                </button>
                <button
                  onClick={() => navigate(-1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition"
                >
                  Leave Without Saving
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content: video + sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Video area */}
        <div className="flex-1 min-w-0 flex flex-col">
          <VideoPlayer
            recordingId={recording.id}
            videoUrl={recording.videoUrl}
            title={recording.title}
            skipTracking={isGuest}
            endSessionRef={endSessionRef}
            userId={user?.id}
            userName={user?.profile?.fullName || user?.email}
            userEmail={user?.email}
            userAvatar={user?.profile?.avatarUrl}
          />
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <div className="hidden lg:flex w-80 lg:w-96 bg-white border-l border-slate-200 flex-col flex-shrink-0 overflow-hidden">
            {/* Description + Materials */}
            <div className="p-4 border-b border-slate-100 overflow-y-auto flex-shrink-0 max-h-48">
              {recording.description && (
                <p className="text-slate-500 text-xs leading-relaxed mb-3">{recording.description}</p>
              )}
              {materials.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Materials</p>
                  <div className="flex flex-col gap-1.5">
                    {materials.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition text-xs text-blue-600 font-medium border border-blue-100">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Material {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {!recording.description && materials.length === 0 && (
                <p className="text-slate-400 text-xs italic">No description or materials</p>
              )}
            </div>

            {/* Other recordings from same month */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b border-slate-100 sticky top-0 bg-white z-10">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Other Recordings ({siblings.length})
                </p>
              </div>
              {siblings.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No other recordings</div>
              ) : (
                <div className="p-2 space-y-1">
                  {siblings.map((rec: any) => (
                    <Link
                      key={rec.id}
                      to={`/recording/${rec.id}`}
                      className="flex gap-3 p-2 rounded-xl hover:bg-slate-50 transition group border border-transparent hover:border-slate-200"
                    >
                      <div className="w-24 h-14 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 relative">
                        {rec.thumbnail ? (
                          <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/30">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                        {rec.duration && (
                          <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded bg-black/70 text-white text-[9px] font-medium">
                            {typeof rec.duration === 'number' ? fmtTime(rec.duration) : rec.duration}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 group-hover:text-blue-600 transition truncate">{rec.title}</p>
                        {rec.topic && <p className="text-[10px] text-blue-500 truncate mt-0.5">{rec.topic}</p>}
                        {rec.createdAt && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(rec.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Welcome message overlay — skippable like game intros */}
      {showWelcome && (
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-slate-50 via-white to-blue-50/50 flex flex-col items-center justify-center p-4">
          {/* Skip button — always visible, top-right */}
          <button
            onClick={handleSkip}
            className="absolute top-5 right-5 flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 transition shadow-sm"
          >
            Skip
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>

          <div className="w-full max-w-lg flex flex-col items-center">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/15 mb-5">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>

            {/* Message card */}
            <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 shadow-lg min-h-[140px]">
              <pre className="text-slate-700 text-base font-sans leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'inherit' }}>
                {typedText}
                {!typingDone && <span className="inline-block w-0.5 h-5 bg-blue-500 ml-0.5 animate-pulse align-middle" />}
              </pre>
            </div>

            {/* Start button — appears after typing */}
            <button
              onClick={handleSkip}
              className={`mt-5 w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 ${typingDone ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'} transition-all duration-400`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              Start Watching
            </button>

            {/* Click anywhere hint */}
            <p className={`mt-3 text-xs text-slate-400 ${typingDone ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
              Press <span className="font-semibold text-slate-500">Skip</span> to start watching
            </p>
          </div>
        </div>
      )}
    </div>
  );
}