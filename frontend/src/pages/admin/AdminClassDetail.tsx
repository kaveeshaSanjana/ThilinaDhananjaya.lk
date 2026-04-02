import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import api from '../../lib/api';
import StickyDataTable, { type StickyColumn } from '../../components/StickyDataTable';

const VISIBILITY_OPTIONS = ['ANYONE', 'STUDENTS_ONLY', 'PAID_ONLY', 'PRIVATE', 'INACTIVE'];

function fmtTime(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    ANYONE: 'bg-green-100 text-green-700',
    STUDENTS_ONLY: 'bg-blue-100 text-blue-700',
    PAID_ONLY: 'bg-amber-100 text-amber-700',
    PRIVATE: 'bg-purple-100 text-purple-700',
    INACTIVE: 'bg-slate-100 text-slate-500',
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
  const [enrollMode, setEnrollMode] = useState<'userId' | 'phone'>('userId');
  const [enrollPhone, setEnrollPhone] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Watch Sessions
  const [watchSessions, setWatchSessions] = useState<any[]>([]);

  const loadClass = () => api.get(`/classes/${id}`).then(r => setCls(r.data)).catch(() => {});
  const loadMonths = () => api.get(`/classes/${id}/months`).then(r => setMonths(r.data)).catch(() => {});
  const loadRecordings = () => api.get(`/classes/${id}/recordings`).then(r => setRecordings(r.data)).catch(() => {});
  const loadEnrollments = () => api.get(`/enrollments/class/${id}`).then(r => setEnrollments(r.data || [])).catch(() => {});
  const loadStudents = () => api.get('/users/students', { params: { limit: 200 } }).then(r => {
    const res = r.data;
    setAllStudents(res?.data ? res.data : Array.isArray(res) ? res : []);
  }).catch(() => {});
  const loadWatchSessions = () => api.get(`/attendance/watch-sessions/class/${id}`).then(r => setWatchSessions(r.data || [])).catch(() => {});

  useEffect(() => {
    setLoading(true);
    Promise.all([loadClass(), loadMonths(), loadRecordings(), loadEnrollments()])
      .finally(() => setLoading(false));
  }, [id]);

  // Lazy-load students and watch sessions when their tabs are selected
  useEffect(() => {
    if (tab === 'students' && allStudents.length === 0) loadStudents();
    if (tab === 'attendance' && watchSessions.length === 0) loadWatchSessions();
  }, [tab]);

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
    setEnrollError(''); setEnrollSuccess('');
    if (enrollMode === 'userId') {
      if (!enrollId) return; setEnrolling(true);
      try {
        await api.post('/enrollments', { userId: enrollId, classId: id });
        setEnrollId(''); setSelectedStudent(null); setStudentSearch('');
        setEnrollSuccess('Student enrolled successfully.');
        loadEnrollments();
      } catch (err: any) { setEnrollError(err.response?.data?.message || 'Failed to enroll student.'); }
      finally { setEnrolling(false); }
    } else {
      if (!enrollPhone.trim()) return; setEnrolling(true);
      try {
        await api.post('/enrollments/by-phone', { phone: enrollPhone.trim(), classId: id });
        setEnrollPhone('');
        setEnrollSuccess('Student enrolled successfully.');
        loadEnrollments();
      } catch (err: any) { setEnrollError(err.response?.data?.message || 'Failed to enroll student.'); }
      finally { setEnrolling(false); }
    }
  };
  const handleUnenroll = async (userId: string) => {
    if (!confirm('Unenroll this student?')) return;
    await api.delete(`/enrollments/${userId}/${id}`).catch(() => {}); loadEnrollments();
  };

  const enrolledIds = new Set(enrollments.map((e: any) => e.userId));
  const availableStudents = allStudents.filter((s: any) => !enrolledIds.has(s.id));
  const filteredRecs = filterMonth ? recordings.filter((r: any) => r.monthId === filterMonth) : recordings;

  const monthColumns: readonly StickyColumn<any>[] = [
    { id: 'name', label: 'Name', minWidth: 180, render: (m) => <span className="font-medium text-slate-800">{m.name}</span> },
    { id: 'period', label: 'Period', minWidth: 140, render: (m) => <span className="text-slate-500">{MONTH_NAMES[(m.month || 1) - 1]} {m.year}</span> },
    { id: 'recordings', label: 'Recordings', minWidth: 120, render: (m) => { const recCount = recordings.filter((r: any) => r.monthId === m.id).length; return <span className="text-slate-500">{recCount} recording{recCount !== 1 ? 's' : ''}</span>; } },
    { id: 'visibility', label: 'Visibility', minWidth: 120, render: (m) => <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge(m.status || 'ANYONE')}`}>{(m.status || 'ANYONE').replace(/_/g, ' ')}</span> },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 170,
      align: 'right',
      render: (m) => (
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={() => openEditMonth(m)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Edit
          </button>
          <button onClick={() => deleteMonth(m.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete
          </button>
        </div>
      ),
    },
  ];

  const enrollmentColumns: readonly StickyColumn<any>[] = [
    {
      id: 'student', label: 'Student', minWidth: 220,
      render: (enr) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {(enr.user?.profile?.fullName || enr.user?.email || '?')[0].toUpperCase()}
          </div>
          <span className="font-semibold text-slate-800">{enr.user?.profile?.fullName || '-'}</span>
        </div>
      ),
    },
    { id: 'email', label: 'Email', minWidth: 170, render: (enr) => <span className="text-slate-500">{enr.user?.email}</span> },
    { id: 'institute', label: 'ID', minWidth: 90, render: (enr) => <span className="text-slate-400 text-xs font-mono">{enr.user?.profile?.instituteId || '-'}</span> },
    { id: 'enrolled', label: 'Enrolled', minWidth: 90, render: (enr) => <span className="text-slate-400 text-xs">{enr.createdAt ? new Date(enr.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span> },
    {
      id: 'actions', label: 'Actions', minWidth: 120, align: 'right',
      render: (enr) => (
        <button onClick={() => handleUnenroll(enr.userId)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>
          Unenroll
        </button>
      ),
    },
  ];

  const watchColumns: readonly StickyColumn<any>[] = [
    {
      id: 'student', label: 'Student', minWidth: 220,
      render: (s) => (
        <>
          <p className="font-medium text-slate-800">{s.user?.profile?.fullName || '-'}</p>
          <p className="text-xs text-slate-400">{s.user?.email}</p>
        </>
      ),
    },
    {
      id: 'recording', label: 'Recording', minWidth: 240,
      render: (s) => (
        <>
          <p className="text-slate-600">{s.recording?.title || '-'}</p>
          <p className="text-xs text-slate-400">{s.recording?.month?.name || '-'}</p>
        </>
      ),
    },
    {
      id: 'date', label: 'Date', minWidth: 170,
      render: (s) => (
        <span className="text-slate-400 text-xs">
          {s.startedAt ? new Date(s.startedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
          <br />
          <span className="text-slate-300">
            {s.startedAt ? new Date(s.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
            {s.endedAt ? ` - ${new Date(s.endedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
        </span>
      ),
    },
    { id: 'watched', label: 'Watched', minWidth: 90, render: (s) => <span className="font-medium text-slate-700">{fmtTime(s.totalWatchedSec)}</span> },
    {
      id: 'status', label: 'Status', minWidth: 120,
      render: (s) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
          s.status === 'ENDED' ? 'bg-green-100 text-green-700' :
          s.status === 'WATCHING' ? 'bg-blue-100 text-blue-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          {s.status}
        </span>
      ),
    },
  ];

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

  const inp = "w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30";
  const label = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <Link to="/admin/classes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to Classes
      </Link>

      {/* Class Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {cls.thumbnail && (
            <div className="sm:w-48 h-36 sm:h-auto flex-shrink-0">
              <img src={cls.thumbnail} alt={cls.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-slate-800">{cls.name}</h1>
                {cls.subject && <p className="text-sm text-slate-500 mt-0.5">{cls.subject}</p>}
                {cls.description && <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{cls.description}</p>}
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0 ${statusBadge(cls.status || 'ANYONE')}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {(cls.status || 'ANYONE').replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex flex-wrap gap-5 mt-4 text-xs text-slate-500">
              {cls.monthlyFee != null && <span className="font-bold text-blue-600 text-sm">Rs. {Number(cls.monthlyFee).toLocaleString()} / month</span>}
              <span className="flex items-center gap-1"><span className="font-semibold text-slate-700">{months.length}</span> month{months.length !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><span className="font-semibold text-slate-700">{recordings.length}</span> recording{recordings.length !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><span className="font-semibold text-slate-700">{enrollments.length}</span> student{enrollments.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200 overflow-x-auto">
        {([['months', 'Months'], ['recordings', 'Recordings'], ['students', 'Students'], ['attendance', 'Attendance']] as [Tab, string][]).map(([key, lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 min-w-[4.5rem] px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {lbl}
            {key === 'months' && <span className="ml-1.5 text-slate-400">({months.length})</span>}
            {key === 'recordings' && <span className="ml-1.5 text-slate-400">({recordings.length})</span>}
            {key === 'students' && <span className="ml-1.5 text-slate-400">({enrollments.length})</span>}
            {key === 'attendance' && <span className="ml-1.5 text-slate-400">({watchSessions.length})</span>}
          </button>
        ))}
      </div>

      {/* ═══════════════ MONTHS TAB ═══════════════ */}
      {tab === 'months' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={openNewMonth}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add Month
            </button>
          </div>

          {showMonthForm && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowMonthForm(false)}>
              <div className="min-h-full flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 rounded-t-2xl">
                  <div>
                    <h2 className="font-bold text-slate-800">{editingMonth ? 'Edit Month' : 'New Month'}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{editingMonth ? 'Update month details' : 'Add a new month to organize recordings'}</p>
                  </div>
                  <button onClick={() => setShowMonthForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <form onSubmit={saveMonth} className="p-5 space-y-3">
                  {monthError && <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600"><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{monthError}</div>}
                  <div><label className={label}>Month Name</label><input type="text" value={monthForm.name} onChange={e => setMonthForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. January 2025" required className={inp} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowMonthForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                    <button type="submit" disabled={monthSaving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                      {monthSaving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                      {monthSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
              </div>
            </div>
          , document.body)}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {months.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-sm font-medium text-slate-500">No months yet</p>
                <p className="text-xs text-slate-400 mt-1">Add your first month to start organizing recordings</p>
              </div>
            ) : (
              <StickyDataTable
                columns={monthColumns}
                rows={months}
                getRowId={(row) => row.id}
                tableHeight="calc(100vh - 420px)"
              />
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!filterMonth ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                All Months
              </button>
              {months.map((m: any) => (
                <button key={m.id} onClick={() => setFilterMonth(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterMonth === m.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {m.name}
                </button>
              ))}
            </div>
            <button onClick={openNewRec}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 flex items-center gap-1.5 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add Recording
            </button>
          </div>

          {/* Rec form modal */}
          {showRecForm && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowRecForm(false)}>
              <div className="min-h-full flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 rounded-t-2xl">
                  <div>
                    <h2 className="font-bold text-slate-800">{editingRec ? 'Edit Recording' : 'New Recording'}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{editingRec ? 'Update recording details' : 'Add a new recording to this class'}</p>
                  </div>
                  <button onClick={() => setShowRecForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <form onSubmit={saveRec} className="p-5 space-y-3">
                  {recError && <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600"><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{recError}</div>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className={label}>Topic</label><input type="text" value={recForm.topic} onChange={e => setRecForm(p => ({ ...p, topic: e.target.value }))} className={inp} placeholder="Topic name" /></div>
                    <div><label className={label}>Icon</label><input type="text" value={recForm.icon} onChange={e => setRecForm(p => ({ ...p, icon: e.target.value }))} className={inp} placeholder="Icon name/URL" /></div>
                  </div>
                  <div><label className={label}>Description</label><textarea value={recForm.description} onChange={e => setRecForm(p => ({ ...p, description: e.target.value }))} className={inp + " resize-none"} rows={2} placeholder="Optional notes..." /></div>
                  <div><label className={label}>Materials (JSON or links)</label><textarea value={recForm.materials} onChange={e => setRecForm(p => ({ ...p, materials: e.target.value }))} className={inp + " resize-none"} rows={2} placeholder='e.g. ["https://file1.pdf"]' /></div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowRecForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                    <button type="submit" disabled={recSaving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                      {recSaving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                      {recSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
              </div>
            </div>
          , document.body)}

          {/* Recordings grid */}
          {filteredRecs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-sm font-medium text-slate-500">No recordings {filterMonth ? 'in this month' : 'yet'}</p>
              <p className="text-xs text-slate-400 mt-1">Add your first recording to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecs.map((rec: any) => (
                <div key={rec.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden group hover:border-blue-300 hover:shadow-md transition-all">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-slate-100">
                    {rec.thumbnail ? (
                      <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm ${statusBadge(rec.status || 'PAID_ONLY')}`}>
                      {(rec.status || 'PAID_ONLY').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="p-3.5">
                    <p className="font-semibold text-sm text-slate-800 truncate">{rec.title}</p>
                    {rec.topic && <p className="text-xs text-blue-500 truncate mt-0.5 font-medium">{rec.topic}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">{rec.month?.name || '—'} · {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}</p>
                    <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
                      <button onClick={() => openEditRec(rec)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        Edit
                      </button>
                      {rec.videoUrl && (
                        <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          View
                        </a>
                      )}
                      <button onClick={() => deleteRec(rec.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition ml-auto">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete
                      </button>
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
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              Enroll a Student
            </h3>

            {/* Mode toggle */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4 w-fit">
              <button onClick={() => { setEnrollMode('userId'); setEnrollError(''); setEnrollSuccess(''); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${enrollMode === 'userId' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                By Student
              </button>
              <button onClick={() => { setEnrollMode('phone'); setEnrollError(''); setEnrollSuccess(''); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${enrollMode === 'phone' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                By Phone Number
              </button>
            </div>

            {enrollMode === 'userId' ? (
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Searchable dropdown */}
                <div className="relative flex-1">
                  <div
                    className={`${inp} flex items-center justify-between cursor-pointer`}
                    onClick={() => setDropdownOpen(o => !o)}
                  >
                    <span className={selectedStudent ? 'text-slate-800' : 'text-slate-400'}>
                      {selectedStudent ? `${selectedStudent.profile?.fullName || selectedStudent.email} (${selectedStudent.email})` : 'Select a student to enroll...'}
                    </span>
                    <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  {dropdownOpen && (
                    <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          <input
                            autoFocus
                            value={studentSearch}
                            onChange={e => setStudentSearch(e.target.value)}
                            placeholder="Search by name or email..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <ul className="max-h-52 overflow-y-auto py-1">
                        {availableStudents
                          .filter((s: any) => {
                            const q = studentSearch.toLowerCase();
                            return !q || (s.profile?.fullName || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
                          })
                          .map((s: any) => (
                            <li
                              key={s.id}
                              className="flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 cursor-pointer transition"
                              onClick={() => { setSelectedStudent(s); setEnrollId(s.id); setDropdownOpen(false); setStudentSearch(''); }}
                            >
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                {(s.profile?.fullName || s.email)[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{s.profile?.fullName || s.email}</p>
                                <p className="text-[10px] text-slate-400 truncate">{s.email}</p>
                              </div>
                            </li>
                          ))}
                        {availableStudents.filter((s: any) => {
                          const q = studentSearch.toLowerCase();
                          return !q || (s.profile?.fullName || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
                        }).length === 0 && (
                          <li className="px-3 py-3 text-xs text-slate-400 text-center">No students found</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
                <button onClick={handleEnroll} disabled={!enrollId || enrolling}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex-shrink-0 flex items-center gap-2">
                  {enrolling && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {enrolling ? 'Enrolling...' : 'Enroll Student'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="tel"
                  value={enrollPhone}
                  onChange={e => setEnrollPhone(e.target.value)}
                  placeholder="e.g. 0771234567"
                  className={inp + " flex-1"}
                />
                <button onClick={handleEnroll} disabled={!enrollPhone.trim() || enrolling}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex-shrink-0 flex items-center gap-2">
                  {enrolling && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {enrolling ? 'Enrolling...' : 'Enroll by Phone'}
                </button>
              </div>
            )}

            {enrollError && (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {enrollError}
              </div>
            )}
            {enrollSuccess && (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-100 text-xs text-green-700">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {enrollSuccess}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {enrollments.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <p className="text-sm font-medium text-slate-500">No students enrolled yet</p>
                <p className="text-xs text-slate-400 mt-1">Use the form above to enroll students</p>
              </div>
            ) : (
              <StickyDataTable
                columns={enrollmentColumns}
                rows={enrollments}
                getRowId={(row) => row.userId}
                tableHeight="calc(100vh - 500px)"
              />
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ ATTENDANCE TAB ═══════════════ */}
      {tab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {watchSessions.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-sm font-medium text-slate-500">No watch sessions yet</p>
              <p className="text-xs text-slate-400 mt-1">Sessions are recorded when students watch recordings</p>
            </div>
          ) : (
            <StickyDataTable
              columns={watchColumns}
              rows={watchSessions}
              getRowId={(row) => row.id}
              tableHeight="calc(100vh - 380px)"
            />
          )}
        </div>
      )}
    </div>
  );
}


