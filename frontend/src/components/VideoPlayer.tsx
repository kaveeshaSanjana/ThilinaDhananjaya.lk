import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../lib/api';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export interface SessionEvent {
  type: string;
  videoTime: number;
  wallTime: string;
}

export interface SessionState {
  sessionId: string | null;
  status: 'idle' | 'watching' | 'paused' | 'ended';
  watchedSec: number;
  events: SessionEvent[];
}

interface VideoPlayerProps {
  recordingId: string;
  videoUrl: string;
  title: string;
  skipTracking?: boolean;
  onSessionChange?: (state: SessionState) => void;
  endSessionRef?: React.MutableRefObject<(() => Promise<{ ok: boolean; error?: string; session: SessionState }>) | null>;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
}

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

export function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function makeEvent(type: string, videoTime: number): SessionEvent {
  return { type, videoTime, wallTime: new Date().toISOString() };
}

export default function VideoPlayer({ recordingId, videoUrl, title, skipTracking, onSessionChange, endSessionRef, userId, userName, userEmail, userAvatar }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Watermark: random position + cycle one field at a time
  const [wmPos, setWmPos] = useState({ top: 12, left: 8 });
  const wmFields = [userId, userName, userEmail].filter(Boolean) as string[];
  const [wmIndex, setWmIndex] = useState(0);
  const [wmVisible, setWmVisible] = useState(true);
  useEffect(() => {
    if (wmFields.length === 0) return;
    const cycle = () => {
      // Fade out, then pick random next field + position, fade in
      setWmVisible(false);
      setTimeout(() => {
        setWmIndex(Math.floor(Math.random() * wmFields.length));
        setWmPos({ top: 8 + Math.random() * 72, left: 4 + Math.random() * 58 });
        setWmVisible(true);
      }, 600);
    };
    const t = setInterval(cycle, 4000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wmFields.length]);

  const sessionIdRef = useRef<string | null>(null);
  const totalWatchedRef = useRef(0);
  const isPlayingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventsRef = useRef<SessionEvent[]>([]);
  const pendingEventsRef = useRef<SessionEvent[]>([]);

  const [watchedDisplay, setWatchedDisplay] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'watching' | 'paused' | 'ended'>('idle');
  const IDLE_TIMEOUT = 10_000;

  const pushEvent = useCallback((type: string, videoTime: number) => {
    const evt = makeEvent(type, videoTime);
    eventsRef.current.push(evt);
    pendingEventsRef.current.push(evt);
  }, []);

  const notifyParent = useCallback(() => {
    onSessionChange?.({
      sessionId: sessionIdRef.current,
      status: sessionStatus,
      watchedSec: totalWatchedRef.current,
      events: eventsRef.current,
    });
  }, [onSessionChange, sessionStatus]);

  useEffect(() => { notifyParent(); }, [sessionStatus, notifyParent]);

  useEffect(() => { if (!skipTracking) pushEvent('page_open', 0); }, [pushEvent, skipTracking]);

  // ─── Session helpers ─────────────────────────────────────

  const startSession = useCallback(async (videoPos: number) => {
    if (skipTracking) { setSessionStatus('watching'); return; }
    try {
      pushEvent('session_start', videoPos);
      const res = await api.post('/attendance/session/start', {
        recordingId,
        videoPosition: videoPos,
        events: pendingEventsRef.current,
      });
      sessionIdRef.current = res.data.id;
      pendingEventsRef.current = [];
      setSessionStatus('watching');
    } catch { /* silent */ }
  }, [recordingId, pushEvent, skipTracking]);

  const endSessionAsync = useCallback(async (videoPos: number): Promise<{ ok: boolean; error?: string }> => {
    if (skipTracking || !sessionIdRef.current) return { ok: true };
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    setSessionStatus('ended');
    pushEvent('session_end', videoPos);
    try {
      await api.post('/attendance/session/end', {
        sessionId: sid,
        videoPosition: videoPos,
        watchedSec: Math.round(totalWatchedRef.current),
        events: pendingEventsRef.current,
      });
      pendingEventsRef.current = [];
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.response?.data?.message || err.message || 'Failed to save session' };
    }
  }, [pushEvent]);

  const endSessionBeacon = useCallback(() => {
    if (skipTracking || !sessionIdRef.current) return;
    const video = videoRef.current;
    const videoPos = video ? video.currentTime : 0;
    pushEvent('tab_close', videoPos);
    const body = JSON.stringify({
      sessionId: sessionIdRef.current,
      videoPosition: videoPos,
      watchedSec: Math.round(totalWatchedRef.current),
      events: pendingEventsRef.current,
    });
    navigator.sendBeacon(
      '/api/attendance/session/end-beacon',
      new Blob([body], { type: 'application/json' }),
    );
    sessionIdRef.current = null;
  }, [pushEvent]);

  // ─── Expose endSession to parent (back button) ─────────

  useEffect(() => {
    if (endSessionRef) {
      endSessionRef.current = async () => {
        const video = videoRef.current;
        const pos = video ? video.currentTime : 0;
        if (tickIntervalRef.current) { clearInterval(tickIntervalRef.current); tickIntervalRef.current = null; }
        if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
        const result = await endSessionAsync(pos);
        return {
          ...result,
          session: { sessionId: null, status: 'ended' as const, watchedSec: totalWatchedRef.current, events: [...eventsRef.current] },
        };
      };
    }
  }, [endSessionRef, endSessionAsync]);

  // ─── Idle timer ─────────────────────────────────────────

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
  }, []);

  const startIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      const video = videoRef.current;
      endSessionAsync(video ? video.currentTime : 0);
    }, IDLE_TIMEOUT);
  }, [clearIdleTimer, endSessionAsync]);

  // ─── Tick interval ──────────────────────────────────────

  const youtubeId = getYouTubeId(videoUrl);

  useEffect(() => {
    if (youtubeId) return;
    const video = videoRef.current;
    if (!video) return;

    const onPlay = async () => {
      isPlayingRef.current = true;
      clearIdleTimer();
      pushEvent('play', video.currentTime);
      setSessionStatus('watching');
      if (!sessionIdRef.current) await startSession(video.currentTime);
      if (!tickIntervalRef.current) {
        tickIntervalRef.current = setInterval(() => {
          if (!isPlayingRef.current) return;
          totalWatchedRef.current += 1;
          setWatchedDisplay(totalWatchedRef.current);
        }, 1000);
      }
    };

    const onPause = () => {
      isPlayingRef.current = false;
      pushEvent('pause', video.currentTime);
      setSessionStatus('paused');
      startIdleTimer();
    };

    const onEnded = () => {
      isPlayingRef.current = false;
      pushEvent('video_ended', video.duration || video.currentTime);
      endSessionAsync(video.duration || video.currentTime);
      if (tickIntervalRef.current) { clearInterval(tickIntervalRef.current); tickIntervalRef.current = null; }
    };

    const onSeeked = () => {
      pushEvent('seek', video.currentTime);
      if (!isPlayingRef.current && sessionIdRef.current) { clearIdleTimer(); startIdleTimer(); }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('seeked', onSeeked);

    return () => {
      if (tickIntervalRef.current) { clearInterval(tickIntervalRef.current); tickIntervalRef.current = null; }
      clearIdleTimer();
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [youtubeId, startSession, endSessionAsync, clearIdleTimer, startIdleTimer, pushEvent]);

  // ─── Tab close ──────────────────────────────────────────

  useEffect(() => {
    const h = () => endSessionBeacon();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [endSessionBeacon]);

  // ─── YouTube session tracker ────────────────────────────

  useEffect(() => {
    if (!youtubeId) return;
    let mounted = true;
    let ytPlayer: any = null;
    let playInterval: ReturnType<typeof setInterval> | null = null;
    let ytIsPlaying = false;

    const initPlayer = () => {
      if (!mounted) return;
      ytPlayer = new window.YT.Player(`yt-player-${recordingId}`, {
        videoId: youtubeId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            if (!mounted) return;
            if (!skipTracking) {
              pushEvent('youtube_session_start', 0);
              api.post('/attendance/session/start', { recordingId, videoPosition: 0, events: pendingEventsRef.current })
                .then(r => { if (mounted) { sessionIdRef.current = r.data.id; pendingEventsRef.current = []; setSessionStatus('watching'); } })
                .catch(() => {});
            } else {
              setSessionStatus('watching');
            }
          },
          onStateChange: (event: any) => {
            if (!mounted) return;
            if (event.data === 1) { // PLAYING
              ytIsPlaying = true;
              isPlayingRef.current = true;
              setSessionStatus('watching');
              if (!playInterval) {
                playInterval = setInterval(() => {
                  if (!ytIsPlaying) return;
                  totalWatchedRef.current += 1;
                  setWatchedDisplay(totalWatchedRef.current);
                }, 1000);
              }
            } else if (event.data === 2) { // PAUSED
              ytIsPlaying = false;
              isPlayingRef.current = false;
              setSessionStatus('paused');
            } else if (event.data === 0) { // ENDED
              ytIsPlaying = false;
              isPlayingRef.current = false;
              setSessionStatus('ended');
              if (playInterval) { clearInterval(playInterval); playInterval = null; }
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevReady) prevReady();
        initPlayer();
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }

    return () => {
      mounted = false;
      ytIsPlaying = false;
      if (playInterval) { clearInterval(playInterval); playInterval = null; }
      if (!skipTracking && ytPlayer && sessionIdRef.current) {
        const pos = ytPlayer.getCurrentTime?.() || 0;
        pushEvent('youtube_session_end', pos);
        navigator.sendBeacon(
          '/api/attendance/session/end-beacon',
          new Blob([JSON.stringify({
            sessionId: sessionIdRef.current,
            videoPosition: pos,
            watchedSec: Math.round(totalWatchedRef.current),
            events: pendingEventsRef.current,
          })], { type: 'application/json' }),
        );
      }
      if (ytPlayer?.destroy) { try { ytPlayer.destroy(); } catch { /* ignore */ } }
    };
  }, [youtubeId, recordingId, pushEvent, skipTracking]);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-black flex-1 min-h-0 flex items-center justify-center relative">
        {youtubeId ? (
          <div className="relative w-full h-full">
            <div id={`yt-player-${recordingId}`} className="absolute inset-0 w-full h-full" aria-label={title} />
            {/* Watermark overlay — one field at a time */}
            {wmFields.length > 0 && (
              <div
                className="absolute pointer-events-none select-none z-10"
                style={{
                  top: `${wmPos.top}%`,
                  left: `${wmPos.left}%`,
                  opacity: wmVisible ? 0.55 : 0,
                  transition: 'opacity 0.6s ease-in-out',
                }}
              >
                <span className="text-white font-mono font-semibold drop-shadow-lg" style={{ fontSize: '15px', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                  {wmFields[wmIndex]}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <video ref={videoRef} src={videoUrl} title={title} controls className="w-full h-full max-h-full" controlsList="nodownload" />
            {/* Watermark overlay — one field at a time */}
            {wmFields.length > 0 && (
              <div
                className="absolute pointer-events-none select-none z-10"
                style={{
                  top: `${wmPos.top}%`,
                  left: `${wmPos.left}%`,
                  opacity: wmVisible ? 0.55 : 0,
                  transition: 'opacity 0.6s ease-in-out',
                }}
              >
                <span className="text-white font-mono font-semibold drop-shadow-lg" style={{ fontSize: '15px', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                  {wmFields[wmIndex]}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Fixed user badge — bottom-left of video */}
        {(userAvatar || userName) && (
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full pointer-events-none select-none"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            {userAvatar ? (
              <img src={userAvatar} alt={userName} className="w-7 h-7 rounded-full object-cover ring-2 ring-white/20 flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0" style={{ fontSize: '12px' }}>
                {userName?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            {userName && (
              <span className="text-white font-medium truncate max-w-[140px]" style={{ fontSize: '12px' }}>{userName}</span>
            )}
          </div>
        )}
      </div>

      {/* Session status bar */}
      <div className="bg-slate-900 px-4 py-2 flex items-center justify-between text-xs flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`inline-flex w-2 h-2 rounded-full flex-shrink-0 ${
            sessionStatus === 'watching' ? 'bg-green-500 animate-pulse' :
            sessionStatus === 'paused' ? 'bg-yellow-500' :
            sessionStatus === 'ended' ? 'bg-slate-500' : 'bg-slate-600'
          }`} />
          <span className="text-slate-400">
            {sessionStatus === 'watching' && 'Recording session...'}
            {sessionStatus === 'paused' && 'Paused'}
            {sessionStatus === 'ended' && 'Session ended'}
            {sessionStatus === 'idle' && 'Press play to start'}
          </span>
        </div>
        <span className="text-slate-500 font-mono">{fmtTime(watchedDisplay)}</span>
      </div>
    </div>
  );
}