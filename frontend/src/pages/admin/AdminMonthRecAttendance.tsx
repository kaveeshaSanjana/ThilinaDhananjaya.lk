import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '../../lib/api';
import StudentWatchDetailModal from '../../components/StudentWatchDetailModal';

/*  Types  */

interface RecordingMeta {
  id: string;
  title: string;
  duration?: number | null;
  thumbnail?: string | null;
  topic?: string | null;
  isLive: boolean;
  order: number;
  videoType?: string | null;
}

interface MonthMeta {
  id: string;
  name: string;
  year: number;
  month: number;
  class: { id: string; name: string; subject?: string | null };
}

interface RecordingCell {
  recordingId: string;
  attendanceStatus: 'COMPLETED' | 'INCOMPLETE' | 'MANUAL' | null;
  attendanceWatchedSec: number;
  liveJoinedAt?: string | null;
  completedAt?: string | null;
  sessionCount: number;
  totalWatchedSec: number;
  lastWatchedAt?: string | null;
  paymentStatus: 'FREE' | 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NOT_PAID';
}

interface StudentRow {
  userId: string;
  user: {
    id: string;
    email: string;
    profile: {
      fullName: string;
      instituteId: string;
      avatarUrl?: string | null;
      phone?: string | null;
      status: string;
    };
  };
  enrolled: boolean;
  recordings: RecordingCell[];
}

interface GridData {
  months: { month: MonthMeta; recordings: RecordingMeta[] }[];
  students: StudentRow[];
}

/*  Formatters  */

