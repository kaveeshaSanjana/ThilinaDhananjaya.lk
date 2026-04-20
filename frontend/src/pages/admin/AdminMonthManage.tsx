import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import api from '../../lib/api';
import { uploadImage, uploadRecordingThumbnail } from '../../lib/imageUpload';
import CropImageInput from '../../components/CropImageInput';
import StudentWatchDetailModal from '../../components/StudentWatchDetailModal';
import { getInstituteAdminPath } from '../../lib/instituteRoutes';
import ClassMonthLiveLessonsPage from '../ClassMonthLiveLessonsPage';

/* ─── Constants ──────────────────────────────────────── */

const VISIBILITY_OPTIONS = ['ANYONE', 'STUDENTS_ONLY', 'PAID_ONLY', 'PRIVATE', 'INACTIVE'];

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

/* ─── Types ──────────────────────────────────────────── */

interface RecordingMeta {
  id: string;
  title: string;
  duration?: number | null;
  thumbnail?: string | null;
  topic?: string | null;
  isLive: boolean;
  videoType?: string | null;
  videoUrl?: string;
  status?: string;
  description?: string | null;
  icon?: string | null;
  materials?: string | null;
  createdAt?: string;
}

interface RecordingCell {
  recordingId: string;
  attendanceStatus: 'COMPLETED' | 'INCOMPLETE' | 'MANUAL' | null;
  totalWatchedSec: number;
  sessionCount: number;
  paymentStatus: 'FREE' | 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NOT_PAID';
  duration?: number | null;
}

interface StudentRow {
  userId: string;
  user: {
    id: string;
    email: string;
    profile: { fullName: string; instituteId: string; avatarUrl?: string | null };
  };
  enrolled: boolean;
  recordings: RecordingCell[];
}

interface GridData {
  months: { month: any; recordings: RecordingMeta[] }[];
  students: StudentRow[];
}

/* ─── Formatters ─────────────────────────────────────── */

function fmtSec(sec: number): string {
  if (!sec || sec <= 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getInitials(name: string, email: string) {
  if (name) return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  return (email?.[0] || '?').toUpperCase();
}

const PAYMENT_BADGE: Record<string, string> = {
  FREE: 'bg-sky-100 text-sky-700',
  VERIFIED: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
  NOT_PAID: 'bg-red-50 text-red-500',
};

const PAYMENT_LABEL: Record<string, string> = {
  FREE: 'Free', VERIFIED: 'Paid', PENDING: 'Pending', REJECTED: 'Rejected', NOT_PAID: 'Unpaid',
};

/* ─── PaginationBar ──────────────────────────────────── */

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function PaginationBar({
  total, page, rowsPerPage, onPageChange, onRowsPerPageChange,
}: {
  total: number; page: number; rowsPerPage: number;
  onPageChange: (p: number) => void; onRowsPerPageChange: (n: number) => void;
}) {
  const totalPages = Math.ceil(total / rowsPerPage);
  const from = total === 0 ? 0 : page * rowsPerPage + 1;
  const to = Math.min((page + 1) * rowsPerPage, total);
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) pages.push(i);
  } else {
    pages.push(0);
    if (page > 2) pages.push('...');
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
    if (page < totalPages - 3) pages.push('...');
    pages.push(totalPages - 1);
  }
  const btn = 'w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition';
  return (
    <div className="border-t border-[hsl(var(--border))] px-4 py-3 flex items-center justify-between gap-3 flex-wrap bg-[hsl(var(--muted)/0.2)]">
      <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
        <span>Rows:</span>
        <select
          value={rowsPerPage}
          onChange={e => onRowsPerPageChange(Number(e.target.value))}
          className="border border-[hsl(var(--border))] rounded-lg px-2 py-1 text-xs bg-[hsl(var(--card))] text-[hsl(var(--foreground))]"
        >
          {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>{from}–{to} of {total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(0)} disabled={page === 0} className={`${btn} ${page === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[hsl(var(--muted))]'}`}>«</button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 0} className={`${btn} ${page === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[hsl(var(--muted))]'}`}>‹</button>
        {pages.map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} className="w-8 text-center text-xs text-[hsl(var(--muted-foreground))]">…</span>
            : <button key={p} onClick={() => onPageChange(p as number)}
                className={`${btn} ${page === p ? 'bg-blue-600 text-white' : 'hover:bg-[hsl(var(--muted))]'}`}>{(p as number) + 1}</button>
        )}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1} className={`${btn} ${page >= totalPages - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[hsl(var(--muted))]'}`}>›</button>
        <button onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1} className={`${btn} ${page >= totalPages - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[hsl(var(--muted))]'}`}>»</button>
      </div>
    </div>
  );
}

