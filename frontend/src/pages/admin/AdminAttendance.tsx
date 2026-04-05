import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import StickyDataTable, { type StickyColumn } from '../../components/StickyDataTable';
import StudentWatchDetailModal from '../../components/StudentWatchDetailModal';

/* ─── Formatters ──────────────────────────────────────── */

function fmtTime(sec: number): string {
  if (sec == null || sec < 0) return '-';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDateTime(d: string) {
  if (!d) return '-';
  const dt = new Date(d);
  return `${dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

/* ─── Main Component ──────────────────────────────────── */

export default function AdminAttendance() {
  /* ── Selectors ─── */
  const [classes, setClasses] = useState<any[]>([]); 
  const [recordings, setRecordings] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedMonthId, setSelectedMonthId] = useState('');
  const [selectedRecordingId, setSelectedRecordingId] = useState('');

  /* ── Stats data from backend ─── */
  const [statsData, setStatsData] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  /* ── UI state ─── */
  const [studentPopup, setStudentPopup] = useState<{ recordingId: string; userId: string } | null>(null);
  const [search, setSearch] = useState('');

  /* ── Manual mark ─── */
  const [showForm, setShowForm] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [form, setForm] = useState({ studentId: '', recordingId: '', date: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  /* ─── Load classes on mount ───── */
  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data)).catch(() => {});
  }, []);

  /* ─── Load recordings when class selected ───── */
  useEffect(() => {
    if (!selectedClassId) { setRecordings([]); return; }
    api.get(`/classes/${selectedClassId}/recordings`).then(r => setRecordings(r.data || [])).catch(() => {});
  }, [selectedClassId]);

  /* ─── Load stats when recording selected ───── */
  useEffect(() => {
    if (!selectedRecordingId) { setStatsData(null); return; }
    setLoadingStats(true);
    setStudentPopup(null);
    setSearch('');
    api.get(`/attendance/recording/${selectedRecordingId}/stats`)
      .then(r => setStatsData(r.data))
      .catch(() => setStatsData(null))
      .finally(() => setLoadingStats(false));
  }, [selectedRecordingId]);

  /* ─── Derived: months from recordings ───── */
  const monthsForClass = useMemo(() => {
    if (!selectedClassId) return [];
    const monthMap = new Map<string, any>();
    for (const rec of recordings) {
      const m = rec.month;
      if (!m) continue;
      const mid = m.id || rec.monthId;
      if (!mid) continue;
      if (!monthMap.has(mid)) {
        monthMap.set(mid, { id: mid, name: m.name, year: m.year, month: m.month, status: m.status, recordingCount: 0 });
      }
      monthMap.get(mid)!.recordingCount++;
    }
    return Array.from(monthMap.values()).sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  }, [recordings, selectedClassId]);

  const recordingsForMonth = useMemo(() => {
    if (!selectedMonthId) return [];
    return recordings.filter((r: any) => r.monthId === selectedMonthId || r.month?.id === selectedMonthId);
  }, [recordings, selectedMonthId]);

  /* ─── Filtered students ───── */
  const filteredStudents = useMemo(() => {
    if (!statsData?.students) return [];
    if (!search.trim()) return statsData.students;
    const q = search.toLowerCase();
    return statsData.students.filter((s: any) =>
      s.user?.profile?.fullName?.toLowerCase().includes(q) ||
      s.user?.profile?.instituteId?.toLowerCase().includes(q) ||
      s.user?.email?.toLowerCase().includes(q)
    );
  }, [statsData, search]);

  /* ─── Recording optgroup for manual mark ───── */
  const recordingsByClassMonth = useMemo(() => {
    const groups: { label: string; recordings: any[] }[] = [];
    const groupMap = new Map<string, any[]>();
    for (const rec of recordings) {
      const className = rec.month?.class?.name || 'Unknown';
      const monthName = rec.month?.name || 'Unknown';
      const key = `${className} — ${monthName}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
        groups.push({ label: key, recordings: groupMap.get(key)! });
      }
      groupMap.get(key)!.push(rec);
    }
    return groups;
  }, [recordings]);

  /* ─── Helpers ───── */
  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const openManualForm = (prefill?: Partial<typeof form>) => {
    setShowForm(true);
    setError('');
    setSuccess('');
    if (prefill) setForm(p => ({ ...p, ...prefill }));
    if (allStudents.length === 0) {
      api.get('/users/students', { params: { limit: 200 } }).then(r => {
        const res = r.data;
        setAllStudents(res?.data ? res.data : Array.isArray(res) ? res : []);
      }).catch(() => {});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      await api.post('/attendance/manual', {
        userId: form.studentId,
        recordingId: form.recordingId || undefined,
        eventName: `Manual - ${form.date}`,
      });
      setSuccess('Attendance recorded');
      if (form.recordingId && form.recordingId === selectedRecordingId) {
        const r = await api.get(`/attendance/recording/${selectedRecordingId}/stats`);
        setStatsData(r.data);
      }
      setShowForm(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save attendance');
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (s: string | null) => {
    if (!s) return 'bg-slate-100 text-slate-400';
    const map: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-700',
      INCOMPLETE: 'bg-red-100 text-red-700',
      MANUAL: 'bg-amber-100 text-amber-700',
    };
    return map[s] || 'bg-slate-100 text-slate-400';
  };

  const paymentBadge = (s: string) => {
    const map: Record<string, { bg: string; label: string }> = {
      FREE: { bg: 'bg-sky-100 text-sky-700', label: 'Free' },
      VERIFIED: { bg: 'bg-green-100 text-green-700', label: 'Paid' },
      PENDING: { bg: 'bg-amber-100 text-amber-700', label: 'Pending' },
      REJECTED: { bg: 'bg-red-100 text-red-700', label: 'Rejected' },
      NOT_PAID: { bg: 'bg-red-50 text-red-500 border border-red-200', label: 'Not Paid' },
    };
    return map[s] || map.NOT_PAID;
  };

  /* ─── Table Columns ───── */
  const columns: readonly StickyColumn<any>[] = [
    {
      id: 'student', label: 'Student', minWidth: 200,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          {row.user?.profile?.avatarUrl ? (
            <img src={row.user.profile.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-[11px]">{(row.user?.profile?.fullName || row.user?.email || '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}</span>
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-800 text-sm">{row.user?.profile?.fullName || 'Unknown'}</p>
            <p className="text-xs text-slate-400">{row.user?.profile?.instituteId || row.user?.email || '—'}</p>
            {!row.enrolled && <span className="text-[9px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">Not Enrolled</span>}
          </div>
        </div>
      ),
    },
    {
      id: 'payment', label: 'Payment', minWidth: 90,
      render: (row) => {
        const p = paymentBadge(row.paymentStatus);
        return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${p.bg}`}>{p.label}</span>;
      },
    },
    {
      id: 'status', label: 'Status', minWidth: 110,
      render: (row) => row.attendanceStatus ? (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(row.attendanceStatus)}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />{row.attendanceStatus}
        </span>
      ) : (
        <span className="text-xs text-slate-300 italic">Not viewed</span>
      ),
    },
    {
      id: 'sessions', label: 'Sessions', minWidth: 80,
      render: (row) => (
        <span className={`text-sm font-bold ${row.sessionCount > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
          {row.sessionCount}
        </span>
      ),
    },
    {
      id: 'totalWatch', label: 'Total Watch', minWidth: 110,
      render: (row) => {
        const dur = statsData?.recording?.duration;
        const pct = dur && row.totalWatchedSec > 0 ? Math.min(100, Math.round((row.totalWatchedSec / dur) * 100)) : null;
        return (
          <div>
            <span className="font-medium text-slate-700 text-sm">{fmtTime(row.totalWatchedSec)}</span>
            {pct !== null && (
              <div className="mt-1 flex items-center gap-1.5">
                <div className="h-1.5 flex-1 max-w-[60px] bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-slate-400">{pct}%</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'lastWatched', label: 'Last Watched', minWidth: 130,
      render: (row) => row.lastWatchedAt
        ? <span className="text-xs text-slate-500">{fmtDateTime(row.lastWatchedAt)}</span>
        : <span className="text-xs text-slate-300">—</span>,
    },
    {
      id: 'actions', label: '', minWidth: 80, align: 'right' as const,
      render: (row) => (
        <div className="flex items-center gap-1">
          {!row.attendanceStatus && row.sessionCount === 0 && (
            <button
              onClick={() => openManualForm({ studentId: row.userId, recordingId: selectedRecordingId })}
              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-600 hover:bg-purple-100 transition"
              title="Mark manually"
            >Mark</button>
          )}
          {(row.sessionCount > 0 || row.attendanceStatus) && (
            <button
              onClick={() => setStudentPopup({ recordingId: selectedRecordingId, userId: row.userId })}
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition bg-slate-50 text-slate-500 hover:bg-slate-100`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              Detail
            </button>
          )}
        </div>
      ),
    },
  ];

  /* ─── RENDER ───── */
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Recording Attendance</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {statsData
              ? `${statsData.students?.length || 0} students · ${statsData.totals?.completed || 0} completed`
              : 'Select a class, month, and recording'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => openManualForm({ studentId: '', recordingId: selectedRecordingId || '' })}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Mark Attendance
          </button>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <span className="text-sm font-medium text-emerald-700">{success}</span>
        </div>
      )}

      {/* ═══ MANUAL MARK MODAL ═══ */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Mark Attendance</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Manually record attendance for a student</p>
                </div>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[80vh]">
                <div className="p-6 space-y-5">
                  {error && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Attendance Record</p>
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-1.5">Student</label>
                      <select value={form.studentId} onChange={e => update('studentId', e.target.value)} required
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                        <option value="">Select student</option>
                        {allStudents.map((s: any) => <option key={s.id} value={s.id}>{s.profile?.fullName || s.email}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-1.5">Recording <span className="text-slate-400 font-normal">(optional)</span></label>
                      <select value={form.recordingId} onChange={e => update('recordingId', e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                        <option value="">— No specific recording —</option>
                        {recordingsByClassMonth.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.recordings.map((r: any) => (
                              <option key={r.id} value={r.id}>{r.title}{r.isLive ? ' [LIVE]' : ''}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-1.5">Date</label>
                      <input type="date" value={form.date} onChange={e => update('date', e.target.value)} required
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 pb-2">
                    <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                    <button type="submit" disabled={loading} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                      {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ═══ STEP 1: CLASS ═══ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 block">1. Select Class</label>
        <div className="flex flex-wrap gap-2">
          {classes.map((c: any) => (
            <button key={c.id}
              onClick={() => { setSelectedClassId(c.id); setSelectedMonthId(''); setSelectedRecordingId(''); setStatsData(null); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                selectedClassId === c.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/25'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >{c.name}</button>
          ))}
          {classes.length === 0 && <p className="text-xs text-slate-400 italic py-2">No classes available</p>}
        </div>
      </div>

      {/* ═══ STEP 2: MONTH ═══ */}
      {selectedClassId && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 block">2. Select Month</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {monthsForClass.map((m: any) => (
              <button key={m.id}
                onClick={() => { setSelectedMonthId(m.id); setSelectedRecordingId(''); setStatsData(null); }}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition border whitespace-nowrap ${
                  selectedMonthId === m.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/25'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {m.name}
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  selectedMonthId === m.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                }`}>{m.recordingCount}</span>
              </button>
            ))}
            {monthsForClass.length === 0 && <p className="text-xs text-slate-400 italic py-2">No months with recordings found</p>}
          </div>
        </div>
      )}

      {/* ═══ STEP 3: RECORDING ═══ */}
      {selectedMonthId && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 block">3. Select Recording</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {recordingsForMonth.map((rec: any) => {
              const isSelected = selectedRecordingId === rec.id;
              return (
                <button key={rec.id}
                  onClick={() => setSelectedRecordingId(rec.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl text-left transition border ${
                    isSelected
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/30'
                      : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/50'
                  }`}
                >
                  <div className="w-14 h-10 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{rec.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {rec.isLive && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold">
                          <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />LIVE
                        </span>
                      )}
                      {rec.duration && (
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold">{fmtTime(rec.duration)}</span>
                      )}
                      {rec.videoType && (
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold">{rec.videoType}</span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  )}
                </button>
              );
            })}
            {recordingsForMonth.length === 0 && <p className="text-xs text-slate-400 italic py-2 col-span-full">No recordings in this month</p>}
          </div>
        </div>
      )}

      {/* ═══ EMPTY STATES ═══ */}
      {!selectedClassId && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.698 50.698 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>
          </div>
          <p className="text-sm font-medium text-slate-600">Select a class to get started</p>
          <p className="text-xs text-slate-400 mt-1">Then pick a month and recording to view student watch statistics</p>
        </div>
      )}

      {selectedClassId && !selectedMonthId && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
          <p className="text-sm font-medium text-slate-500">Select a month above to see recordings</p>
        </div>
      )}

      {selectedMonthId && !selectedRecordingId && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
          <p className="text-sm font-medium text-slate-500">Select a recording above to view student watch statistics</p>
        </div>
      )}

      {/* ═══ LOADING ═══ */}
      {loadingStats && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      )}

      {/* ═══ STATS + STUDENT TABLE ═══ */}
      {statsData && !loadingStats && (
        <>
          {/* Summary Stats Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-slate-800">{statsData.recording?.title}</p>
                  {statsData.recording?.isLive && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE</span>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {statsData.class?.name} · {statsData.month?.name}
                  {statsData.recording?.duration ? ` · Duration: ${fmtTime(statsData.recording.duration)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
                <div className="text-center min-w-[50px]">
                  <p className="text-xl font-bold text-slate-700">{statsData.totals?.enrolled || 0}</p>
                  <p className="text-[10px] text-slate-400 font-medium">ENROLLED</p>
                </div>
                <div className="text-center min-w-[50px]">
                  <p className="text-xl font-bold text-green-600">{statsData.totals?.completed || 0}</p>
                  <p className="text-[10px] text-slate-400 font-medium">COMPLETED</p>
                </div>
                <div className="text-center min-w-[50px]">
                  <p className="text-xl font-bold text-red-600">{statsData.totals?.incomplete || 0}</p>
                  <p className="text-[10px] text-slate-400 font-medium">INCOMPLETE</p>
                </div>
                <div className="text-center min-w-[50px]">
                  <p className="text-xl font-bold text-slate-400">{statsData.totals?.notViewed || 0}</p>
                  <p className="text-[10px] text-slate-400 font-medium">NOT VIEWED</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, ID, or email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <span className="text-xs text-slate-400">{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Student Table */}
          {filteredStudents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <p className="text-sm font-medium text-slate-500">{search ? 'No students match your search' : 'No students found'}</p>
            </div>
          ) : (
            <div className="space-y-0">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <StickyDataTable
                  columns={columns}
                  rows={filteredStudents}
                  getRowId={(row) => row.userId}
                  tableHeight="calc(100vh - 560px)"
                />
              </div>


      {/* Student Watch Detail Popup */}
      {studentPopup && (
        <StudentWatchDetailModal
          recordingId={studentPopup.recordingId}
          userId={studentPopup.userId}
          onClose={() => setStudentPopup(null)}
        />
      )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
