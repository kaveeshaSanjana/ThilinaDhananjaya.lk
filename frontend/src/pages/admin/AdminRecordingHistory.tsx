import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import { uploadImage, uploadRecordingThumbnail } from '../../lib/imageUpload';
import CropImageInput from '../../components/CropImageInput';
import StickyDataTable, { type StickyColumn } from '../../components/StickyDataTable';
import WelcomeMessageEditor from '../../components/WelcomeMessageEditor';

const VISIBILITY_OPTIONS = ['ANYONE', 'STUDENTS_ONLY', 'PAID_ONLY', 'PRIVATE', 'INACTIVE'];
const VIDEO_TYPES = ['DRIVE', 'YOUTUBE', 'ZOOM', 'OTHER'];
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

const emptyForm = { classId: '', monthId: '', title: '', description: '', videoUrl: '', videoType: '', thumbnail: '', topic: '', icon: '', materials: '', status: 'PAID_ONLY', welcomeMessage: '', isLive: false, liveUrl: '' };

export default function AdminRecordingHistory() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [months, setMonths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRec, setEditingRec] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [liveAttendance, setLiveAttendance] = useState<any[]>([]);
  const [showLiveAttendance, setShowLiveAttendance] = useState<any>(null);
  const [copied, setCopied] = useState('');
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const load = () => { setLoading(true); Promise.all([
    api.get('/recordings').then(r => setRecordings(r.data)).catch(() => {}),
    api.get('/classes').then(r => setClasses(r.data)).catch(() => {}),
  ]).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const update = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleThumbnailFileChange = async (file?: File) => {
    if (!file) return;
    setError('');
    setUploadingThumbnail(true);
    try {
      const url = editingRec
        ? await uploadRecordingThumbnail(editingRec.id, file)
        : await uploadImage(file, 'recordings');
      setForm(p => ({ ...p, thumbnail: url }));
    } catch (err: any) {
      setError(err.message || 'Thumbnail upload failed');
    } finally {
      setUploadingThumbnail(false);
    }
  };

  useEffect(() => {
    if (form.classId) {
      api.get(`/classes/${form.classId}/months`).then(r => setMonths(r.data)).catch(() => setMonths([]));
    } else { setMonths([]); }
  }, [form.classId]);

  const openNew = () => { setForm({ ...emptyForm }); setEditingRec(null); setShowForm(true); setError(''); };
  const openEdit = (rec: any) => {
    setForm({
      classId: rec.month?.classId || '', monthId: rec.monthId || '', title: rec.title,
      description: rec.description || '', videoUrl: rec.videoUrl || '', videoType: rec.videoType || '',
      thumbnail: rec.thumbnail || '', topic: rec.topic || '', icon: rec.icon || '', materials: rec.materials || '',
      status: rec.status || 'PAID_ONLY', welcomeMessage: rec.welcomeMessage || '',
      isLive: rec.isLive || false, liveUrl: rec.liveUrl || '',
    });
    setEditingRec(rec); setShowForm(true); setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload: any = {
        title: form.title, status: form.status,
        videoUrl: form.videoUrl || undefined, videoType: form.videoType || undefined,
        description: form.description || undefined, thumbnail: form.thumbnail || undefined,
        topic: form.topic || undefined, icon: form.icon || undefined,
        materials: form.materials || undefined, welcomeMessage: form.welcomeMessage || undefined,
        isLive: form.isLive, liveUrl: form.liveUrl || undefined,
      };
      if (editingRec) {
        if (form.monthId !== editingRec.monthId) payload.monthId = form.monthId;
        await api.patch(`/recordings/${editingRec.id}`, payload);
      } else {
        payload.monthId = form.monthId;
        await api.post('/recordings', payload);
      }
      setShowForm(false); setForm({ ...emptyForm }); load();
    } catch (err: any) { setError(err.response?.data?.message || 'Failed to save recording'); }
    finally { setSaving(false); }
  };

  const handleGoLive = async (rec: any) => {
    try {
      await api.post(`/recordings/${rec.id}/go-live`);
      load();
    } catch {}
  };

  const handleEndLive = async (rec: any) => {
    try {
      await api.post(`/recordings/${rec.id}/end-live`);
      load();
    } catch {}
  };

  const handleCopyLiveLink = (rec: any) => {
    if (!rec.liveToken) return;
    const link = `${window.location.origin}/live/${rec.liveToken}`;
    navigator.clipboard.writeText(link);
    setCopied(rec.id);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleViewLiveAttendance = async (rec: any) => {
    try {
      const res = await api.get(`/recordings/${rec.id}/live-attendance`);
      setLiveAttendance(res.data);
      setShowLiveAttendance(rec);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recording?')) return;
    await api.delete(`/recordings/${id}`).catch(() => {}); load();
  };

  let filtered = recordings;
  if (filterClass) filtered = filtered.filter(r => r.month?.classId === filterClass);
  if (filterStatus) filtered = filtered.filter(r => r.status === filterStatus);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(r =>
      r.title?.toLowerCase().includes(q) ||
      r.topic?.toLowerCase().includes(q) ||
      r.month?.name?.toLowerCase().includes(q) ||
      r.month?.class?.name?.toLowerCase().includes(q)
    );
  }

  const recordingColumns: readonly StickyColumn<any>[] = [
    {
      id: 'recording',
      label: 'Recording',
      minWidth: 250,
      render: (rec) => (
        <div className="flex items-center gap-3">
          {rec.thumbnail ? (
            <img src={rec.thumbnail} alt="" className="w-16 h-10 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-16 h-10 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-slate-800 truncate text-sm">{rec.title}</p>
              {rec.isLive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold flex-shrink-0">
                  <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" /></span>
                  LIVE
                </span>
              )}
            </div>
            {rec.topic && <p className="text-xs text-slate-400 truncate">{rec.topic}</p>}
          </div>
        </div>
      ),
    },
    { id: 'class', label: 'Class', minWidth: 150, render: (rec) => <span className="text-slate-600 text-sm">{rec.month?.class?.name || '-'}</span> },
    { id: 'month', label: 'Month', minWidth: 130, render: (rec) => <span className="text-slate-500 text-sm">{rec.month?.name || '-'}</span> },
    {
      id: 'type',
      label: 'Type',
      minWidth: 90,
      render: (rec) => {
        if (rec.videoType) {
          const colors: Record<string, string> = { DRIVE: 'bg-green-50 text-green-600', YOUTUBE: 'bg-red-50 text-red-600', ZOOM: 'bg-blue-50 text-blue-600', OTHER: 'bg-slate-50 text-slate-600' };
          return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${colors[rec.videoType] || colors.OTHER}`}>{rec.videoType}</span>;
        }
        return <span className="text-slate-300 text-xs">—</span>;
      },
    },
    {
      id: 'status',
      label: 'Status',
      minWidth: 130,
      render: (rec) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(rec.status || 'PAID_ONLY')}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          {(rec.status || 'PAID_ONLY').replace(/_/g, ' ')}
        </span>
      ),
    },
    { id: 'date', label: 'Date', minWidth: 100, render: (rec) => <span className="text-slate-400 text-xs">{rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span> },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 340,
      align: 'right',
      render: (rec) => (
        <div className="flex items-center justify-end gap-1 flex-wrap">
          <button onClick={() => openEdit(rec)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Edit
          </button>
          {rec.videoUrl && <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            View
          </a>}
          {/* Live controls */}
          {rec.liveToken && !rec.isLive && (
            <button onClick={() => handleGoLive(rec)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition">
              <span className="w-2 h-2 rounded-full bg-red-500" />Go Live
            </button>
          )}
          {rec.isLive && (
            <button onClick={() => handleEndLive(rec)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-50 text-amber-600 text-xs font-semibold hover:bg-amber-100 transition">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
              End
            </button>
          )}
          {rec.liveToken && (
            <button onClick={() => handleCopyLiveLink(rec)} className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition ${copied === rec.id ? 'bg-green-100 text-green-700' : 'bg-violet-50 text-violet-600 hover:bg-violet-100'}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              {copied === rec.id ? 'Copied!' : 'Link'}
            </button>
          )}
          {rec.liveToken && (
            <button onClick={() => handleViewLiveAttendance(rec)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-cyan-50 text-cyan-600 text-xs font-semibold hover:bg-cyan-100 transition">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Live Att.
            </button>
          )}
          <button onClick={() => handleDelete(rec.id)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Del
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Recordings</h1>
          <p className="text-slate-500 text-sm mt-0.5">{recordings.length} total recordings</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Recording
        </button>
      </div>

      {/* Modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="min-h-full flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{editingRec ? 'Edit Recording' : 'Add Recording'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editingRec ? 'Update recording details' : 'Add a new video recording'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Class</label>
                  <select value={form.classId} onChange={e => { update('classId', e.target.value); update('monthId', ''); }} required
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="">Select class</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Month</label>
                  <select value={form.monthId} onChange={e => update('monthId', e.target.value)} required disabled={!form.classId}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50">
                    <option value="">{form.classId ? 'Select month' : 'Select class first'}</option>
                    {months.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Title</label>
                  <input type="text" value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Lesson 01" required
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Visibility</label>
                  <select value={form.status} onChange={e => update('status', e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    {VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Video URL</label>
                <input type="text" value={form.videoUrl} onChange={e => update('videoUrl', e.target.value)} placeholder="https://..."
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Video Type</label>
                  <select value={form.videoType} onChange={e => update('videoType', e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="">None</option>
                    {VIDEO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl border border-slate-200 bg-white cursor-pointer w-full hover:border-blue-300 transition">
                    <input type="checkbox" checked={form.isLive} onChange={e => update('isLive', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500/30" />
                    <span className="text-sm text-slate-700 font-medium">Live Lecture</span>
                    {form.isLive && <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                  </label>
                </div>
              </div>
              {form.isLive && (
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Live Meeting URL (Zoom/Meet/etc)</label>
                  <input type="text" value={form.liveUrl} onChange={e => update('liveUrl', e.target.value)} placeholder="https://zoom.us/j/123..."
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Thumbnail URL</label>
                <div className="space-y-2">
                  <input type="text" value={form.thumbnail} onChange={e => update('thumbnail', e.target.value)} placeholder="https://..."
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  <div className="flex flex-wrap items-center gap-2">
                    <CropImageInput
                      onFile={handleThumbnailFileChange}
                      aspectRatio={16 / 9}
                      loading={uploadingThumbnail}
                      label="Upload Thumbnail"
                      cropTitle="Crop Thumbnail"
                    />
                    <span className="text-[11px] text-slate-400">JPEG/PNG/WebP/GIF up to 5MB</span>
                  </div>
                  {form.thumbnail && (
                    <img src={form.thumbnail} alt="Recording thumbnail preview" className="w-full max-h-28 object-cover rounded-xl border border-slate-200" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Topic</label>
                  <input type="text" value={form.topic} onChange={e => update('topic', e.target.value)} placeholder="Topic name"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Icon</label>
                  <input type="text" value={form.icon} onChange={e => update('icon', e.target.value)} placeholder="Icon name/URL"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Optional notes..." rows={2}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Materials (JSON or links)</label>
                <textarea value={form.materials} onChange={e => update('materials', e.target.value)} placeholder='e.g. ["https://file1.pdf"]' rows={2}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
              <WelcomeMessageEditor value={form.welcomeMessage} onChange={v => update('welcomeMessage', v)} />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={saving || uploadingThumbnail} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {saving ? 'Saving...' : editingRec ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      , document.body)}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Search by title, topic, class or month..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition"
            />
          </div>

          {/* Class dropdown */}
          <div className="relative sm:w-52">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <select
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
              className="w-full appearance-none pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition"
            >
              <option value="">All Classes</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>

          {/* Status dropdown */}
          <div className="relative sm:w-44">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full appearance-none pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition"
            >
              <option value="">All Statuses</option>
              {VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>

          {/* Clear filters — only show when any filter is active */}
          {(filterClass || filterStatus || search) && (
            <button
              onClick={() => { setFilterClass(''); setFilterStatus(''); setSearch(''); }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-red-500 hover:border-red-200 transition whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Clear
            </button>
          )}
        </div>

        {/* Active filter summary */}
        {(filterClass || filterStatus) && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-medium">Filtered:</span>
            {filterClass && (
              <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700">
                {classes.find(c => c.id === filterClass)?.name || filterClass}
                <button onClick={() => setFilterClass('')} className="w-3.5 h-3.5 rounded-full hover:bg-blue-200 flex items-center justify-center transition">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            )}
            {filterStatus && (
              <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-700">
                {filterStatus.replace(/_/g, ' ')}
                <button onClick={() => setFilterStatus('')} className="w-3.5 h-3.5 rounded-full hover:bg-amber-200 flex items-center justify-center transition">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            )}
            <span className="text-[11px] text-slate-400">— {filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-sm font-medium text-slate-500">No recordings found</p>
            <p className="text-xs text-slate-400 mt-1">Add a recording using the button above</p>
          </div>
        ) : (
          <StickyDataTable
            columns={recordingColumns}
            rows={filtered}
            getRowId={(row) => row.id}
            tableHeight="calc(100vh - 380px)"
          />
        )}
      </div>

      {/* Live Attendance Modal */}
      {showLiveAttendance && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowLiveAttendance(null)}>
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="font-bold text-slate-800">Live Attendance</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{showLiveAttendance.title} — {liveAttendance.length} joined</p>
                </div>
                <button onClick={() => setShowLiveAttendance(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-5 max-h-96 overflow-y-auto">
                {liveAttendance.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-8">No students have joined yet</p>
                ) : (
                  <div className="space-y-2">
                    {liveAttendance.map((att: any, i: number) => (
                      <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">{att.user?.profile?.fullName || att.user?.email || 'Unknown'}</p>
                          <p className="text-xs text-slate-400">{att.user?.profile?.instituteId || '—'}</p>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {att.createdAt ? new Date(att.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}


