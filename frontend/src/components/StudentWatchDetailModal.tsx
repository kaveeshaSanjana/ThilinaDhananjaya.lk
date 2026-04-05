import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSec(sec: number): string {
  if (!sec || sec <= 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function fmtTimeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function calcActivePercent(session: any): number {
  const realSec = session.endedAt
    ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
    : 0;
  if (!realSec) return 0;
  return Math.min(100, Math.round((session.totalWatchedSec / realSec) * 100));
}

function calcRealDuration(session: any): number {
  if (!session.endedAt) return 0;
  return Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  recordingId: string;
  userId: string;
  onClose: () => void;
}

// ─── Modal component ──────────────────────────────────────────────────────────

export default function StudentWatchDetailModal({ recordingId, userId, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!recordingId || !userId) {
      setError('Missing recording or student ID');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setData(null);
    api.get(`/attendance/recording/${recordingId}/student/${userId}`)
      .then(r => setData(r.data))
      .catch((err: any) => {
        const msg = err?.response?.data?.message || err?.message || 'Failed to load student watch data';
        setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
      })
      .finally(() => setLoading(false));
  }, [recordingId, userId, retryCount]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const modal = (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm overflow-y-auto flex items-start justify-center py-6 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Student Watch Detail</h2>
            {data && (
              <p className="text-xs text-slate-400 mt-0.5">
                {data.student?.user?.profile?.fullName || data.student?.user?.email || 'Student'} · {data.recording?.title}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {!loading && (error || !data) && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-slate-700 font-semibold text-sm">Could not load data</p>
              <p className="text-slate-400 text-xs mt-1 max-w-xs">{error || 'No data found'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRetryCount(c => c + 1)} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition">Retry</button>
              <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition">Close</button>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && data && (() => {
          const { student, recording, month, class: cls } = data;
          const profileStatus = student.user?.profile?.status;

          const attColor =
            student.attendanceStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
            student.attendanceStatus === 'INCOMPLETE' ? 'bg-amber-100 text-amber-700 border-amber-200' :
            student.attendanceStatus === 'MANUAL' ? 'bg-blue-100 text-blue-700 border-blue-200' :
            'bg-slate-100 text-slate-500 border-slate-200';

          const profileColor =
            profileStatus === 'ACTIVE' ? 'bg-green-100 text-green-700 border-green-200' :
            profileStatus === 'INACTIVE' ? 'bg-red-100 text-red-600 border-red-200' :
            profileStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
            'bg-slate-100 text-slate-500 border-slate-200';

          const payColor =
            student.paymentStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
            student.paymentStatus === 'FREE' ? 'bg-blue-100 text-blue-600 border-blue-200' :
            student.paymentStatus === 'PENDING' ? 'bg-amber-100 text-amber-600 border-amber-200' :
            student.paymentStatus === 'REJECTED' ? 'bg-red-100 text-red-600 border-red-200' :
            'bg-slate-100 text-slate-500 border-slate-200';

          const payLabel =
            student.paymentStatus === 'VERIFIED' ? 'Paid' :
            student.paymentStatus === 'FREE' ? 'Free' :
            student.paymentStatus === 'PENDING' ? 'Pay Pending' :
            student.paymentStatus === 'REJECTED' ? 'Pay Rejected' : 'Not Paid';

          const sessions: any[] = student.sessions || [];
          const attDetails: any[] = Array.isArray(student.attendanceDetails) ? student.attendanceDetails : [];

          const allActivityEvents: any[] = [
            ...attDetails.map((e: any) => ({ ...e, _source: 'att' })),
            ...sessions.flatMap((session: any, si: number) =>
              (Array.isArray(session.events) ? session.events : [])
                .filter((e: any) => {
                  const t = (e.type || e.event || '').toUpperCase();
                  return !t.includes('HB') && !t.includes('HEARTBEAT') && t !== 'IDLE' && t !== 'FOCUS';
                })
                .map((e: any) => ({ ...e, _source: 'session', _sessionNum: si + 1 }))
            ),
          ].sort((a, b) => {
            const ta = new Date(a.at || a.wallTime || a.timestamp || 0).getTime();
            const tb = new Date(b.at || b.wallTime || b.timestamp || 0).getTime();
            return ta - tb;
          });

          return (
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Student header card */}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md">
                    {student.user?.profile?.avatarUrl ? (
                      <img src={student.user.profile.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-lg">
                        {(student.user?.profile?.fullName || student.user?.email || '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-800">
                        {student.user?.profile?.fullName || student.user?.email || 'Unknown'}
                      </h3>
                      {profileStatus && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${profileColor}`}>{profileStatus}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-500">
                      {student.user?.profile?.instituteId && (
                        <span className="font-mono font-semibold text-slate-700">{student.user.profile.instituteId}</span>
                      )}
                      {student.user?.profile?.phone && <span>{student.user.profile.phone}</span>}
                      {student.user?.email && <span className="text-slate-400">{student.user.email}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${attColor}`}>
                        {student.attendanceStatus || 'NOT VIEWED'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${payColor}`}>{payLabel}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                        student.enrolled ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>{student.enrolled ? 'Enrolled' : 'Not Enrolled'}</span>
                      {student.liveJoinedAt && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-purple-100 text-purple-700 border-purple-200">Live Joined</span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Recording info */}
                <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  <span className="font-semibold text-slate-700">{recording.title}</span>
                  <span>·</span><span>{cls?.name}</span>
                  <span>·</span><span>{month?.name}</span>
                  {recording.duration > 0 && <><span>·</span><span>Duration: {fmtSec(recording.duration)}</span></>}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Sessions', value: student.sessionCount, color: 'from-indigo-50 to-indigo-100 border-indigo-200' },
                  { label: 'Total Watch', value: fmtDuration(student.totalWatchedSec), color: 'from-blue-50 to-blue-100 border-blue-200' },
                  { label: 'Att. Watch', value: fmtDuration(student.attendanceWatchedSec), color: 'from-violet-50 to-violet-100 border-violet-200' },
                  {
                    label: 'Last Watch',
                    value: student.lastWatchedAt ? fmtDateShort(student.lastWatchedAt) : '—',
                    sub: student.lastWatchedAt ? fmtTimeOnly(student.lastWatchedAt) : '',
                    color: 'from-slate-50 to-slate-100 border-slate-200',
                  },
                ].map(stat => (
                  <div key={stat.label} className={`bg-gradient-to-br ${stat.color} border rounded-2xl p-3`}>
                    <p className="text-[10px] font-semibold text-slate-500 mb-1">{stat.label}</p>
                    <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                    {'sub' in stat && stat.sub && <p className="text-[11px] text-slate-400 mt-0.5">{stat.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Watch Sessions */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Watch Sessions ({sessions.length})</h3>
                  {recording.duration > 0 && (
                    <span className="text-xs text-slate-400">{fmtSec(recording.duration)} total</span>
                  )}
                </div>
                {sessions.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">No sessions recorded</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {[...sessions].reverse().map((session: any, si: number) => {
                      const events: any[] = (Array.isArray(session.events) ? session.events : []).filter((e: any) => {
                        const t = (e.type || e.event || '').toUpperCase();
                        return !t.includes('HEARTBEAT') && !t.includes('HB');
                      });
                      const realDur = calcRealDuration(session);
                      const activePct = calcActivePercent(session);
                      const startDt = fmtDateTime(session.startedAt);
                      const endDt = session.endedAt ? fmtDateTime(session.endedAt) : null;

                      return (
                        <div key={session.id} className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {sessions.length - si}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-800 text-sm">Session {sessions.length - si}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    session.status === 'ENDED' ? 'bg-slate-200 text-slate-600' :
                                    session.status === 'WATCHING' ? 'bg-green-100 text-green-600' :
                                    'bg-amber-100 text-amber-600'
                                  }`}>{session.status}</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Started {startDt.time}{endDt && ` → Ended ${endDt.time}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-3 text-right">
                              <div>
                                <p className="text-sm font-bold text-indigo-600">{fmtDuration(session.totalWatchedSec)}</p>
                                <p className="text-[10px] text-slate-400">watched</p>
                              </div>
                              {activePct > 0 && (
                                <div>
                                  <p className="text-sm font-bold text-slate-700">{activePct}%</p>
                                  <p className="text-[10px] text-slate-400">active</p>
                                </div>
                              )}
                              {realDur > 0 && (
                                <div>
                                  <p className="text-sm font-bold text-slate-700">{fmtDuration(realDur)}</p>
                                  <p className="text-[10px] text-slate-400">real time</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {recording.duration > 0 && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                                <span>Video: {fmtSec(session.videoStartPos)} → {fmtSec(session.videoEndPos)}</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full"
                                  style={{
                                    marginLeft: `${(session.videoStartPos / recording.duration) * 100}%`,
                                    width: `${Math.max(1, ((session.videoEndPos - session.videoStartPos) / recording.duration) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {events.length > 0 ? (
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Events ({events.length})</p>
                              <div className="relative pl-5 space-y-2">
                                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
                                {events.map((evt: any, ei: number) => {
                                  const evtType = (evt.type || evt.event || '').toUpperCase();
                                  const isPlay = evtType.includes('PLAY') || evtType.includes('START') || evtType.includes('RESUME');
                                  const isPause = evtType.includes('PAUSE');
                                  const isEnd = evtType.includes('END') || evtType.includes('LEAVE') || evtType.includes('LEFT') || evtType.includes('CLOSE');
                                  const isSeek = evtType.includes('SEEK');
                                  const isJoin = evtType.includes('JOIN');
                                  const dotColor = isPlay ? 'bg-green-400' : isPause ? 'bg-amber-400' : isEnd ? 'bg-red-400' : isSeek ? 'bg-blue-400' : isJoin ? 'bg-purple-400' : 'bg-slate-300';
                                  const labelColor = isPlay ? 'text-green-700' : isPause ? 'text-amber-600' : isEnd ? 'text-red-600' : isSeek ? 'text-blue-600' : isJoin ? 'text-purple-600' : 'text-slate-600';
                                  const icon = isPlay ? '▶' : isPause ? '⏸' : isEnd ? '⏹' : isSeek ? '⤳' : isJoin ? '⚡' : '•';
                                  const description = isPlay ? 'Started watching' : isPause ? 'Paused video' : isEnd ? 'Left / Ended' : isSeek ? 'Seeked' : isJoin ? 'Joined live' : evtType;
                                  const wallTime = evt.wallTime || evt.at || evt.timestamp;

                                  return (
                                    <div key={ei} className="flex items-center gap-3 relative">
                                      <div className={`w-3 h-3 rounded-full border-2 border-white ${dotColor} flex-shrink-0 z-10 -ml-[7px]`} />
                                      <span className="text-sm leading-none flex-shrink-0">{icon}</span>
                                      <span className={`text-xs font-semibold ${labelColor} flex-shrink-0`}>{description}</span>
                                      {evt.videoTime != null && (
                                        <span className="text-[11px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">@ {fmtSec(evt.videoTime)}</span>
                                      )}
                                      {wallTime && (
                                        <span className="text-[11px] text-slate-400 ml-auto flex-shrink-0">{fmtTimeOnly(wallTime)}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No event details recorded</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Activity Timeline */}
              {allActivityEvents.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">Activity Timeline ({allActivityEvents.length})</h3>
                    <p className="text-xs text-slate-400 mt-0.5">All attendance state changes and player events in chronological order</p>
                  </div>
                  <div className="p-5">
                    <div className="relative pl-5 space-y-3">
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
                      {allActivityEvents.map((evt: any, i: number) => {
                        const raw = (evt.type || evt.event || '').toUpperCase();
                        const isFromAtt = evt._source === 'att';
                        const isPush       = raw === 'PUSH';
                        const isIncomplete = raw === 'INCOMPLETE_EXIT';
                        const isManual     = raw === 'MANUAL';
                        const isLiveJoin   = raw === 'LIVE_JOIN';
                        const isAttStart   = raw === 'START';
                        const isAttEnd     = raw === 'END';
                        const isPlay       = raw === 'PLAY' || raw === 'VIDEO_PLAY';
                        const isPause      = raw === 'PAUSE' || raw === 'VIDEO_PAUSE';
                        const isResume     = raw === 'RESUME' || raw === 'VIDEO_RESUME';
                        const isSeek       = raw.includes('SEEK');
                        const isVideoEnd   = raw === 'VIDEO_ENDED' || raw === 'VIDEO_END' || raw === 'ENDED';
                        const isLeave      = raw.includes('LEAVE') || raw.includes('LEFT') || raw.includes('CLOSE');
                        const isSessionEnd = raw === 'SESSION_END' || raw === 'END_SESSION';

                        const dotColor =
                          isPush       ? 'bg-emerald-400' :
                          isIncomplete ? 'bg-amber-400'   :
                          isManual     ? 'bg-blue-400'     :
                          isLiveJoin   ? 'bg-purple-400'   :
                          isAttStart || isPlay ? 'bg-green-400' :
                          isResume     ? 'bg-teal-400'     :
                          isPause      ? 'bg-amber-400'    :
                          isSeek       ? 'bg-blue-400'     :
                          isVideoEnd   ? 'bg-slate-400'    :
                          isLeave || isSessionEnd || isAttEnd ? 'bg-red-400' :
                          'bg-slate-300';

                        const icon =
                          isPush ? '✅' : isIncomplete ? '⚠️' : isManual ? '✏️' : isLiveJoin ? '⚡' :
                          isAttStart || isPlay || isResume ? '▶' :
                          isPause ? '⏸' : isSeek ? '⤳' :
                          isVideoEnd || isLeave || isSessionEnd || isAttEnd ? '⏹' : '•';

                        const label =
                          isPush ? 'Marked Present' : isIncomplete ? 'Left Early (Incomplete)' :
                          isManual ? 'Manually Marked' : isLiveJoin ? 'Joined Live' :
                          isAttStart ? 'Started Watching' : isPlay ? 'Started Watching' :
                          isResume ? 'Resumed Video' : isPause ? 'Paused Video' :
                          isSeek ? 'Seeked' : isVideoEnd ? 'Video Ended' :
                          isLeave ? 'Left / Closed' : isSessionEnd || isAttEnd ? 'Session Ended' : raw;

                        const wallTime = evt.at || evt.wallTime || evt.timestamp;
                        const videoTime = evt.videoTime ?? evt.videoPosition ?? null;

                        return (
                          <div key={i} className="flex items-start gap-3 relative">
                            <div className={`w-3.5 h-3.5 rounded-full border-2 border-white ${dotColor} flex-shrink-0 z-10 -ml-[7px] mt-0.5`} />
                            <span className="text-base leading-none flex-shrink-0 mt-px">{icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-slate-700">{label}</p>
                                {evt._sessionNum != null && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-500 border border-indigo-100">S{evt._sessionNum}</span>
                                )}
                                {isFromAtt && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-200">att</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-slate-400">
                                {evt.watchedSec != null && <span>watched: {fmtDuration(evt.watchedSec)}</span>}
                                {videoTime != null && <span>@ {fmtSec(videoTime)}</span>}
                                {wallTime && <span>{new Date(wallTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {fmtTimeOnly(wallTime)}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
