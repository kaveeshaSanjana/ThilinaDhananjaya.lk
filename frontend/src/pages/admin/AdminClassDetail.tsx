import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../lib/api';

const VISIBILITY_OPTIONS = ['ANYONE', 'STUDENTS_ONLY', 'PAID_ONLY', 'PRIVATE', 'INACTIVE'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    ANYONE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    STUDENTS_ONLY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PAID_ONLY: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    PRIVATE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    INACTIVE: 'bg-slate-100 text-slate-500 dark:bg-slate-700/30 dark:text-slate-400',
  };
  return map[s] || map.ANYONE;
};

type Tab = 'months' | 'recordings' | 'students' | 'attendance';

const emptyMonthForm = { name: '', year: new Date().getFullYear().toString(), month: (new Date().getMonth() + 1).toString(), status: 'ANYONE' };
const emptyRecForm = { monthId: '', title: '', description: '', videoUrl: '', thumbnail: '', topic: '', icon: '', materials: '', status: 'PAID_ONLY' };

export default function AdminClassDetail() {
  const { id } = useParams();
  const [cls, setCls] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('months');

  // Months
  const [months, setMonths] = useState<any[]>([]);
  const [showMonthForm, setShowMonthForm] = useState(false);
  const [editingMonth, setEditingMonth] = useState<any>(null);
  const [monthForm, setMonthForm] = useState({ ...emptyMonthForm });
  const [monthSaving, setMonthSaving] = useState(false);
  const [monthError, setMonthError] = useState('');

  // Recordings
  const [recordings, setRecordings] = useState<any[]>([]);
  const [showRecForm, setShowRecForm] = useState(false);
  const [editingRec, setEditingRec] = useState<any>(null);
  const [recForm, setRecForm] = useState({ ...emptyRecForm });
  const [recSaving, setRecSaving] = useState(false);
  const [recError, setRecError] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Students
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [enrollId, setEnrollId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  // Attendance
  const [attendance, setAttendance] = useState<any[]>([]);

  const loadClass = () => api.get(`/classes/${id}`).then(r => setCls(r.data)).catch(() => {});
  const loadMonths = () => api.get(`/classes/${id}/months`).then(r => setMonths(r.data)).catch(() => {});
  const loadRecordings = () => api.get(`/classes/${id}/recordings`).then(r => setRecordings(r.data)).catch(() => {});
  const loadEnrollments = () => api.get(`/enrollments/class/${id}`).then(r => setEnrollments(r.data || [])).catch(() => {});
  const loadStudents = () => api.get('/users/students').then(r => setAllStudents(r.data || [])).catch(() => {});
  const loadAttendance = () => api.get('/attendance').then(r => setAttendance(r.data || [])).catch(() => {});

  useEffect(() => {
    setLoading(true);
    Promise.all([loadClass(), loadMonths(), loadRecordings(), loadEnrollments(), loadStudents(), loadAttendance()])
      .finally(() => setLoading(false));
  }, [id]);

  // ─── Month handlers ─────────────────────
  const openNewMonth = () => { setMonthForm({ ...emptyMonthForm }); setEditingMonth(null); setShowMonthForm(true); setMonthError(''); };
  const openEditMonth = (m: any) => {
    setMonthForm({ name: m.name, year: String(m.year), month: String(m.month), status: m.status || 'ANYONE' });
    setEditingMonth(m); setShowMonthForm(true); setMonthError('');
  };
  const saveMonth = async (e: React.FormEvent) => {
    e.preventDefault(); setMonthError(''); setMonthSaving(true);
    try {
      const payload = { name: monthForm.name, year: Number(monthForm.year), month: Number(monthForm.month), status: monthForm.status };
      if (editingMonth) await api.patch(`/classes/months/${editingMonth.id}`, payload);
      else await api.post(`/classes/${id}/months`, payload);
      setShowMonthForm(false); loadMonths(); loadRecordings();
    } catch (err: any) { setMonthError(err.response?.data?.message || 'Failed'); }
    finally { setMonthSaving(false); }
  };
  const deleteMonth = async (mid: string) => {
    if (!confirm('Delete this month and all its recordings?')) return;
    await api.delete(`/classes/months/${mid}`).catch(() => {}); loadMonths(); loadRecordings();
  };

  // ─── Recording handlers ─────────────────
  const openNewRec = () => { setRecForm({ ...emptyRecForm }); setEditingRec(null); setShowRecForm(true); setRecError(''); };
  const openEditRec = (rec: any) => {
    setRecForm({
      monthId: rec.monthId || '', title: rec.title, description: rec.description || '',
      videoUrl: rec.videoUrl, thumbnail: rec.thumbnail || '', topic: rec.topic || '',
      icon: rec.icon || '', materials: rec.materials || '', status: rec.status || 'PAID_ONLY',
    });
    setEditingRec(rec); setShowRecForm(true); setRecError('');
  };
  const saveRec = async (e: React.FormEvent) => {
    e.preventDefault(); setRecError(''); setRecSaving(true);
    try {
      const payload: any = {
        title: recForm.title, videoUrl: recForm.videoUrl, status: recForm.status,
        description: recForm.description || undefined, thumbnail: recForm.thumbnail || undefined,
        topic: recForm.topic || undefined, icon: recForm.icon || undefined,
        materials: recForm.materials || undefined,
      };
      if (editingRec) {
        if (recForm.monthId !== editingRec.monthId) payload.monthId = recForm.monthId;
        await api.patch(`/recordings/${editingRec.id}`, payload);
      } else {
        payload.monthId = recForm.monthId;
        await api.post('/recordings', payload);
      }
      setShowRecForm(false); loadRecordings();
    } catch (err: any) { setRecError(err.response?.data?.message || 'Failed'); }
    finally { setRecSaving(false); }
  };
  const deleteRec = async (rid: string) => {
    if (!confirm('Delete this recording?')) return;
    await api.delete(`/recordings/${rid}`).catch(() => {}); loadRecordings();
  };

  // ─── Enrollment handlers ────────────────
  const handleEnroll = async () => {
    if (!enrollId) return; setEnrolling(true);
    try { await api.post('/enrollments', { userId: enrollId, classId: id }); setEnrollId(''); loadEnrollments(); }
    catch {} finally { setEnrolling(false); }
  };
  const handleUnenroll = async (userId: string) => {
    if (!confirm('Unenroll this student?')) return;
    await api.delete(`/enrollments/${userId}/${id}`).catch(() => {}); loadEnrollments();
  };

  const enrolledIds = new Set(enrollments.map((e: any) => e.userId));
  const availableStudents = allStudents.filter((s: any) => !enrolledIds.has(s.id));
  const filteredRecs = filterMonth ? recordings.filter((r: any) => r.monthId === filterMonth) : recordings;

  // Filter attendance by this class's recordings
  const recIds = new Set(recordings.map((r: any) => r.id));
  const classAttendance = attendance.filter((a: any) => recIds.has(a.recordingId));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  if (!cls) return (
    <div className="text-center py-16 text-slate-400 text-sm">
      Class not found. <Link to="/admin/classes" className="text-blue-600 hover:underline">Go back</Link>
    </div>
  );

  const inp = "w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30";
  const label = "block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1";

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <Link to="/admin/classes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to Classes
      </Link>

      {/* Class Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {cls.thumbnail && (
            <div className="sm:w-48 h-32 sm:h-auto flex-shrink-0">
              <img src={cls.thumbnail} alt={cls.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-5 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{cls.name}</h1>
                {cls.subject && <p className="text-sm text-slate-500 dark:text-slate-400">{cls.subject}</p>}
                {cls.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{cls.description}</p>}
              </div>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${statusBadge(cls.status || 'ANYONE')}`}>
                {(cls.status || 'ANYONE').replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
              {cls.monthlyFee != null && <span className="font-semibold text-blue-600 dark:text-blue-400">Rs. {Number(cls.monthlyFee).toLocaleString()} / month</span>}
              <span>{months.length} month{months.length !== 1 ? 's' : ''}</span>
              <span>{recordings.length} recording{recordings.length !== 1 ? 's' : ''}</span>
              <span>{enrollments.length} student{enrollments.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
        {([['months', 'Months'], ['recordings', 'Recordings'], ['students', 'Students'], ['attendance', 'Attendance']] as [Tab, string][]).map(([key, lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 px-4 py-2 rounded-md text-xs font-semibold transition ${tab === key ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
            {lbl}
            {key === 'months' && <span className="ml-1.5 text-slate-400">({months.length})</span>}
            {key === 'recordings' && <span className="ml-1.5 text-slate-400">({recordings.length})</span>}
            {key === 'students' && <span className="ml-1.5 text-slate-400">({enrollments.length})</span>}
            {key === 'attendance' && <span className="ml-1.5 text-slate-400">({classAttendance.length})</span>}
          </button>
        ))}
      </div>

      {/* ═══════════════ MONTHS TAB ═══════════════ */}
      {tab === 'months' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={openNewMonth}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add Month
            </button>
          </div>

          {showMonthForm && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowMonthForm(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{editingMonth ? 'Edit Month' : 'New Month'}</h2>
                  <button onClick={() => setShowMonthForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
                </div>
                <form onSubmit={saveMonth} className="p-5 space-y-3">
                  {monthError && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{monthError}</p>}
                  <div><label className={label}>Month Name</label><input type="text" value={monthForm.name} onChange={e => setMonthForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. January 2025" required className={inp} /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={label}>Year</label><input type="number" value={monthForm.year} onChange={e => setMonthForm(p => ({ ...p, year: e.target.value }))} required className={inp} /></div>
                    <div>
                      <label className={label}>Month</label>
                      <select value={monthForm.month} onChange={e => setMonthForm(p => ({ ...p, month: e.target.value }))} className={inp}>
                        {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={label}>Visibility</label>
                      <select value={monthForm.status} onChange={e => setMonthForm(p => ({ ...p, status: e.target.value }))} className={inp}>
                        {VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setShowMonthForm(false)} className="flex-1 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                    <button type="submit" disabled={monthSaving} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">{monthSaving ? 'Saving...' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {months.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No months yet. Add your first month to start organizing recordings.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Period</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Recordings</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Visibility</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {months.map((m: any) => {
                      const recCount = recordings.filter((r: any) => r.monthId === m.id).length;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition">
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{m.name}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{MONTH_NAMES[(m.month || 1) - 1]} {m.year}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{recCount} recording{recCount !== 1 ? 's' : ''}</td>
                          <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge(m.status || 'ANYONE')}`}>{(m.status || 'ANYONE').replace(/_/g, ' ')}</span></td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button onClick={() => openEditMonth(m)} className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium">Edit</button>
                              <button onClick={() => deleteMonth(m.id)} className="text-red-500 hover:underline text-xs font-medium">Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ RECORDINGS TAB ═══════════════ */}
      {tab === 'recordings' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Month filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilterMonth('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!filterMonth ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                All Months
              </button>
              {months.map((m: any) => (
                <button key={m.id} onClick={() => setFilterMonth(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterMonth === m.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                  {m.name}
                </button>
              ))}
            </div>
            <button onClick={openNewRec}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1.5 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add Recording
            </button>
          </div>

          {/* Rec form modal */}
          {showRecForm && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowRecForm(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{editingRec ? 'Edit Recording' : 'Add Recording'}</h2>
                  <button onClick={() => setShowRecForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
                </div>
                <form onSubmit={saveRec} className="p-5 space-y-3">
                  {recError && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{recError}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={label}>Month</label>
                      <select value={recForm.monthId} onChange={e => setRecForm(p => ({ ...p, monthId: e.target.value }))} required className={inp}>
                        <option value="">Select month</option>
                        {months.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={label}>Visibility</label>
                      <select value={recForm.status} onChange={e => setRecForm(p => ({ ...p, status: e.target.value }))} className={inp}>
                        {VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label className={label}>Title</label><input type="text" value={recForm.title} onChange={e => setRecForm(p => ({ ...p, title: e.target.value }))} required className={inp} placeholder="e.g. Lesson 01" /></div>
                  <div><label className={label}>Video URL</label><input type="text" value={recForm.videoUrl} onChange={e => setRecForm(p => ({ ...p, videoUrl: e.target.value }))} required className={inp} placeholder="https://..." /></div>
                  <div><label className={label}>Thumbnail URL</label><input type="text" value={recForm.thumbnail} onChange={e => setRecForm(p => ({ ...p, thumbnail: e.target.value }))} className={inp} placeholder="https://..." /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={label}>Topic</label><input type="text" value={recForm.topic} onChange={e => setRecForm(p => ({ ...p, topic: e.target.value }))} className={inp} placeholder="Topic name" /></div>
                    <div><label className={label}>Icon</label><input type="text" value={recForm.icon} onChange={e => setRecForm(p => ({ ...p, icon: e.target.value }))} className={inp} placeholder="Icon name/URL" /></div>
                  </div>
                  <div><label className={label}>Description</label><textarea value={recForm.description} onChange={e => setRecForm(p => ({ ...p, description: e.target.value }))} className={inp + " resize-none"} rows={2} placeholder="Optional notes..." /></div>
                  <div><label className={label}>Materials (JSON or links)</label><textarea value={recForm.materials} onChange={e => setRecForm(p => ({ ...p, materials: e.target.value }))} className={inp + " resize-none"} rows={2} placeholder='e.g. ["https://file1.pdf"]' /></div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setShowRecForm(false)} className="flex-1 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                    <button type="submit" disabled={recSaving} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">{recSaving ? 'Saving...' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Recordings grid */}
          {filteredRecs.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-400">
              No recordings {filterMonth ? 'in this month' : 'yet'}. Add your first recording to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecs.map((rec: any) => (
                <div key={rec.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden group hover:border-blue-300 dark:hover:border-blue-700 transition">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-slate-100 dark:bg-slate-700">
                    {rec.thumbnail ? (
                      <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium ${statusBadge(rec.status || 'PAID_ONLY')}`}>
                      {(rec.status || 'PAID_ONLY').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{rec.title}</p>
                    {rec.topic && <p className="text-xs text-slate-400 truncate mt-0.5">{rec.topic}</p>}
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{rec.month?.name || '—'} · {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}</p>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <button onClick={() => openEditRec(rec)} className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium">Edit</button>
                      {rec.videoUrl && <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-medium">View</a>}
                      <button onClick={() => deleteRec(rec.id)} className="text-red-500 hover:underline text-xs font-medium ml-auto">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ STUDENTS TAB ═══════════════ */}
      {tab === 'students' && (
        <div className="space-y-3">
          {/* Enroll form */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row gap-3">
            <select value={enrollId} onChange={e => setEnrollId(e.target.value)} className={inp + " flex-1"}>
              <option value="">Select a student to enroll...</option>
              {availableStudents.map((s: any) => <option key={s.id} value={s.id}>{s.profile?.fullName || s.email} ({s.email})</option>)}
            </select>
            <button onClick={handleEnroll} disabled={!enrollId || enrolling}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex-shrink-0">
              {enrolling ? 'Enrolling...' : 'Enroll'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {enrollments.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No students enrolled. Use the selector above to enroll students.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Student</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">ID</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Enrolled</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {enrollments.map((enr: any) => (
                      <tr key={enr.userId} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{enr.user?.profile?.fullName || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{enr.user?.email}</td>
                        <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs font-mono">{enr.user?.profile?.instituteId || '—'}</td>
                        <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{enr.createdAt ? new Date(enr.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleUnenroll(enr.userId)} className="text-red-500 hover:underline text-xs font-medium">Unenroll</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ ATTENDANCE TAB ═══════════════ */}
      {tab === 'attendance' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {classAttendance.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No attendance records for this class yet. Attendance is recorded when students watch recordings.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Student</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Recording</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Watched</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {classAttendance.slice(0, 200).map((a: any) => {
                    const rec = recordings.find((r: any) => r.id === a.recordingId);
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{a.user?.profile?.fullName || '—'}</p>
                          <p className="text-xs text-slate-400">{a.user?.email}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-sm">{rec?.title || a.eventName || '—'}</td>
                        <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${a.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : a.status === 'INCOMPLETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{a.status}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{a.watchedSec ? `${Math.round(a.watchedSec / 60)}m` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
