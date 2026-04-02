import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import StickyDataTable, { type StickyColumn } from '../../components/StickyDataTable';

/* ─── Formatters ──────────────────────────────────────── */

function fmtTime(sec: number): string {
  if (sec == null || sec < 0) return '-';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(d: string) {
  if (!d) return '-';
  const dt = new Date(d);
  return `${dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

const eventTypeLabel: Record<string, { label: string; color: string; icon: string }> = {
  START: { label: 'Started Watching', color: 'text-blue-600 bg-blue-50', icon: '▶' },
  PUSH: { label: 'Attendance Pushed', color: 'text-green-600 bg-green-50', icon: '✓' },
  END: { label: 'Stopped Watching', color: 'text-slate-600 bg-slate-50', icon: '■' },
  INCOMPLETE_EXIT: { label: 'Left Early', color: 'text-amber-600 bg-amber-50', icon: '⚠' },
  LIVE_JOIN: { label: 'Joined Live', color: 'text-red-600 bg-red-50', icon: '●' },
  MANUAL: { label: 'Manual Mark', color: 'text-purple-600 bg-purple-50', icon: '✎' },
};

/* ─── Main Component ──────────────────────────────────── */

export default function AdminAttendance() {
  /* Global data */
  const [classes, setClasses] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState<'by-recording' | 'sessions' | 'attendance'>('by-recording');

  /* By-recording tab — 3-step: Class → Month → Recording */
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedMonthId, setSelectedMonthId] = useState('');
  const [selectedRecordingId, setSelectedRecordingId] = useState('');
  const [recAttendance, setRecAttendance] = useState<any[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [monthPayments, setMonthPayments] = useState<any[]>([]);
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  /* Month-level student + payment data (loaded on month select) */
  const [monthEnrolled, setMonthEnrolled] = useState<any[]>([]);
  const [monthPayData, setMonthPayData] = useState<any[]>([]);
  const [loadingMonthStudents, setLoadingMonthStudents] = useState(false);

  /* Session filters */
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  /* Attendance filters */
  const [recStatus, setRecStatus] = useState('');
  const [recDate, setRecDate] = useState('');

  /* Manual form */
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', recordingId: '', date: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  /* ─── Load data on mount ─────────────────────────── */

  useEffect(() => {
    // Only load classes on mount — everything else is loaded on demand
    api.get('/classes').then(r => setClasses(r.data)).catch(() => {});
    setFetching(false);
  }, []);

  /* ─── Load recordings when class selected ────────── */

  useEffect(() => {
    if (!selectedClassId) { setRecordings([]); return; }
    api.get(`/classes/${selectedClassId}/recordings`).then(r => setRecordings(r.data || [])).catch(() => {});
  }, [selectedClassId]);

  /* ─── Load sessions / attendance lazily per tab ──── */

  useEffect(() => {
    if (tab === 'sessions' && sessions.length === 0) {
      api.get('/attendance/watch-sessions', { params: { limit: 200 } }).then(r => {
        const res = r.data;
        setSessions(res?.data ? res.data : Array.isArray(res) ? res : []);
      }).catch(() => {});
    }
    if (tab === 'attendance' && records.length === 0) {
      api.get('/attendance', { params: { limit: 200 } }).then(r => {
        const res = r.data;
        setRecords(res?.data ? res.data : Array.isArray(res) ? res : []);
      }).catch(() => {});
    }
  }, [tab]);

  /* ─── Derived: months + recordings for 3-step selection ─ */

  // Unique months for the selected class, sorted newest first
  const monthsForClass = useMemo(() => {
    if (!selectedClassId) return [];
    const monthMap = new Map<string, any>();
    for (const rec of recordings) {
      if (rec.month?.classId === selectedClassId && rec.month) {
        const m = rec.month;
        if (!monthMap.has(m.id)) {
          monthMap.set(m.id, { id: m.id, name: m.name, year: m.year, month: m.month, status: m.status, recordingCount: 0 });
        }
        monthMap.get(m.id)!.recordingCount++;
      }
    }
    return Array.from(monthMap.values()).sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  }, [recordings, selectedClassId]);

  // Recordings for the selected month
  const recordingsForMonth = useMemo(() => {
    if (!selectedMonthId) return [];
    return recordings.filter((r: any) => r.monthId === selectedMonthId);
  }, [recordings, selectedMonthId]);

  // For manual-mark modal optgroup (all recordings, no filter)
  const recordingsByClassMonth = useMemo(() => {
    const groups: { label: string; recordings: any[] }[] = [];
    const groupMap = new Map<string, any[]>();

    for (const rec of recordings) {
      const className = rec.month?.class?.name || 'Unknown Class';
      const monthName = rec.month?.name || 'Unknown Month';
      const key = `${className} — ${monthName}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
        groups.push({ label: key, recordings: groupMap.get(key)! });
      }
      groupMap.get(key)!.push(rec);
    }

    return groups;
  }, [recordings]);

  /* ─── Load enrolled + payments when month is selected ─ */

  useEffect(() => {
    if (!selectedMonthId || !selectedClassId) {
      setMonthEnrolled([]);
      setMonthPayData([]);
      return;
    }
    setLoadingMonthStudents(true);
    Promise.all([
      api.get(`/enrollments/class/${selectedClassId}`).then(r => r.data || []).catch(() => []),
      api.get(`/payments/all`, { params: { monthId: selectedMonthId, limit: 200 } }).then(r => {
        const res = r.data;
        return res?.data ? res.data : Array.isArray(res) ? res : [];
      }).catch(() => []),
    ]).then(([enrolled, payments]) => {
      setMonthEnrolled(enrolled);
      setMonthPayData(payments);
    }).finally(() => setLoadingMonthStudents(false));
  }, [selectedMonthId, selectedClassId]);

  /* ─── Month-level student payment rows ─────────── */

  const monthStudentPayments = useMemo(() => {
    if (!selectedMonthId || monthEnrolled.length === 0) return [];

    const selectedMonth = monthsForClass.find((m: any) => m.id === selectedMonthId);
    const isFree = selectedMonth?.status === 'ANYONE';

    const payMap = new Map<string, any>();
    for (const p of monthPayData) {
      const uid = p.userId;
      const existing = payMap.get(uid);
      if (!existing || p.status === 'VERIFIED' || (p.status === 'PENDING' && existing?.status !== 'VERIFIED')) {
        payMap.set(uid, p);
      }
    }

    const rows: any[] = [];
    const seen = new Set<string>();
    for (const enr of monthEnrolled) {
      const uid = enr.userId || enr.user?.id;
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      const pay = payMap.get(uid);
      rows.push({
        id: uid,
        user: enr.user,
        paymentStatus: isFree ? 'FREE' : (pay?.status || 'NOT_PAID'),
        slipUrl: pay?.slipUrl || null,
        slipType: pay?.type || null,
      });
    }

    // Sort: NOT_PAID first so admin notices them
    const order: Record<string, number> = { NOT_PAID: 0, PENDING: 1, REJECTED: 2, VERIFIED: 3, FREE: 4 };
    rows.sort((a, b) => (order[a.paymentStatus] ?? 5) - (order[b.paymentStatus] ?? 5));
    return rows;
  }, [monthEnrolled, monthPayData, selectedMonthId, monthsForClass]);

  /* ─── Load attendance + enrolled + payments when recording selected ─ */

  const selectedRec = recordings.find((r: any) => r.id === selectedRecordingId);

  useEffect(() => {
    if (!selectedRecordingId) {
      setRecAttendance([]);
      setEnrolledStudents([]);
      setMonthPayments([]);
      return;
    }
    const rec = recordings.find((r: any) => r.id === selectedRecordingId);
    if (!rec) return;

    setLoadingAtt(true);
    setExpandedRow(null);

    const classId = rec.month?.classId;
    const monthId = rec.monthId;

    Promise.all([
      api.get(`/attendance/recording/${selectedRecordingId}`).then(r => r.data || []).catch(() => []),
      classId ? api.get(`/enrollments/class/${classId}`).then(r => r.data || []).catch(() => []) : Promise.resolve([]),
      monthId ? api.get(`/payments/all`, { params: { monthId, limit: 200 } }).then(r => {
        const res = r.data;
        return res?.data ? res.data : Array.isArray(res) ? res : [];
      }).catch(() => []) : Promise.resolve([]),
    ]).then(([att, enrolled, payments]) => {
      setRecAttendance(att);
      setEnrolledStudents(enrolled);
      setMonthPayments(payments);
    }).finally(() => setLoadingAtt(false));
  }, [selectedRecordingId]);

  /* ─── Merge enrolled students + attendance + payments ─ */

  const mergedStudentRows = useMemo(() => {
    if (!selectedRecordingId) return [];

    const attMap = new Map<string, any>();
    for (const a of recAttendance) {
      attMap.set(a.userId || a.user?.id, a);
    }

    // Payment lookup: userId → best slip status for the month
    const payMap = new Map<string, string>();
    for (const p of monthPayments) {
      const uid = p.userId;
      const existing = payMap.get(uid);
      // Priority: VERIFIED > PENDING > REJECTED > none
      if (!existing || p.status === 'VERIFIED' || (p.status === 'PENDING' && existing !== 'VERIFIED')) {
        payMap.set(uid, p.status);
      }
    }

    // Get month status to check if FREE
    const monthStatus = selectedRec?.month?.status;
    const classStatus = selectedRec?.month?.class?.status;
    const isFree = monthStatus === 'ANYONE' || classStatus === 'ANYONE';

    // Build rows from enrolled students
    const seen = new Set<string>();
    const rows: any[] = [];

    for (const enr of enrolledStudents) {
      const uid = enr.userId || enr.user?.id;
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);

      const att = attMap.get(uid);
      const payStatus = payMap.get(uid);

      rows.push({
        id: att?.id || `enr-${uid}`,
        userId: uid,
        user: enr.user || att?.user,
        status: att?.status || null,
        watchedSec: att?.watchedSec || 0,
        liveJoinedAt: att?.liveJoinedAt || null,
        details: att?.details || [],
        createdAt: att?.createdAt || null,
        updatedAt: att?.updatedAt || null,
        hasAttendance: !!att,
        paymentStatus: isFree ? 'FREE' : (payStatus || 'NOT_PAID'),
      });
    }

    // Also add any attendance records for users NOT in enrollment (direct access)
    for (const a of recAttendance) {
      const uid = a.userId || a.user?.id;
      if (seen.has(uid)) continue;
      seen.add(uid);

      const payStatus = payMap.get(uid);
      rows.push({
        id: a.id,
        userId: uid,
        user: a.user,
        status: a.status,
        watchedSec: a.watchedSec || 0,
        liveJoinedAt: a.liveJoinedAt || null,
        details: a.details || [],
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        hasAttendance: true,
        paymentStatus: isFree ? 'FREE' : (payStatus || 'NOT_PAID'),
      });
    }

    // Sort: COMPLETED first, then INCOMPLETE, then no attendance
    rows.sort((a, b) => {
      const order = (s: string | null) => s === 'COMPLETED' ? 0 : s === 'MANUAL' ? 1 : s === 'INCOMPLETE' ? 2 : 3;
      return order(a.status) - order(b.status);
    });

    return rows;
  }, [recAttendance, enrolledStudents, monthPayments, selectedRecordingId, selectedRec]);

  /* ─── Helpers ─────────────────────────────────────── */

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const openManualForm = (prefill?: Partial<typeof form>) => {
    setShowForm(true);
    setError('');
    setSuccess('');
    if (prefill) setForm(p => ({ ...p, ...prefill }));
    // Lazy-load students for dropdown if not loaded yet
    if (students.length === 0) {
      api.get('/users/students', { params: { limit: 200 } }).then(r => {
        const res = r.data;
        setStudents(res?.data ? res.data : Array.isArray(res) ? res : []);
      }).catch(() => {});
    }
    // Lazy-load recordings for dropdown if not loaded yet
    if (recordings.length === 0) {
      api.get('/recordings', { params: { limit: 200 } }).then(r => {
        const res = r.data;
        setRecordings(res?.data ? res.data : Array.isArray(res) ? res : []);
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
      // Reload attendance data
      const r = await api.get('/attendance', { params: { limit: 200 } });
      const res = r.data;
      setRecords(res?.data ? res.data : Array.isArray(res) ? res : []);
      // Reload recording attendance if same recording is selected
      if (form.recordingId && form.recordingId === selectedRecordingId) {
        const att = await api.get(`/attendance/recording/${selectedRecordingId}`);
        setRecAttendance(att.data || []);
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

  /* ─── By-Recording Columns ──────────────────────── */

  const byRecordingColumns: readonly StickyColumn<any>[] = [
    {
      id: 'student', label: 'Student', minWidth: 200,
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800 text-sm">{row.user?.profile?.fullName || 'Unknown'}</p>
          <p className="text-xs text-slate-400">{row.user?.profile?.instituteId || row.user?.email || '—'}</p>
        </div>
      ),
    },
    {
      id: 'payment', label: 'Payment', minWidth: 100,
      render: (row) => {
        const p = paymentBadge(row.paymentStatus);
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${p.bg}`}>
            {p.label}
          </span>
        );
      },
    },
    {
      id: 'status', label: 'Attendance', minWidth: 110,
      render: (row) => row.status ? (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(row.status)}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />{row.status}
        </span>
      ) : (
        <span className="text-xs text-slate-300 italic">No record</span>
      ),
    },
    {
      id: 'watched', label: 'Watched', minWidth: 90,
      render: (row) => <span className="font-medium text-slate-700 text-sm">{fmtTime(row.watchedSec)}</span>,
    },
    {
      id: 'liveJoin', label: 'Live Join', minWidth: 110,
      render: (row) => row.liveJoinedAt
        ? <span className="text-xs text-red-600 font-medium">{fmtDateTime(row.liveJoinedAt)}</span>
        : <span className="text-slate-300 text-xs">—</span>,
    },
    {
      id: 'events', label: 'Events', minWidth: 70,
      render: (row) => {
        const count = Array.isArray(row.details) ? row.details.length : 0;
        return count > 0
          ? <span className="text-xs text-slate-500">{count}</span>
          : <span className="text-xs text-slate-300">—</span>;
      },
    },
    {
      id: 'lastUpdate', label: 'Last Update', minWidth: 120,
      render: (row) => row.updatedAt
        ? <span className="text-xs text-slate-500">{fmtDateTime(row.updatedAt)}</span>
        : <span className="text-xs text-slate-300">—</span>,
    },
    {
      id: 'actions', label: '', minWidth: 80, align: 'right' as const,
      render: (row) => (
        <div className="flex items-center gap-1">
          {!row.hasAttendance && (
            <button
              onClick={() => {
                setForm({ studentId: row.userId, recordingId: selectedRecordingId, date: new Date().toISOString().split('T')[0] });
                openManualForm({ studentId: row.userId, recordingId: selectedRecordingId, date: new Date().toISOString().split('T')[0] });
              }}
              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-600 hover:bg-purple-100 transition"
              title="Mark attendance manually"
            >Mark</button>
          )}
          {row.hasAttendance && (
            <button
              onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition ${
                expandedRow === row.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <svg className={`w-3 h-3 transition-transform ${expandedRow === row.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              {expandedRow === row.id ? 'Hide' : 'Detail'}
            </button>
          )}
        </div>
      ),
    },
  ];

  /* ─── Session Columns ───────────────────────────── */

  const sessionColumns: readonly StickyColumn<any>[] = [
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
      id: 'recording', label: 'Recording', minWidth: 260,
      render: (s) => (
        <>
          <p className="text-slate-600">{s.recording?.title || '-'}</p>
          <p className="text-xs text-slate-400">{s.recording?.month?.class?.name} - {s.recording?.month?.name}</p>
        </>
      ),
    },
    { id: 'date', label: 'Date', minWidth: 130, render: (s) => <span className="text-slate-600 text-sm font-medium">{fmtDate(s.startedAt)}</span> },
    {
      id: 'time', label: 'Time', minWidth: 170,
      render: (s) => (
        <span className="text-slate-600 text-sm font-medium">
          {s.startedAt ? new Date(s.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-'}
          {s.endedAt ? ` — ${new Date(s.endedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
      ),
    },
    { id: 'watched', label: 'Watched', minWidth: 100, render: (s) => <span className="font-medium text-slate-700">{fmtTime(s.totalWatchedSec)}</span> },
    {
      id: 'status', label: 'Status', minWidth: 100,
      render: (s) => (
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
          s.status === 'ENDED' ? 'bg-green-100 text-green-700' :
          s.status === 'WATCHING' ? 'bg-blue-100 text-blue-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>{s.status}</span>
      ),
    },
  ];

  /* ─── Attendance Record Columns ─────────────────── */

  const recordColumns: readonly StickyColumn<any>[] = [
    {
      id: 'student', label: 'Student', minWidth: 220,
      render: (rec) => (
        <>
          <p className="font-semibold text-slate-800 text-sm">{rec.user?.profile?.fullName || '-'}</p>
          <p className="text-xs text-slate-400">{rec.user?.profile?.instituteId || rec.user?.email}</p>
        </>
      ),
    },
    {
      id: 'recordingClass', label: 'Recording / Class', minWidth: 260,
      render: (rec) => (
        <>
          <p className="text-slate-600 text-sm">{rec.recording?.title || rec.eventName || '-'}</p>
          <p className="text-xs text-slate-400">{rec.recording?.month?.class?.name || '-'}</p>
        </>
      ),
    },
    { id: 'watched', label: 'Watched', minWidth: 90, render: (rec) => <span className="font-medium text-slate-700 text-sm">{fmtTime(rec.watchedSec)}</span> },
    { id: 'date', label: 'Date', minWidth: 120, render: (rec) => <span className="text-slate-600 text-sm font-medium">{fmtDate(rec.createdAt)}</span> },
    {
      id: 'status', label: 'Status', minWidth: 120,
      render: (rec) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(rec.status)}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />{rec.status}
        </span>
      ),
    },
    {
      id: 'events', label: 'Events', minWidth: 70,
      render: (rec) => {
        const count = Array.isArray(rec.details) ? rec.details.length : 0;
        return <span className="text-xs text-slate-400">{count}</span>;
      },
    },
  ];

  /* ─── RENDER ────────────────────────────────────── */

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Attendance</h1>
          <p className="text-slate-500 text-sm mt-0.5">{records.length} records · {sessions.length} sessions</p>
        </div>
        <button onClick={() => { openManualForm({ studentId: '', recordingId: selectedRecordingId || '', date: new Date().toISOString().split('T')[0] }); }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Mark Attendance
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <span className="text-sm font-medium text-emerald-700">{success}</span>
        </div>
      )}

      {/* ═══ MANUAL MARK MODAL ══════════════════════════ */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="font-bold text-slate-800">Mark Attendance</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Manually record attendance for a student</p>
                </div>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-3">
                {error && (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                {/* Student */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Student</label>
                  <select value={form.studentId} onChange={e => update('studentId', e.target.value)} required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="">Select student</option>
                    {students.map((s: any) => <option key={s.id} value={s.id}>{s.profile?.fullName || s.email}</option>)}
                  </select>
                </div>
                {/* Recording (optional, with optgroup) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Recording <span className="text-slate-400 font-normal">(optional)</span></label>
                  <select value={form.recordingId} onChange={e => update('recordingId', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
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
                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date</label>
                  <input type="date" value={form.date} onChange={e => update('date', e.target.value)} required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                  <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ═══ TABS ══════════════════════════════════════ */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200 w-full">
        {(['by-recording', 'sessions', 'attendance'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'by-recording' ? 'By Recording' : t === 'sessions' ? 'Watch Sessions' : 'All Records'}
          </button>
        ))}
      </div>

      {/* ═══ BY RECORDING TAB ═════════════════════════ */}
      {tab === 'by-recording' && (
        <div className="space-y-4">

          {/* Step 1: Class selector (pill buttons) */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 block">1. Select Class</label>
            <div className="flex flex-wrap gap-2">
              {classes.map((c: any) => (
                <button key={c.id}
                  onClick={() => { setSelectedClassId(c.id); setSelectedMonthId(''); setSelectedRecordingId(''); }}
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

          {/* Step 2: Horizontal scrollable month pills */}
          {selectedClassId && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 block">2. Select Month</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {monthsForClass.map((m: any) => (
                  <button key={m.id}
                    onClick={() => { setSelectedMonthId(m.id); setSelectedRecordingId(''); }}
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
                {monthsForClass.length === 0 && (
                  <p className="text-xs text-slate-400 italic py-2">No months with recordings found for this class</p>
                )}
              </div>
            </div>
          )}

          {/* Month Students — Payment Status */}
          {selectedMonthId && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-700">
                    Students — Payment Status
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {monthStudentPayments.length} enrolled student{monthStudentPayments.length !== 1 ? 's' : ''}
                    {monthStudentPayments.length > 0 && (
                      <> · <span className="text-green-600 font-semibold">{monthStudentPayments.filter(r => r.paymentStatus === 'VERIFIED' || r.paymentStatus === 'FREE').length} paid/free</span> · <span className="text-red-500 font-semibold">{monthStudentPayments.filter(r => r.paymentStatus === 'NOT_PAID').length} not paid</span> · <span className="text-amber-600 font-semibold">{monthStudentPayments.filter(r => r.paymentStatus === 'PENDING').length} pending</span></>
                    )}
                  </p>
                </div>
              </div>
              {loadingMonthStudents ? (
                <div className="p-4 space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />)}
                </div>
              ) : monthStudentPayments.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">No enrolled students for this class</div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr>
                        <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Student</th>
                        <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Institute ID</th>
                        <th className="text-center px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Payment Status</th>
                        <th className="text-center px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {monthStudentPayments.map((row: any) => {
                        const p = paymentBadge(row.paymentStatus);
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-4 py-2.5">
                              <p className="font-semibold text-slate-700 text-sm">{row.user?.profile?.fullName || 'Unknown'}</p>
                              <p className="text-[11px] text-slate-400">{row.user?.email || '—'}</p>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-slate-500">{row.user?.profile?.instituteId || '—'}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${p.bg}`}>
                                {p.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {row.slipType ? (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">{row.slipType}</span>
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Recording cards grid */}
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
                {recordingsForMonth.length === 0 && (
                  <p className="text-xs text-slate-400 italic py-2 col-span-full">No recordings in this month</p>
                )}
              </div>
            </div>
          )}

          {/* Summary stats card */}
          {selectedRec && !loadingAtt && mergedStudentRows.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800">{selectedRec.title}</p>
                    {selectedRec.isLive && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedRec.month?.class?.name} · {selectedRec.month?.name}</p>
                </div>
                <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
                  <div className="text-center min-w-[50px]">
                    <p className="text-xl font-bold text-slate-700">{mergedStudentRows.length}</p>
                    <p className="text-[10px] text-slate-400 font-medium">ENROLLED</p>
                  </div>
                  <div className="text-center min-w-[50px]">
                    <p className="text-xl font-bold text-green-600">{mergedStudentRows.filter(r => r.status === 'COMPLETED').length}</p>
                    <p className="text-[10px] text-slate-400 font-medium">COMPLETED</p>
                  </div>
                  <div className="text-center min-w-[50px]">
                    <p className="text-xl font-bold text-red-600">{mergedStudentRows.filter(r => r.status === 'INCOMPLETE').length}</p>
                    <p className="text-[10px] text-slate-400 font-medium">INCOMPLETE</p>
                  </div>
                  <div className="text-center min-w-[50px]">
                    <p className="text-xl font-bold text-slate-400">{mergedStudentRows.filter(r => !r.hasAttendance).length}</p>
                    <p className="text-[10px] text-slate-400 font-medium">NOT VIEWED</p>
                  </div>
                  <div className="text-center min-w-[50px]">
                    <p className="text-xl font-bold text-emerald-600">{mergedStudentRows.filter(r => r.paymentStatus === 'VERIFIED' || r.paymentStatus === 'FREE').length}</p>
                    <p className="text-[10px] text-slate-400 font-medium">PAID/FREE</p>
                  </div>
                  <div className="text-center min-w-[50px]">
                    <p className="text-xl font-bold text-red-500">{mergedStudentRows.filter(r => r.paymentStatus === 'NOT_PAID').length}</p>
                    <p className="text-[10px] text-slate-400 font-medium">NOT PAID</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Student table content */}
          {!selectedClassId ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.698 50.698 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>
              </div>
              <p className="text-sm font-medium text-slate-600">Select a class to get started</p>
              <p className="text-xs text-slate-400 mt-1">Then pick a month and recording to view student attendance & payment status</p>
            </div>
          ) : !selectedMonthId ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
              <p className="text-sm font-medium text-slate-500">Select a month above to see recordings</p>
            </div>
          ) : !selectedRecordingId ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
              <p className="text-sm font-medium text-slate-500">Select a recording above to view student attendance</p>
            </div>
          ) : loadingAtt ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : mergedStudentRows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <p className="text-sm font-medium text-slate-500">No enrolled students or attendance records</p>
              <p className="text-xs text-slate-400 mt-1">Students need to be enrolled in this class to appear here</p>
            </div>
          ) : (
            <div className="space-y-0">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <StickyDataTable
                  columns={byRecordingColumns}
                  rows={mergedStudentRows}
                  getRowId={(row) => row.id}
                  tableHeight="calc(100vh - 560px)"
                />
              </div>

              {/* Expanded Detail Panel */}
              {expandedRow && (() => {
                const row = mergedStudentRows.find(r => r.id === expandedRow);
                if (!row || !row.hasAttendance) return null;
                const details: any[] = Array.isArray(row.details) ? row.details : [];
                return (
                  <div className="mt-3 bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden animate-fade-in">
                    <div className="px-5 py-3 border-b border-blue-100 bg-blue-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {(row.user?.profile?.fullName?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{row.user?.profile?.fullName || 'Unknown'}</p>
                          <p className="text-[11px] text-slate-400">
                            {row.user?.profile?.instituteId || row.user?.email || '—'} · Activity Timeline
                            <span className="ml-2">{paymentBadge(row.paymentStatus).label}</span>
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setExpandedRow(null)} className="text-xs text-slate-400 hover:text-slate-600 transition">Close</button>
                    </div>

                    {details.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-400">No detailed event log available</div>
                    ) : (
                      <div className="px-5 py-4">
                        <div className="relative pl-6">
                          <div className="absolute left-2.5 top-1 bottom-1 w-px bg-slate-200" />
                          {details.map((evt: any, idx: number) => {
                            const meta = eventTypeLabel[evt.type] || { label: evt.type, color: 'text-slate-600 bg-slate-50', icon: '·' };
                            return (
                              <div key={idx} className="relative flex items-start gap-3 pb-4 last:pb-0">
                                <div className={`absolute left-[-18px] w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${meta.color} border-2 border-white shadow-sm`}>
                                  {meta.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.color}`}>
                                      {meta.label}
                                    </span>
                                    {evt.watchedSec != null && (
                                      <span className="text-[11px] text-slate-500">watched: <strong>{fmtTime(evt.watchedSec)}</strong></span>
                                    )}
                                    {evt.videoPosition != null && (
                                      <span className="text-[11px] text-slate-500">at position: <strong>{fmtTime(evt.videoPosition)}</strong></span>
                                    )}
                                    {evt.eventName && (
                                      <span className="text-[11px] text-slate-500">({evt.eventName})</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {evt.at ? fmtDateTime(evt.at) : '—'}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ═══ WATCH SESSIONS TAB ═══════════════════════ */}
      {tab === 'sessions' && (() => {
        const filtered = sessions.filter((s: any) => {
          if (filterStatus && s.status !== filterStatus) return false;
          if (filterDate) {
            const d = s.startedAt ? new Date(s.startedAt).toISOString().split('T')[0] : '';
            if (d !== filterDate) return false;
          }
          return true;
        });
        const hasFilters = filterDate || filterStatus;
        return (
          <>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Date</label>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="flex flex-col gap-1 min-w-[140px]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">All Status</option>
                  <option value="ENDED">Ended</option>
                  <option value="WATCHING">Watching</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </div>
              {hasFilters && (
                <button onClick={() => { setFilterDate(''); setFilterStatus(''); }}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Clear
                </button>
              )}
              <span className="ml-auto text-xs text-slate-400 self-end pb-2">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              {fetching ? (
                <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">{sessions.length === 0 ? 'No watch sessions yet' : 'No sessions match the selected filters'}</div>
              ) : (
                <StickyDataTable columns={sessionColumns} rows={filtered} getRowId={(row) => row.id} tableHeight="calc(100vh - 440px)" />
              )}
            </div>
          </>
        );
      })()}

      {/* ═══ ALL RECORDS TAB ══════════════════════════ */}
      {tab === 'attendance' && (() => {
        const filteredRecords = records.filter((rec: any) => {
          if (recStatus && rec.status !== recStatus) return false;
          if (recDate) {
            const d = rec.createdAt ? new Date(rec.createdAt).toISOString().split('T')[0] : '';
            if (d !== recDate) return false;
          }
          return true;
        });
        const hasRecFilters = recDate || recStatus;
        return (
          <>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Date</label>
                <input type="date" value={recDate} onChange={e => setRecDate(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="flex flex-col gap-1 min-w-[140px]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Status</label>
                <select value={recStatus} onChange={e => setRecStatus(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">All Status</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="INCOMPLETE">Incomplete</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </div>
              {hasRecFilters && (
                <button onClick={() => { setRecDate(''); setRecStatus(''); }}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Clear
                </button>
              )}
              <span className="ml-auto text-xs text-slate-400 self-end pb-2">{filteredRecords.length} result{filteredRecords.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {fetching ? (
                <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
              ) : filteredRecords.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500">No attendance records found</p>
                  <p className="text-xs text-slate-400 mt-1">{hasRecFilters ? 'Try adjusting or clearing the filters' : 'Add manual attendance using the button above'}</p>
                </div>
              ) : (
                <StickyDataTable columns={recordColumns} rows={filteredRecords} getRowId={(row) => row.id} tableHeight="calc(100vh - 440px)" />
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