function fmtTime(sec: number): string {
  if (!sec || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/*  Cell helpers  */

function cellContent(cell: RecordingCell, duration?: number | null) {
  const { attendanceStatus, totalWatchedSec, sessionCount } = cell;
  const pct = duration && totalWatchedSec > 0 ? Math.min(100, Math.round((totalWatchedSec / duration) * 100)) : null;

  if (attendanceStatus === 'COMPLETED') {
    return { icon: '', label: 'Completed', sub: fmtTime(totalWatchedSec), color: 'text-green-700', bg: 'bg-green-50 border-green-200', pct };
  }
  if (attendanceStatus === 'INCOMPLETE') {
    return { icon: '', label: 'Incomplete', sub: fmtTime(totalWatchedSec), color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', pct };
  }
  if (attendanceStatus === 'MANUAL') {
    return { icon: '', label: 'Manual', sub: null, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', pct: null };
  }
  if (sessionCount > 0) {
    return { icon: '', label: 'Viewed', sub: fmtTime(totalWatchedSec), color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', pct };
  }
  return { icon: null, label: 'Not watched', sub: null, color: 'text-slate-300', bg: 'bg-white border-transparent', pct: null };
}

const PAYMENT_MAP: Record<string, { bg: string; label: string }> = {
  FREE:     { bg: 'bg-sky-100 text-sky-700', label: 'Free' },
  VERIFIED: { bg: 'bg-green-100 text-green-700', label: 'Paid' },
  PENDING:  { bg: 'bg-amber-100 text-amber-700', label: 'Pending' },
  REJECTED: { bg: 'bg-red-100 text-red-700', label: 'Rejected' },
  NOT_PAID: { bg: 'bg-red-50 text-red-500', label: 'Unpaid' },
};

function getInitials(name: string, email: string) {
  if (name) return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  return (email?.[0] || '?').toUpperCase();
}

/* ─── PaginationBar ─────────────────────────────────────── */

interface PaginationBarProps {
  total: number;
  page: number;
  rowsPerPage: number;
  pageSizeOptions: number[];
  onPageChange: (p: number) => void;
  onRowsPerPageChange: (n: number) => void;
}

function PaginationBar({ total, page, rowsPerPage, pageSizeOptions, onPageChange, onRowsPerPageChange }: PaginationBarProps) {
  const totalPages = Math.ceil(total / rowsPerPage);
  const from = total === 0 ? 0 : page * rowsPerPage + 1;
  const to   = Math.min((page + 1) * rowsPerPage, total);

  return (
    <div className="px-4 py-3 border-t border-[hsl(var(--border))] flex items-center justify-between gap-3 flex-wrap bg-[hsl(var(--card))]">
      {/* Rows per page */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">Rows per page:</span>
        <select
          value={rowsPerPage}
          onChange={e => onRowsPerPageChange(Number(e.target.value))}
          className="text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          {pageSizeOptions.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Info + nav */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {from}–{to} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(0)}
            disabled={page === 0}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="First page"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Previous page"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Page numbers */}
          {Array.from({ length: totalPages }, (_, i) => i)
            .filter(i => Math.abs(i - page) <= 2)
            .map(i => (
              <button
                key={i}
                onClick={() => onPageChange(i)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                  i === page
                    ? 'bg-blue-600 text-white'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
                }`}
              >
                {i + 1}
              </button>
            ))}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Next page"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => onPageChange(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Last page"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/*  Export Column Definitions  */

const EXPORT_COL_DEFS: Record<string, { key: string; label: string }[]> = {
  monitor: [
    { key: 'name',        label: 'Full Name' },
    { key: 'instituteId', label: 'Student ID' },
    { key: 'pct',         label: 'Completion %' },
  ],
  grid: [
    { key: 'name',        label: 'Full Name' },
    { key: 'instituteId', label: 'Student ID' },
    { key: 'email',       label: 'Email' },
    { key: 'phone',       label: 'Phone' },
    { key: 'pct',         label: 'Completion %' },
  ],
};

/*  Main Component  */

export default function AdminMonthRecAttendance() {
  const { classId, monthId } = useParams<{ classId: string; monthId: string }>();

  const [classData, setClassData]         = useState<any>(null);
  const [monthData, setMonthData]         = useState<any>(null);
  const [allRecordings, setAllRecordings] = useState<RecordingMeta[]>([]);
  const [selectedIds, setSelectedIds]     = useState<string[]>([]);
  const [gridData, setGridData]           = useState<GridData | null>(null);
  const [loadingInit, setLoadingInit]     = useState(true);
  const [loadingGrid, setLoadingGrid]     = useState(false);
  const [search, setSearch]               = useState('');
  const [activeTab, setActiveTab]         = useState<'grid' | 'monitor'>('monitor');
  const [page, setPage]                   = useState(0);
  const [rowsPerPage, setRowsPerPage]     = useState(10);
  const [popup, setPopup]                 = useState<{ recordingId: string; userId: string } | null>(null);
  const [showExport, setShowExport]       = useState(false);
  const [exportCols, setExportCols]       = useState<string[]>([]);

  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

  const openExport = () => {
    setExportCols((EXPORT_COL_DEFS[activeTab] || []).map(c => c.key));
    setShowExport(true);
  };

  const toggleExportCol = (key: string) =>
    setExportCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  function handleExport() {
    if (exportCols.length === 0 || !gridData) return;
    const cols = exportCols;
    const defs = EXPORT_COL_DEFS[activeTab] || [];
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (activeTab === 'monitor') {
      const fixedHdrs = cols.filter(k => ['name', 'instituteId'].includes(k)).map(k => defs.find(d => d.key === k)?.label || k);
      headers = [
        ...fixedHdrs,
        ...gridColumns.map(col => col.title),
        ...(cols.includes('pct') ? ['Completion %'] : []),
      ];
      rows = filteredStudents.map((s: StudentRow) => {
        const completedCount = s.recordings.filter((r: RecordingCell) => r?.attendanceStatus === 'COMPLETED' || r?.attendanceStatus === 'MANUAL').length;
        const pct = gridColumns.length > 0 ? Math.round((completedCount / gridColumns.length) * 100) : 0;
        return [
          ...(cols.includes('name')        ? [s.user?.profile?.fullName || ''] : []),
          ...(cols.includes('instituteId') ? [s.user?.profile?.instituteId || ''] : []),
          ...gridColumns.map((_col, ci) => {
            const cell: RecordingCell | undefined = s.recordings[ci];
            if (!cell) return '';
            if (cell.attendanceStatus === 'COMPLETED' || cell.attendanceStatus === 'MANUAL') return 'Completed';
            if (cell.attendanceStatus === 'INCOMPLETE') return 'Incomplete';
            if (cell.sessionCount > 0) return 'Viewed';
            return 'Not watched';
          }),
          ...(cols.includes('pct') ? [`${pct}%`] : []),
        ];
      });

    } else if (activeTab === 'grid') {
      const fixedHdrs = cols.filter(k => ['name', 'instituteId', 'email', 'phone'].includes(k)).map(k => defs.find(d => d.key === k)?.label || k);
      headers = [
        ...fixedHdrs,
        ...gridColumns.flatMap(col => [`${col.title} - Status`, `${col.title} - Watch Time`, `${col.title} - Payment`]),
        ...(cols.includes('pct') ? ['Completion %'] : []),
      ];
      rows = filteredStudents.map((s: StudentRow) => {
        const completedCount = s.recordings.filter((r: RecordingCell) => r?.attendanceStatus === 'COMPLETED' || r?.attendanceStatus === 'MANUAL').length;
        const pct = gridColumns.length > 0 ? Math.round((completedCount / gridColumns.length) * 100) : 0;
        return [
          ...(cols.includes('name')        ? [s.user?.profile?.fullName || ''] : []),
          ...(cols.includes('instituteId') ? [s.user?.profile?.instituteId || ''] : []),
          ...(cols.includes('email')       ? [s.user?.email || ''] : []),
          ...(cols.includes('phone')       ? [s.user?.profile?.phone || ''] : []),
          ...gridColumns.flatMap((_col, ci) => {
            const cell: RecordingCell | undefined = s.recordings[ci];
            if (!cell) return ['', '', ''];
            const st =
              cell.attendanceStatus === 'COMPLETED' || cell.attendanceStatus === 'MANUAL' ? 'Completed' :
              cell.attendanceStatus === 'INCOMPLETE' ? 'Incomplete' :
              cell.sessionCount > 0 ? 'Viewed' : 'Not watched';
            return [st, fmtTime(cell.totalWatchedSec), PAYMENT_MAP[cell.paymentStatus]?.label || cell.paymentStatus];
          }),
          ...(cols.includes('pct') ? [`${pct}%`] : []),
        ];
      });
    }

    if (headers.length === 0) return;
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
      return { wch: Math.min(maxLen + 2, 40) };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'monitor' ? 'Monitor' : 'Grid');
    const className = (classData?.name || 'class').replace(/\s+/g, '_');
    const monthName = (monthData?.name || 'month').replace(/\s+/g, '_');
    XLSX.writeFile(wb, `${className}_${monthName}_rec_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExport(false);
  }

  /*  Load class + month metadata  */
  useEffect(() => {
    if (!classId || !monthId) return;
    setLoadingInit(true);
    Promise.all([
      api.get(`/classes/${classId}`),
      api.get(`/classes/${classId}/months`),
    ]).then(([classRes, monthsRes]) => {
      setClassData(classRes.data);
      const month = (monthsRes.data || []).find((m: any) => m.id === monthId);
      if (month) {
        setMonthData(month);
        setAllRecordings(month.recordings || []);
      }
    }).catch(() => {}).finally(() => setLoadingInit(false));
  }, [classId, monthId]);

  /*  Fetch attendance grid when selection changes  */
  useEffect(() => {
    if (selectedIds.length === 0) { setGridData(null); return; }
    setLoadingGrid(true);
    setSearch('');
    api.get(`/attendance/recordings/users?ids=${selectedIds.join(',')}`)
      .then(r => setGridData(r.data))
      .catch(() => setGridData(null))
      .finally(() => setLoadingGrid(false));
  }, [selectedIds]);

  /*  Toggle recording selection  */
  const toggleRecording = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedIds(allRecordings.map(r => r.id));

  /*  Flatten grid columns from response  */
  const gridColumns = useMemo<(RecordingMeta & { monthLabel: string })[]>(() => {
    if (!gridData) return [];
    return gridData.months.flatMap(m =>
      m.recordings.map(r => ({ ...r, monthLabel: m.month.name }))
    );
  }, [gridData]);

  /*  Filtered students  */
  const filteredStudents = useMemo(() => {
    if (!gridData?.students) return [];
    if (!search.trim()) return gridData.students;
    const q = search.toLowerCase();
    return gridData.students.filter((s: StudentRow) =>
      s.user?.profile?.fullName?.toLowerCase().includes(q) ||
      s.user?.profile?.instituteId?.toLowerCase().includes(q) ||
      s.user?.email?.toLowerCase().includes(q)
    );
  }, [gridData, search]);

  // Reset page when filtered results or tab changes
  useEffect(() => { setPage(0); }, [filteredStudents, activeTab]);

  /*  Summary counts per column  */
  const colStats = useMemo(() => {
    if (!gridData?.students) return [];
    return gridColumns.map((_, ci) => {
      const cells = gridData.students.map((s: StudentRow) => s.recordings[ci]);
      return {
        completed:  cells.filter(c => c?.attendanceStatus === 'COMPLETED').length,
        incomplete: cells.filter(c => c?.attendanceStatus === 'INCOMPLETE').length,
        notWatched: cells.filter(c => !c?.attendanceStatus && !c?.sessionCount).length,
      };
    });
  }, [gridData, gridColumns]);

  /*  RENDER  */
  if (loadingInit) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">

      {/*  Header  */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <Link
            to={`/classes/${classId}/months/${monthId}`}
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] flex items-center gap-1 transition mb-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Recordings
          </Link>
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Month Recording Attendance</h1>
          {classData && monthData && (
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              {classData.name}  {monthData.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap justify-end">
          {gridData && (
            <button
              onClick={openExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export
            </button>
          )}
          {selectedIds.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
              </svg>
              {selectedIds.length} recording{selectedIds.length !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border))] w-full">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'monitor'
              ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          }`}
        >
          Monitor
        </button>
        <button
          onClick={() => setActiveTab('grid')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'grid'
              ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          }`}
        >
          Attendance Grid
        </button>
      </div>

      {/*  Recording Multi-Select  */}
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            Select Recordings
            <span className="ml-2 normal-case font-normal text-[hsl(var(--muted-foreground))]">
              — select one or more to view attendance
            </span>
          </label>
          <div className="flex items-center gap-2">
            {selectedIds.length < allRecordings.length ? (
              <button
                onClick={selectAll}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 transition"
              >
                Select all
              </button>
            ) : null}
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-[hsl(var(--muted-foreground))] hover:text-red-500 transition"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {allRecordings.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))] italic py-2">No recordings in this month</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {allRecordings.map((rec) => {
              const isSelected = selectedIds.includes(rec.id);
              return (
                <button
                  key={rec.id}
                  onClick={() => toggleRecording(rec.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl text-left transition border ${
                    isSelected
                      ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/25'
                      : 'bg-[hsl(var(--card))] border-[hsl(var(--border))] hover:border-blue-300 hover:bg-blue-50/40'
                  }`}
                >
                  {/* Checkbox */}
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-[hsl(var(--border))]'
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="w-12 h-9 rounded-lg overflow-hidden flex-shrink-0">
                    {rec.thumbnail ? (
                      <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-700' : 'text-[hsl(var(--foreground))]'}`}>
                      {rec.title}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {rec.isLive && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold">
                          <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />LIVE
                        </span>
                      )}
                      {rec.duration && (
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold">
                          {fmtTime(rec.duration)}
                        </span>
                      )}
                      {rec.videoType && (
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold">
                          {rec.videoType}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/*  Empty state  */}
      {selectedIds.length === 0 && (
        <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
            Select one or more recordings above to view student attendance
          </p>
        </div>
      )}

      {/*  Loading grid  */}
      {loadingGrid && (
        <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm p-6 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 rounded-xl bg-[hsl(var(--muted))] animate-pulse" />
          ))}
        </div>
      )}

      {/*  ── ATTENDANCE GRID TAB ──  */}
      {activeTab === 'grid' && gridData && !loadingGrid && (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] shadow-sm p-3 text-center">
              <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{gridData.students.length}</p>
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mt-0.5">Students</p>
            </div>
            {colStats.map((s, i) => (
              <div key={i} className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] shadow-sm p-3">
                <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide truncate mb-1">
                  {gridColumns[i]?.title}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-bold text-green-600">{s.completed} ✅</span>
                  <span className="text-xs font-bold text-amber-600">{s.incomplete} ⏳</span>
                  <span className="text-xs text-slate-400">{s.notWatched} —</span>
                </div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, ID, or email"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Grid Table */}
          {filteredStudents.length === 0 ? (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm p-10 text-center">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {search ? 'No students match your search' : 'No students found'}
              </p>
            </div>
          ) : (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    {/* Month group header  only when recordings span multiple months */}
                    {gridData.months.length > 1 && (
                      <tr className="border-b border-[hsl(var(--border))]">
                        <th colSpan={2} className="sticky left-0 z-20 bg-[hsl(var(--muted)/0.6)] px-4 py-2" />
                        {gridData.months.map(m => (
                          <th
                            key={m.month.id}
                            colSpan={m.recordings.length}
                            className="px-3 py-2 text-center text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider bg-[hsl(var(--muted)/0.4)] border-l border-[hsl(var(--border))]"
                          >
                            {m.month.name}
                          </th>
                        ))}
                        <th className="px-3 py-2 bg-[hsl(var(--muted)/0.4)]" />
                      </tr>
                    )}
                    {/* Column headers */}
                    <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)]">
                      <th className="sticky left-0 z-20 bg-[hsl(var(--muted)/0.5)] px-4 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider min-w-[200px]">
                        Student
                      </th>
                      <th className="sticky left-[200px] z-20 bg-[hsl(var(--muted)/0.5)] px-3 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider min-w-[110px] border-r border-[hsl(var(--border))]">
                        IID
                      </th>
                      {gridColumns.map((col, ci) => (
                        <th
                          key={col.id}
                          className={`px-3 py-3 text-center text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider min-w-[160px] ${ci > 0 ? 'border-l border-[hsl(var(--border))]' : ''}`}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            {col.isLive && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold">
                                <span className="w-1 h-1 rounded-full bg-red-500" />LIVE
                              </span>
                            )}
                            <span className="truncate max-w-[140px] normal-case font-semibold text-[12px] text-[hsl(var(--foreground))]">
                              {col.title}
                            </span>
                            {col.duration && (
                              <span className="text-[10px] font-normal opacity-60">{fmtTime(col.duration)}</span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 min-w-[60px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student: StudentRow, ri: number) => {
                      const name   = student.user?.profile?.fullName || 'Unknown';
                      const iid    = student.user?.profile?.instituteId || '';
                      const email  = student.user?.email || '';
                      const avatar = student.user?.profile?.avatarUrl;

                      return (
                        <tr
                          key={student.userId}
                          className={`border-b border-[hsl(var(--border))/0.5] transition-colors hover:bg-[hsl(var(--muted)/0.3)] ${ri % 2 === 0 ? '' : 'bg-[hsl(var(--muted)/0.1)]'}`}
                        >
                          {/* Student name */}
                          <td className="sticky left-0 z-10 bg-[hsl(var(--card))] px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {avatar ? (
                                <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white font-bold text-[11px]">{getInitials(name, email)}</span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-[hsl(var(--foreground))] text-sm truncate max-w-[140px]">{name}</p>
                                {!student.enrolled && (
                                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Not enrolled</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* IID */}
                          <td className="sticky left-[200px] z-10 bg-[hsl(var(--card))] px-3 py-3 border-r border-[hsl(var(--border))]">
                            <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">{iid}</span>
                          </td>

                          {/* Recording cells */}
                          {gridColumns.map((col, ci) => {
                            const cell: RecordingCell | undefined = student.recordings[ci];
                            if (!cell) {
                              return (
                                <td key={col.id} className={`px-3 py-3 text-center ${ci > 0 ? 'border-l border-[hsl(var(--border))/0.4]' : ''}`}>
                                  <span className="text-xs text-slate-300"></span>
                                </td>
                              );
                            }

                            const info    = cellContent(cell, col.duration);
                            const payment = PAYMENT_MAP[cell.paymentStatus] || PAYMENT_MAP.NOT_PAID;

                            return (
                              <td
                                key={col.id}
                                className={`px-3 py-3 ${ci > 0 ? 'border-l border-[hsl(var(--border))/0.4]' : ''}`}
                              >
                                <div className={`rounded-lg border px-2.5 py-2 ${info.bg}`}>
                                  <div className="flex items-center justify-between gap-1">
                                    <span className={`text-xs font-semibold ${info.color}`}>
                                      {info.icon && <span className="mr-1">{info.icon}</span>}
                                      {info.label}
                                    </span>
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${payment.bg}`}>
                                      {payment.label}
                                    </span>
                                  </div>
                                  {info.sub && (
                                    <div className="mt-1.5">
                                      <div className="flex items-center gap-1">
                                        <span className="text-[11px] text-[hsl(var(--muted-foreground))] font-medium">{info.sub}</span>
                                        {info.pct !== null && (
                                          <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.7)]">({info.pct}%)</span>
                                        )}
                                      </div>
                                      {info.pct !== null && (
                                        <div className="mt-1 h-1 rounded-full bg-[hsl(var(--border))] overflow-hidden">
                                          <div
                                            className={`h-full rounded-full transition-all ${info.pct >= 80 ? 'bg-green-500' : info.pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                                            style={{ width: `${info.pct}%` }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {cell.sessionCount > 0 && (
                                    <p className="text-[10px] text-[hsl(var(--muted-foreground)/0.6)] mt-1">
                                      {cell.sessionCount} session{cell.sessionCount !== 1 ? 's' : ''}
                                    </p>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          {/* Row actions */}
                          <td className="px-3 py-3 text-right">
                            {student.recordings.some((r: RecordingCell) => r?.sessionCount > 0 || r?.attendanceStatus) && (
                              <button
                                onClick={() => {
                                  const firstActive = student.recordings.find((r: RecordingCell) => r?.sessionCount > 0 || r?.attendanceStatus);
                                  if (firstActive) setPopup({ recordingId: firstActive.recordingId, userId: student.userId });
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary)/0.1)] hover:text-[hsl(var(--primary))]"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                                Detail
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Grid Pagination */}
              <PaginationBar
                total={filteredStudents.length}
                page={page}
                rowsPerPage={rowsPerPage}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setPage}
                onRowsPerPageChange={v => { setRowsPerPage(v); setPage(0); }}
              />
            </div>
          )}
        </>
      )}

      {/*  ── MONITOR TAB ──  */}
      {activeTab === 'monitor' && gridData && !loadingGrid && (() => {
        const total = gridColumns.length;
        const monitorStudents = filteredStudents;
        const pagedMonitor = monitorStudents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

        return (
          <>
            {/* Monitor search + header */}
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden">
              {/* Table meta bar */}
              <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-[hsl(var(--foreground))]">
                    {classData?.name}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                    {total} recording{total !== 1 ? 's' : ''} &bull; {gridData.students.length} student{gridData.students.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search student..."
                    className="pl-9 pr-4 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-48"
                  />
                </div>
              </div>

              {/* Monitor table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)]">
                      <th className="sticky left-0 z-20 bg-[hsl(var(--muted)/0.4)] px-4 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider min-w-[220px]">
                        Student
                      </th>
                      {gridColumns.map((col, ci) => (
                        <th
                          key={col.id}
                          className="px-3 py-3 text-center min-w-[80px] border-l border-[hsl(var(--border))]"
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] tabular-nums">
                              {String(ci + 1).padStart(2, '0')}
                            </span>
                            {col.isLive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            )}
                            <span
                              className="text-[10px] font-normal text-[hsl(var(--muted-foreground)/0.7)] max-w-[70px] truncate normal-case"
                              title={col.title}
                            >
                              {col.title}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider min-w-[60px] border-l border-[hsl(var(--border))]">
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedMonitor.map((student: StudentRow, ri: number) => {
                      const name   = student.user?.profile?.fullName || 'Unknown';
                      const iid    = student.user?.profile?.instituteId || '—';
                      const email  = student.user?.email || '';
                      const avatar = student.user?.profile?.avatarUrl;

                      const completedCount = student.recordings.filter(
                        (r: RecordingCell) => r?.attendanceStatus === 'COMPLETED' || r?.attendanceStatus === 'MANUAL'
                      ).length;
                      const incompleteCount = student.recordings.filter(
                        (r: RecordingCell) => r?.attendanceStatus === 'INCOMPLETE'
                      ).length;
                      const pct = completedCount > 0 ? 100 : incompleteCount > 0 ? 50 : 0;
                      const rowBg =
                        pct === 100
                          ? (ri % 2 === 0 ? 'bg-green-50/60' : 'bg-green-50/80')
                          : pct === 50
                            ? (ri % 2 === 0 ? 'bg-amber-50/50' : 'bg-amber-50/70')
                            : ri % 2 === 0
                              ? ''
                              : 'bg-[hsl(var(--muted)/0.07)]';

                      return (
                        <tr
                          key={student.userId}
                          className={`border-b border-[hsl(var(--border))/0.5] transition-colors hover:bg-[hsl(var(--muted)/0.25)] ${rowBg}`}
                        >
                          {/* Student */}
                          <td className="sticky left-0 z-10 bg-inherit px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {avatar ? (
                                <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white font-bold text-[11px]">{getInitials(name, email)}</span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-[hsl(var(--foreground))] text-sm truncate max-w-[150px]">{name}</p>
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] font-mono">{iid}</p>
                              </div>
                            </div>
                          </td>

                          {/* Per-recording cells */}
                          {gridColumns.map((col, ci) => {
                            const cell: RecordingCell | undefined = student.recordings[ci];
                            const status = !cell
                              ? 'none'
                              : cell.attendanceStatus === 'COMPLETED' || cell.attendanceStatus === 'MANUAL'
                                ? 'completed'
                                : cell.attendanceStatus === 'INCOMPLETE'
                                  ? 'incomplete'
                                  : cell.sessionCount > 0
                                    ? 'viewed'
                                    : 'none';

                            return (
                              <td
                                key={col.id}
                                className={`px-2 py-3 text-center border-l border-[hsl(var(--border))/0.5] ${
                                  status === 'completed' ? 'bg-green-50/50' :
                                  status === 'incomplete' ? 'bg-amber-50/50' :
                                  status === 'viewed' ? 'bg-slate-50/50' : ''
                                }`}
                              >
                                {status === 'completed' && (
                                  <svg className="w-5 h-5 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                {status === 'incomplete' && (
                                  <svg className="w-5 h-5 text-amber-500 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                  </svg>
                                )}
                                {status === 'viewed' && (
                                  <svg className="w-4.5 h-4.5 text-slate-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                )}
                                {status === 'none' && (
                                  <svg className="w-5 h-5 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                              </td>
                            );
                          })}

                          {/* % column */}
                          <td className="px-3 py-3 text-center border-l border-[hsl(var(--border))]">
                            <span className={`text-sm font-bold ${
                              pct === 100 ? 'text-green-600' :
                              pct >= 50  ? 'text-amber-500' : 'text-red-500'
                            }`}>
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="px-4 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] flex items-center gap-5 flex-wrap">
                <span className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Completed
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                  <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  Incomplete
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Viewed (partial)
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Not watched
                </span>
                <span className="ml-auto text-[11px] text-[hsl(var(--muted-foreground))]">
                  % = Completed / Total recordings
                </span>
              </div>
              {/* Monitor Pagination */}
              <PaginationBar
                total={monitorStudents.length}
                page={page}
                rowsPerPage={rowsPerPage}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setPage}
                onRowsPerPageChange={v => { setRowsPerPage(v); setPage(0); }}
              />
            </div>
          </>
        );
      })()}

      {/*  Student detail popup  */}
      {popup && (
        <StudentWatchDetailModal
          recordingId={popup.recordingId}
          userId={popup.userId}
          onClose={() => setPopup(null)}
        />
      )}

      {/* Export Modal */}
      {showExport && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowExport(false)}>
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                <div>
                  <h2 className="font-bold text-[hsl(var(--foreground))]">Export {activeTab === 'monitor' ? 'Monitor' : 'Attendance Grid'}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Select columns • per-recording columns are auto-included</p>
                </div>
                <button onClick={() => setShowExport(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Select all / Clear */}
                <div className="flex items-center gap-3">
                  <button onClick={() => setExportCols((EXPORT_COL_DEFS[activeTab] || []).map(c => c.key))} className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition">Select all</button>
                  <span className="text-slate-300">·</span>
                  <button onClick={() => setExportCols([])} className="text-xs font-semibold text-slate-400 hover:text-red-500 transition">Clear</button>
                  <span className="ml-auto text-xs text-slate-400">{exportCols.length} selected · {filteredStudents.length} rows</span>
                </div>

                {/* Dynamic columns note */}
                <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                  {gridColumns.length} recording column{gridColumns.length !== 1 ? 's' : ''} automatically included.
                  {activeTab === 'grid' && ' Each recording exports status, watch time and payment.'}
                </p>

                {/* Column checkboxes */}
                <div className="grid grid-cols-2 gap-2">
                  {(EXPORT_COL_DEFS[activeTab] || []).map(col => (
                    <label
                      key={col.key}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition select-none ${
                        exportCols.includes(col.key) ? 'bg-blue-50 border-blue-300' : 'border-[hsl(var(--border))] hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition ${
                        exportCols.includes(col.key) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                      }`}>
                        {exportCols.includes(col.key) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-xs font-medium ${exportCols.includes(col.key) ? 'text-blue-700' : 'text-slate-600'}`}>{col.label}</span>
                      <input type="checkbox" className="sr-only" checked={exportCols.includes(col.key)} onChange={() => toggleExportCol(col.key)} />
                    </label>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowExport(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                  <button
                    onClick={handleExport}
                    disabled={exportCols.length === 0}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold hover:from-emerald-600 hover:to-emerald-700 transition shadow-lg shadow-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}