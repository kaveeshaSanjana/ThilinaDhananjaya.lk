import { useEffect, useState } from 'react';
import api from '../../lib/api';

function fmtTime(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AdminAttendance() {
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [form, setForm] = useState({ classId: '', studentId: '', date: new Date().toISOString().split('T')[0], status: 'MANUAL' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'sessions' | 'attendance'>('sessions');
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/classes').then(r => setClasses(r.data)).catch(() => {}),
      api.get('/users/students').then(r => setStudents(r.data || [])).catch(() => {}),
      api.get('/attendance/watch-sessions').then(r => setSessions(r.data || [])).catch(() => {}),
      api.get('/attendance').then(r => setRecords(r.data || [])).catch(() => {}),
    ]).finally(() => setFetching(false));
  }, []);

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      await api.post('/attendance/manual', { userId: form.studentId, eventName: `Manual - ${form.date}` });
      setSuccess('Attendance recorded');
      const r = await api.get('/attendance');
      setRecords(r.data || []);
      setShowForm(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.response?.data?.message || 'Failed to save attendance'); }
    finally { setLoading(false); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      INCOMPLETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      MANUAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    };
    return map[s] || '';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Attendance</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{sessions.length} watch sessions · {records.length} attendance records</p>
        </div>
        <button onClick={() => { setShowForm(true); setError(''); setSuccess(''); }}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Mark Attendance
        </button>
      </div>

      {success && <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2">{success}</div>}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Mark Attendance</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Class</label>
                <select value={form.classId} onChange={e => update('classId', e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">Select class</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Student</label>
                <select value={form.studentId} onChange={e => update('studentId', e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">Select student</option>
                  {students.map((s: any) => <option key={s.id} value={s.id}>{s.profile?.fullName || s.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => update('date', e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('sessions')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${tab === 'sessions' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
          Watch Sessions
        </button>
        <button onClick={() => setTab('attendance')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${tab === 'attendance' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
          Legacy Attendance
        </button>
      </div>

      {/* Watch Sessions Table */}
      {tab === 'sessions' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {fetching ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No watch sessions yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Student</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Recording</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Watched</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {sessions.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{s.user?.profile?.fullName || '—'}</p>
                        <p className="text-xs text-slate-400">{s.user?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-600 dark:text-slate-300">{s.recording?.title || '—'}</p>
                        <p className="text-xs text-slate-400">{s.recording?.month?.class?.name} › {s.recording?.month?.name}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">
                        {s.startedAt ? new Date(s.startedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        <br />
                        <span className="text-slate-300 dark:text-slate-600">
                          {s.startedAt ? new Date(s.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                          {s.endedAt ? ` – ${new Date(s.endedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{fmtTime(s.totalWatchedSec)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          s.status === 'ENDED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          s.status === 'WATCHING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Legacy Attendance Table */}
      {tab === 'attendance' && (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {fetching ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No attendance records yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Event / Class</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {records.slice(0, 100).map((rec: any) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{rec.user?.profile?.fullName || '—'}</p>
                      <p className="text-xs text-slate-400">{rec.user?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{rec.recording?.month?.class?.name || rec.eventName || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge(rec.status)}`}>{rec.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