/* ─── Empty recording form ───────────────────────────── */

const emptyRecForm = {
  title: '', videoUrl: '', description: '', thumbnail: '', topic: '', icon: '', materials: '', status: 'PAID_ONLY',
};

/* ══════════════════════════════════════════════════════ */
/*              ADMIN MONTH MANAGE PAGE                   */
/* ══════════════════════════════════════════════════════ */

export default function AdminMonthManage() {
  const { classId, monthId, instituteId } = useParams<{ classId: string; monthId: string; instituteId: string }>();

  /* ─── Core data ─────────────────────────────────────── */
  const [classData, setClassData] = useState<any>(null);
  const [monthData, setMonthData] = useState<any>(null);
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [loading, setLoading] = useState(true);

  /* ─── Tab ───────────────────────────────────────────── */
  const [tab, setTab] = useState<'recordings' | 'liveLessons' | 'attendance'>('recordings');

  /* ─── Recording form ─────────────────────────────────── */
  const [showRecForm, setShowRecForm] = useState(false);
  const [editingRec, setEditingRec] = useState<any>(null);
  const [recForm, setRecForm] = useState({ ...emptyRecForm });
  const [recSaving, setRecSaving] = useState(false);
  const [recError, setRecError] = useState('');
  const [uploadingThumb, setUploadingThumb] = useState(false);

  /* ─── Attendance ─────────────────────────────────────── */
  const [gridData, setGridData] = useState<GridData | null>(null);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [attTab, setAttTab] = useState<'monitor' | 'grid'>('monitor');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [popup, setPopup] = useState<{ recordingId: string; userId: string } | null>(null);

  /* ─── Load class + month ─────────────────────────────── */
  useEffect(() => {
    if (!classId || !monthId) return;
    setLoading(true);
    Promise.all([
      api.get(`/classes/${classId}`),
      api.get(`/classes/${classId}/months`),
    ]).then(([classRes, monthsRes]) => {
      setClassData(classRes.data);
      const month = (monthsRes.data || []).find((m: any) => m.id === monthId);
      setMonthData(month || null);
      setRecordings(month?.recordings || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [classId, monthId]);

  /* ─── Reload recordings (after CRUD) ────────────────── */
  const reloadRecordings = async () => {
    try {
      const res = await api.get(`/classes/${classId}/months`);
      const month = (res.data || []).find((m: any) => m.id === monthId);
      setRecordings(month?.recordings || []);
    } catch {}
  };

  /* ─── Auto-load attendance when tab opens ────────────── */
  useEffect(() => {
    if (tab !== 'attendance' || recordings.length === 0) return;
    loadAttendance();
  }, [tab]);

  const loadAttendance = () => {
    if (recordings.length === 0) return;
    setLoadingGrid(true);
    setSearch('');
    setPage(0);
    api.get(`/attendance/recordings/users?ids=${recordings.map(r => r.id).join(',')}`)
      .then(r => setGridData(r.data))
      .catch(() => setGridData(null))
      .finally(() => setLoadingGrid(false));
  };

  /* ─── Recording CRUD ─────────────────────────────────── */
  const openNewRec = () => {
    setRecForm({ ...emptyRecForm });
    setEditingRec(null);
    setRecError('');
    setShowRecForm(true);
  };

  const openEditRec = (rec: any) => {
    setRecForm({
      title: rec.title || '',
      videoUrl: rec.videoUrl || '',
      description: rec.description || '',
      thumbnail: rec.thumbnail || '',
      topic: rec.topic || '',
      icon: rec.icon || '',
      materials: rec.materials || '',
      status: rec.status || 'PAID_ONLY',
    });
    setEditingRec(rec);
    setRecError('');
    setShowRecForm(true);
  };

  const saveRec = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError('');
    setRecSaving(true);
    try {
      const payload: any = {
        title: recForm.title,
        videoUrl: recForm.videoUrl,
        status: recForm.status,
        description: recForm.description || undefined,
        thumbnail: recForm.thumbnail || undefined,
        topic: recForm.topic || undefined,
        icon: recForm.icon || undefined,
        materials: recForm.materials || undefined,
      };
      if (editingRec) {
        await api.patch(`/recordings/${editingRec.id}`, payload);
      } else {
        payload.monthId = monthId;
        await api.post('/recordings', payload);
      }
      setShowRecForm(false);
      await reloadRecordings();
    } catch (err: any) {
      setRecError(err.response?.data?.message || 'Failed to save recording');
    } finally {
      setRecSaving(false);
    }
  };

  const deleteRec = async (id: string) => {
    if (!confirm('Delete this recording? This cannot be undone.')) return;
    await api.delete(`/recordings/${id}`).catch(() => {});
    await reloadRecordings();
  };

  const handleThumbChange = async (file?: File) => {
    if (!file) return;
    setRecError('');
    setUploadingThumb(true);
    try {
      const url = editingRec
        ? await uploadRecordingThumbnail(editingRec.id, file)
        : await uploadImage(file, 'recordings');
      setRecForm(p => ({ ...p, thumbnail: url }));
    } catch (err: any) {
      setRecError(err.message || 'Thumbnail upload failed');
    } finally {
      setUploadingThumb(false);
    }
  };

  /* ─── Attendance derived data ────────────────────────── */
  const gridColumns = useMemo<RecordingMeta[]>(() => {
    if (!gridData) return [];
    return gridData.months.flatMap(m => m.recordings);
  }, [gridData]);

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

  useEffect(() => { setPage(0); }, [filteredStudents, attTab]);

  const pagedStudents = filteredStudents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  /* ─── Form input shorthand ────────────────────────────── */
  const inp = 'w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30';
  const lbl = 'block text-sm font-semibold text-slate-600 mb-1.5';

  /* ─── Loading / error ─────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Breadcrumb + Header ── */}
      <div>
        <Link
          to={getInstituteAdminPath(instituteId, `/classes/${classId}`)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition font-medium mb-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Class
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">
              {monthData?.name || 'Month'}
            </h1>
            {classData && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{classData.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 font-medium">
              {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border))] w-full">
        {([
          { key: 'recordings', label: 'Recordings' },
          { key: 'liveLessons', label: 'Live Lessons' },
          { key: 'attendance', label: 'Attendance' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition capitalize ${
              tab === key
                ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            {label}
            {key === 'recordings' && (
              <span className="ml-1.5 text-[hsl(var(--muted-foreground))]">({recordings.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════ RECORDINGS TAB ══════════ */}
      {tab === 'recordings' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex justify-end">
            <button
              onClick={openNewRec}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Recording
            </button>
          </div>

          {/* Recording Form Modal */}
          {showRecForm && createPortal(
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto"
              onClick={() => setShowRecForm(false)}
            >
              <div className="min-h-full flex items-center justify-center p-4">
                <div
                  className="bg-white rounded-2xl shadow-2xl w-full max-w-xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 rounded-t-2xl">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">
                        {editingRec ? 'Edit Recording' : 'New Recording'}
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {monthData?.name}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowRecForm(false)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={saveRec} className="overflow-y-auto max-h-[80vh]">
                    <div className="p-6 space-y-5">
                      {recError && (
                        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {recError}
                        </div>
                      )}

                      {/* Details */}
                      <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Details</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className={lbl}>Title</label>
                            <input
                              type="text" value={recForm.title} required
                              onChange={e => setRecForm(p => ({ ...p, title: e.target.value }))}
                              className={inp} placeholder="e.g. Lesson 01"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <label className={lbl}>Topic</label>
                            <input
                              type="text" value={recForm.topic}
                              onChange={e => setRecForm(p => ({ ...p, topic: e.target.value }))}
                              className={inp} placeholder="Topic name"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <label className={lbl}>Visibility</label>
                            <select
                              value={recForm.status}
                              onChange={e => setRecForm(p => ({ ...p, status: e.target.value }))}
                              className={inp}
                            >
                              {VISIBILITY_OPTIONS.map(v => (
                                <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Video */}
                      <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Video</p>
                        <div>
                          <label className={lbl}>Video URL</label>
                          <input
                            type="text" value={recForm.videoUrl} required
                            onChange={e => setRecForm(p => ({ ...p, videoUrl: e.target.value }))}
                            className={inp} placeholder="https://..."
                          />
                        </div>
                        <div>
                          <label className={lbl}>Thumbnail</label>
                          <div className="space-y-2">
                            <input
                              type="text" value={recForm.thumbnail}
                              onChange={e => setRecForm(p => ({ ...p, thumbnail: e.target.value }))}
                              className={inp} placeholder="https://... or upload below"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <CropImageInput
                                onFile={handleThumbChange}
                                aspectRatio={16 / 9}
                                loading={uploadingThumb}
                                label="Upload Image"
                                cropTitle="Crop Thumbnail"
                              />
                              <span className="text-[11px] text-slate-400">JPEG/PNG/WebP/GIF up to 5MB</span>
                            </div>
                            {recForm.thumbnail && (
                              <img
                                src={recForm.thumbnail}
                                alt="Thumbnail preview"
                                className="w-full max-h-28 object-cover rounded-xl border border-slate-200"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Meta</p>
                        <div>
                          <label className={lbl}>Description</label>
                          <textarea
                            value={recForm.description}
                            onChange={e => setRecForm(p => ({ ...p, description: e.target.value }))}
                            className={inp + ' resize-none'} rows={3} placeholder="Optional notes..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={lbl}>Icon</label>
                            <input
                              type="text" value={recForm.icon}
                              onChange={e => setRecForm(p => ({ ...p, icon: e.target.value }))}
                              className={inp} placeholder="Icon name/URL"
                            />
                          </div>
                          <div>
                            <label className={lbl}>Materials</label>
                            <input
                              type="text" value={recForm.materials}
                              onChange={e => setRecForm(p => ({ ...p, materials: e.target.value }))}
                              className={inp} placeholder='["https://..."]'
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2 pb-2">
                        <button
                          type="button"
                          onClick={() => setShowRecForm(false)}
                          className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={recSaving || uploadingThumb}
                          className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {(recSaving || uploadingThumb) && (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          )}
                          {recSaving ? 'Saving...' : uploadingThumb ? 'Uploading...' : editingRec ? 'Save Changes' : 'Add Recording'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          , document.body)}

          {/* Recording cards */}
          {recordings.length === 0 ? (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">No recordings yet</p>
              <p className="text-xs text-slate-400 mt-1">Add the first recording for this month</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recordings.map((rec: any) => (
                <div key={rec.id} className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden group hover:border-blue-300 hover:shadow-md transition-all">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-slate-100">
                    {rec.thumbnail ? (
                      <img
                        src={rec.thumbnail} alt={rec.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm ${statusBadge(rec.status || 'PAID_ONLY')}`}>
                      {(rec.status || 'PAID_ONLY').replace(/_/g, ' ')}
                    </span>
                    {rec.isLive && (
                      <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-3.5">
                    <p className="font-semibold text-sm text-[hsl(var(--foreground))] truncate">{rec.title}</p>
                    {rec.topic && <p className="text-xs text-blue-500 truncate mt-0.5 font-medium">{rec.topic}</p>}
                    {rec.description && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">{rec.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-[hsl(var(--border))]">
                      <button
                        onClick={() => openEditRec(rec)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </button>
                      {rec.videoUrl && (
                        <a
                          href={rec.videoUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          View
                        </a>
                      )}
                      <button
                        onClick={() => deleteRec(rec.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition ml-auto"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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

      {/* ══════════ LIVE LESSONS TAB ══════════ */}
      {tab === 'liveLessons' && (
        <div className="space-y-4">
          <ClassMonthLiveLessonsPage embedded hideBackLink />
        </div>
      )}

      {/* ══════════ ATTENDANCE TAB ══════════ */}
      {tab === 'attendance' && (
        <div className="space-y-4">

          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Inner tabs — full row */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border))] flex-1">
              {(['monitor', 'grid'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setAttTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition capitalize ${
                    attTab === t
                      ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  {t === 'monitor' ? 'Monitor' : 'Attendance Grid'}
                </button>
              ))}
            </div>
            {/* Refresh */}
            <button
              onClick={loadAttendance}
              disabled={loadingGrid || recordings.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[hsl(var(--border))] text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.4)] transition disabled:opacity-40"
            >
              <svg className={`w-3.5 h-3.5 ${loadingGrid ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {/* No recordings */}
          {recordings.length === 0 && (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm p-12 text-center">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No recordings in this month. Add recordings first.</p>
            </div>
          )}

          {/* Loading skeleton */}
          {loadingGrid && (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 rounded-xl bg-[hsl(var(--muted))] animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty state when not loaded yet */}
          {!loadingGrid && !gridData && recordings.length > 0 && (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm p-12 text-center">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading attendance data…</p>
            </div>
          )}

          {/* ── MONITOR VIEW ── */}
          {!loadingGrid && gridData && attTab === 'monitor' && (() => {
            const total = gridColumns.length;
            return (
              <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                {/* Header bar */}
                <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-[hsl(var(--foreground))]">{monthData?.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      {total} recording{total !== 1 ? 's' : ''} · {gridData.students.length} student{gridData.students.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text" value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search student..."
                      className="pl-9 pr-4 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-44"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)]">
                        <th className="sticky left-0 z-20 bg-[hsl(var(--muted)/0.4)] px-4 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider min-w-[220px]">
                          Student
                        </th>
                        {gridColumns.map((col, ci) => (
                          <th key={col.id} className="px-3 py-3 text-center min-w-[80px] border-l border-[hsl(var(--border))]">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] tabular-nums">
                                {String(ci + 1).padStart(2, '0')}
                              </span>
                              <span className="text-[10px] font-normal text-[hsl(var(--muted-foreground)/0.7)] max-w-[70px] truncate normal-case" title={col.title}>
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
                      {pagedStudents.map((student: StudentRow, ri: number) => {
                        const name = student.user?.profile?.fullName || 'Unknown';
                        const iid = student.user?.profile?.instituteId || '—';
                        const email = student.user?.email || '';
                        const avatar = student.user?.profile?.avatarUrl;

                        const completedCount = student.recordings.filter(
                          (r: RecordingCell) => r?.attendanceStatus === 'COMPLETED' || r?.attendanceStatus === 'MANUAL'
                        ).length;
                        const incompleteCount = student.recordings.filter(
                          (r: RecordingCell) => r?.attendanceStatus === 'INCOMPLETE'
                        ).length;
                        const pct = completedCount > 0 ? 100 : incompleteCount > 0 ? 50 : 0;
                        const rowBg =
                          pct === 100 ? (ri % 2 === 0 ? 'bg-green-50/60' : 'bg-green-50/80') :
                          pct === 50  ? (ri % 2 === 0 ? 'bg-amber-50/50' : 'bg-amber-50/70') :
                          ri % 2 === 0 ? '' : 'bg-[hsl(var(--muted)/0.07)]';

                        return (
                          <tr key={student.userId} className={`border-b border-[hsl(var(--border))/0.5] hover:bg-[hsl(var(--muted)/0.25)] transition-colors ${rowBg}`}>
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

                            {gridColumns.map((col, ci) => {
                              const cell: RecordingCell | undefined = student.recordings[ci];
                              const status = !cell ? 'none'
                                : cell.attendanceStatus === 'COMPLETED' || cell.attendanceStatus === 'MANUAL' ? 'completed'
                                : cell.attendanceStatus === 'INCOMPLETE' ? 'incomplete'
                                : cell.sessionCount > 0 ? 'viewed' : 'none';

                              return (
                                <td key={col.id} className={`px-2 py-3 text-center border-l border-[hsl(var(--border))/0.5] ${
                                  status === 'completed' ? 'bg-green-50/50' :
                                  status === 'incomplete' ? 'bg-amber-50/50' :
                                  status === 'viewed' ? 'bg-slate-50/50' : ''
                                }`}>
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
                                    <svg className="w-4 h-4 text-slate-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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

                            <td className="px-3 py-3 text-center border-l border-[hsl(var(--border))]">
                              <span className={`text-sm font-bold ${pct === 100 ? 'text-green-600' : pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
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
                    Viewed
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    Not Watched
                  </span>
                </div>

                <PaginationBar
                  total={filteredStudents.length}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onPageChange={setPage}
                  onRowsPerPageChange={v => { setRowsPerPage(v); setPage(0); }}
                />
              </div>
            );
          })()}

          {/* ── GRID VIEW ── */}
          {!loadingGrid && gridData && attTab === 'grid' && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] shadow-sm p-3 text-center">
                  <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{gridData.students.length}</p>
                  <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mt-0.5">Students</p>
                </div>
                {gridColumns.slice(0, 3).map((col, i) => {
                  const cells = gridData.students.map((s: StudentRow) => s.recordings[i]);
                  const completed = cells.filter(c => c?.attendanceStatus === 'COMPLETED' || c?.attendanceStatus === 'MANUAL').length;
                  const incomplete = cells.filter(c => c?.attendanceStatus === 'INCOMPLETE').length;
                  return (
                    <div key={col.id} className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] shadow-sm p-3">
                      <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide truncate mb-1">{col.title}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-bold text-green-600">{completed} ✅</span>
                        <span className="text-xs font-bold text-amber-600">{incomplete} ⏳</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Search */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text" value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, ID, or email"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Grid table */}
              <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)]">
                        <th className="sticky left-0 z-20 bg-[hsl(var(--muted)/0.5)] px-4 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider min-w-[200px]">
                          Student
                        </th>
                        <th className="sticky left-[200px] z-20 bg-[hsl(var(--muted)/0.5)] px-3 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider min-w-[100px] border-r border-[hsl(var(--border))]">
                          ID
                        </th>
                        {gridColumns.map((col, ci) => (
                          <th key={col.id} className={`px-3 py-3 text-center text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider min-w-[160px] ${ci > 0 ? 'border-l border-[hsl(var(--border))]' : ''}`}>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="truncate max-w-[140px] normal-case font-semibold text-[12px] text-[hsl(var(--foreground))]">{col.title}</span>
                              {col.duration && <span className="text-[10px] font-normal opacity-60">{fmtSec(col.duration)}</span>}
                            </div>
                          </th>
                        ))}
                        <th className="px-3 py-3 min-w-[60px]" />
                      </tr>
                    </thead>
                    <tbody>
                      {pagedStudents.map((student: StudentRow, ri: number) => {
                        const name = student.user?.profile?.fullName || 'Unknown';
                        const iid = student.user?.profile?.instituteId || '';
                        const email = student.user?.email || '';
                        const avatar = student.user?.profile?.avatarUrl;

                        return (
                          <tr key={student.userId} className={`border-b border-[hsl(var(--border))/0.5] hover:bg-[hsl(var(--muted)/0.3)] transition-colors ${ri % 2 === 0 ? '' : 'bg-[hsl(var(--muted)/0.1)]'}`}>
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
                            <td className="sticky left-[200px] z-10 bg-[hsl(var(--card))] px-3 py-3 border-r border-[hsl(var(--border))]">
                              <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">{iid}</span>
                            </td>
                            {gridColumns.map((col, ci) => {
                              const cell: RecordingCell | undefined = student.recordings[ci];
                              if (!cell) {
                                return <td key={col.id} className={`px-3 py-3 text-center ${ci > 0 ? 'border-l border-[hsl(var(--border))/0.4]' : ''}`}><span className="text-xs text-slate-300">—</span></td>;
                              }
                              const status = cell.attendanceStatus;
                              const watched = cell.totalWatchedSec;
                              const pct = col.duration && watched > 0 ? Math.min(100, Math.round((watched / col.duration) * 100)) : null;
                              const payment = cell.paymentStatus;

                              const cellBg =
                                status === 'COMPLETED' || status === 'MANUAL' ? 'bg-green-50 border-green-200' :
                                status === 'INCOMPLETE' ? 'bg-amber-50 border-amber-200' :
                                cell.sessionCount > 0 ? 'bg-slate-50 border-slate-200' : 'bg-white border-transparent';
                              const cellColor =
                                status === 'COMPLETED' || status === 'MANUAL' ? 'text-green-700' :
                                status === 'INCOMPLETE' ? 'text-amber-700' :
                                cell.sessionCount > 0 ? 'text-slate-600' : 'text-slate-300';
                              const cellLabel =
                                status === 'COMPLETED' ? 'Completed' :
                                status === 'MANUAL' ? 'Manual' :
                                status === 'INCOMPLETE' ? 'Incomplete' :
                                cell.sessionCount > 0 ? 'Viewed' : 'Not watched';

                              return (
                                <td key={col.id} className={`px-3 py-3 ${ci > 0 ? 'border-l border-[hsl(var(--border))/0.4]' : ''}`}>
                                  <div className={`rounded-lg border px-2.5 py-2 ${cellBg}`}>
                                    <div className="flex items-center justify-between gap-1">
                                      <span className={`text-xs font-semibold ${cellColor}`}>{cellLabel}</span>
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PAYMENT_BADGE[payment] || PAYMENT_BADGE.NOT_PAID}`}>
                                        {PAYMENT_LABEL[payment] || 'Unpaid'}
                                      </span>
                                    </div>
                                    {watched > 0 && (
                                      <div className="mt-1.5">
                                        <div className="flex items-center gap-1">
                                          <span className="text-[11px] text-[hsl(var(--muted-foreground))] font-medium">{fmtSec(watched)}</span>
                                          {pct !== null && <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.7)]">({pct}%)</span>}
                                        </div>
                                        {pct !== null && (
                                          <div className="mt-1 h-1 rounded-full bg-[hsl(var(--border))] overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                                              style={{ width: `${pct}%` }}
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
                            <td className="px-3 py-3 text-right">
                              {student.recordings.some((r: RecordingCell) => r?.sessionCount > 0 || r?.attendanceStatus) && (
                                <button
                                  onClick={() => {
                                    const first = student.recordings.find((r: RecordingCell) => r?.sessionCount > 0 || r?.attendanceStatus);
                                    if (first) setPopup({ recordingId: first.recordingId, userId: student.userId });
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
                <PaginationBar
                  total={filteredStudents.length}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onPageChange={setPage}
                  onRowsPerPageChange={v => { setRowsPerPage(v); setPage(0); }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Student watch detail popup */}
      {popup && (
        <StudentWatchDetailModal
          recordingId={popup.recordingId}
          userId={popup.userId}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}
