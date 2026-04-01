import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import VideoPlayer, { SessionState, fmtTime } from '../components/VideoPlayer';

export default function RecordingPlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [recording, setRecording] = useState<any>(null);
  const [siblings, setSiblings] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Session save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [failedSession, setFailedSession] = useState<SessionState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const endSessionRef = useRef<(() => Promise<{ ok: boolean; error?: string; session: SessionState }>) | null>(null);

  // Fetch recording + sibling recordings from same month
  useEffect(() => {
    setLoading(true);
    setError('');
    setSaveError('');
    setFailedSession(null);
    api.get(`/recordings/${id}`)
      .then(async (r) => {
        const rec = r.data;
        setRecording(rec);
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
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50">
        <div className="max-w-sm text-center p-8">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">{error}</h2>
          <p className="text-slate-400 text-sm mb-6">You may need to submit payment to access this recording.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition">Go Back</button>
            <Link to="/payments/submit" className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition">Upload Payment</Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50">
        <div className="flex gap-2 items-center text-slate-400 text-sm">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading recording...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleBack}
            disabled={saving}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {saving ? 'Saving...' : 'Back'}
          </button>
          <div className="h-5 w-px bg-slate-700" />
          <h1 className="text-sm font-medium text-white truncate">{recording?.title}</h1>
          {recording?.topic && <span className="hidden sm:inline text-xs text-blue-400 font-medium">{recording.topic}</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle sidebar */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
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
        <div className="bg-red-900/90 border-b border-red-800 px-4 py-3 flex-shrink-0">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-red-200 text-sm font-medium">Failed to save your watch session</p>
              <p className="text-red-300/80 text-xs mt-0.5">{saveError}</p>
              <p className="text-red-300/60 text-xs mt-2">
                Take a screenshot of this for proof. Your session details:
              </p>
              {failedSession && (
                <div className="mt-2 bg-red-950/50 rounded-lg p-3 text-xs font-mono text-red-200/80 overflow-auto max-h-40">
                  <p>Recording: {recording?.title} (ID: {recording?.id})</p>
                  <p>Watch time: {fmtTime(failedSession.watchedSec)}</p>
                  <p>Events: {failedSession.events.length}</p>
                  <p>Time: {new Date().toLocaleString()}</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-red-300/60 hover:text-red-200">Show full event log</summary>
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
                  className="px-3 py-1.5 rounded-lg bg-red-800 text-red-100 text-xs font-medium hover:bg-red-700 transition disabled:opacity-50"
                >
                  {saving ? 'Retrying...' : 'Retry Save'}
                </button>
                <button
                  onClick={() => navigate(-1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition"
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
        <div className={`flex-1 min-w-0 flex flex-col ${sidebarOpen ? '' : ''}`}>
          <VideoPlayer
            recordingId={recording.id}
            videoUrl={recording.videoUrl}
            title={recording.title}
            endSessionRef={endSessionRef}
          />
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-80 lg:w-96 bg-slate-900 border-l border-slate-800 flex flex-col flex-shrink-0 overflow-hidden">
            {/* Description + Materials */}
            <div className="p-4 border-b border-slate-800 overflow-y-auto flex-shrink-0 max-h-48">
              {recording.description && (
                <p className="text-slate-400 text-xs leading-relaxed mb-3">{recording.description}</p>
              )}
              {materials.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Materials</p>
                  <div className="flex flex-col gap-1.5">
                    {materials.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition text-xs text-blue-400 font-medium">
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
                <p className="text-slate-600 text-xs italic">No description or materials</p>
              )}
            </div>

            {/* Other recordings from same month */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Other Recordings ({siblings.length})
                </p>
              </div>
              {siblings.length === 0 ? (
                <div className="p-6 text-center text-slate-600 text-xs">No other recordings</div>
              ) : (
                <div className="p-2 space-y-1">
                  {siblings.map((rec: any) => (
                    <Link
                      key={rec.id}
                      to={`/recording/${rec.id}`}
                      className="flex gap-3 p-2 rounded-lg hover:bg-slate-800 transition group"
                    >
                      <div className="w-24 h-14 rounded-md bg-slate-800 overflow-hidden flex-shrink-0 relative">
                        {rec.thumbnail ? (
                          <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-700">
                            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                        {rec.duration && (
                          <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded bg-black/80 text-white text-[9px] font-medium">
                            {typeof rec.duration === 'number' ? fmtTime(rec.duration) : rec.duration}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300 group-hover:text-white transition truncate">{rec.title}</p>
                        {rec.topic && <p className="text-[10px] text-blue-400 truncate mt-0.5">{rec.topic}</p>}
                        {rec.createdAt && (
                          <p className="text-[10px] text-slate-600 mt-0.5">
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
    </div>
  );
}