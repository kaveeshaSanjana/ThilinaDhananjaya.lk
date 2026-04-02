import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import StickyDataTable, { type StickyColumn } from '../components/StickyDataTable';

const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  COMPLETED:  { label: 'Completed',  dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  INCOMPLETE: { label: 'Incomplete', dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700' },
  MANUAL:     { label: 'Manual',     dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700' },
};

function fmtSec(sec: number): string {
  if (!sec) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function ClassAttendancePage() {
  const { id } = useParams();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [className, setClassName] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/attendance/class/${id}`),
      api.get(`/classes/${id}`),
    ])
      .then(([attRes, clsRes]) => {
        setRecords(attRes.data || []);
        setClassName(clsRes.data?.name || '');
      })
      .catch(e => setError(e.response?.data?.message || 'Failed to load attendance'))
      .finally(() => setLoading(false));
  }, [id]);

  const filtered = records.filter(r => {
    const name = r.user?.profile?.fullName?.toLowerCase() || '';
    const instId = r.user?.profile?.instituteId?.toLowerCase() || '';
    const recTitle = r.recording?.title?.toLowerCase() || '';
    const q = search.toLowerCase();
    const matchSearch = !search || name.includes(q) || instId.includes(q) || recTitle.includes(q);
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    ALL: records.length,
    COMPLETED: records.filter(r => r.status === 'COMPLETED').length,
    INCOMPLETE: records.filter(r => r.status === 'INCOMPLETE').length,
    MANUAL: records.filter(r => r.status === 'MANUAL').length,
  };

  const attendanceColumns: readonly StickyColumn<any>[] = [
    {
      id: 'student',
      label: 'Student',
      minWidth: 230,
      render: (r) => {
        const initials = r.user?.profile?.fullName
          ? r.user.profile.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
          : '?';
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-xs truncate max-w-[140px]">{r.user?.profile?.fullName || '-'}</p>
              <p className="text-[10px] text-slate-400 font-mono">{r.user?.profile?.instituteId || '-'}</p>
            </div>
          </div>
        );
      },
    },
    { id: 'recording', label: 'Recording', minWidth: 180, render: (r) => <span className="text-slate-700 text-xs font-medium">{r.recording?.title || '-'}</span> },
    { id: 'month', label: 'Month', minWidth: 140, render: (r) => <span className="text-slate-500 text-xs">{r.recording?.month?.name || '-'}</span> },
    {
      id: 'status',
      label: 'Status',
      minWidth: 120,
      render: (r) => {
        const cfg = statusConfig[r.status] || statusConfig.INCOMPLETE;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        );
      },
    },
    { id: 'watched', label: 'Watched', minWidth: 100, render: (r) => <span className="text-xs text-slate-600 font-medium">{fmtSec(r.watchedSec || 0)}</span> },
    { id: 'date', label: 'Date', minWidth: 120, render: (r) => <span className="text-[11px] text-slate-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</span> },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center bg-white rounded-2xl border border-slate-100 p-12 shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <p className="text-slate-600 text-sm font-medium">{error}</p>
      <Link to={`/classes/${id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 font-semibold hover:text-blue-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to class
      </Link>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back */}
      <Link to={`/classes/${id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        {className || 'Back to dashboard'}
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">Attendance</h1>
            <p className="text-sm text-slate-500 mt-0.5">{className}</p>
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex flex-wrap gap-2 mt-5">
          {(['ALL', 'COMPLETED', 'INCOMPLETE', 'MANUAL'] as const).map(s => {
            const cfg = s === 'ALL' ? null : statusConfig[s];
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                }`}
              >
                {cfg && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : cfg.dot}`} />}
                {s === 'ALL' ? 'All Records' : cfg!.label}
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Search by student name, ID or recording..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </div>
            <p className="text-slate-500 text-sm font-medium">No attendance records found</p>
            <p className="text-slate-400 text-xs mt-1">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div>
            <StickyDataTable
              columns={attendanceColumns}
              rows={filtered}
              getRowId={(row) => row.id}
              tableHeight="calc(100vh - 420px)"
            />
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400">
                Showing <span className="font-semibold text-slate-600">{filtered.length}</span> of <span className="font-semibold text-slate-600">{records.length}</span> records
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
