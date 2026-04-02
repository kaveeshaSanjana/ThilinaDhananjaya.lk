import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { uploadClassThumbnail, uploadImage } from '../../lib/imageUpload';
import StickyDataTable, { type StickyColumn } from '../../components/StickyDataTable';

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

export default function AdminClasses() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', subject: '', monthlyFee: '', thumbnail: '', vision: '', mission: '', introVideoUrl: '', status: 'ANYONE' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [viewClass, setViewClass] = useState<any>(null);

  const load = () => { setLoading(true); api.get('/classes').then(r => setClasses(r.data)).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ name: '', description: '', subject: '', monthlyFee: '', thumbnail: '', vision: '', mission: '', introVideoUrl: '', status: 'ANYONE' }); setEditingClass(null); setShowForm(true); setError(''); };
  const openEdit = (cls: any) => { setForm({ name: cls.name, description: cls.description || '', subject: cls.subject || '', monthlyFee: cls.monthlyFee ?? '', thumbnail: cls.thumbnail || '', vision: cls.vision || '', mission: cls.mission || '', introVideoUrl: cls.introVideoUrl || '', status: cls.status || 'ANYONE' }); setEditingClass(cls); setShowForm(true); setError(''); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload = {
        name: form.name, subject: form.subject || undefined, description: form.description || undefined,
        monthlyFee: form.monthlyFee ? Number(form.monthlyFee) : null,
        thumbnail: form.thumbnail || undefined, vision: form.vision || undefined,
        mission: form.mission || undefined, introVideoUrl: form.introVideoUrl || undefined,
        status: form.status,
      };
      if (editingClass) await api.patch(`/classes/${editingClass.id}`, payload);
      else await api.post('/classes', payload);
      setShowForm(false); load();
    } catch (err: any) { setError(err.response?.data?.message || 'Failed to save class'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this class? This cannot be undone.')) return;
    await api.delete(`/classes/${id}`).catch(() => {}); load();
  };

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleThumbnailFileChange = async (file?: File) => {
    if (!file) return;
    setError('');
    setUploadingThumbnail(true);
    try {
      const url = editingClass
        ? await uploadClassThumbnail(editingClass.id, file)
        : await uploadImage(file, 'classes');
      setForm(p => ({ ...p, thumbnail: url }));
    } catch (err: any) {
      setError(err.message || 'Thumbnail upload failed');
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const classColumns: readonly StickyColumn<any>[] = [
    {
      id: 'class',
      label: 'Class',
      minWidth: 280,
      render: (cls) => (
        <div className="flex items-center gap-3">
          {cls.thumbnail ? (
            <img src={cls.thumbnail} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-white text-sm font-bold">{cls.name?.[0]?.toUpperCase() || 'C'}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{cls.name}</p>
            {cls.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{cls.description}</p>}
          </div>
        </div>
      ),
    },
    { id: 'subject', label: 'Subject', minWidth: 140, render: (cls) => <span className="text-slate-500 text-sm">{cls.subject || '-'}</span> },
    { id: 'monthlyFee', label: 'Monthly Fee', minWidth: 140, align: 'left', render: (cls) => <span className="text-slate-700 font-semibold text-sm">{cls.monthlyFee != null ? `Rs. ${Number(cls.monthlyFee).toLocaleString()}` : '-'}</span> },
    {
      id: 'status',
      label: 'Status',
      minWidth: 130,
      render: (cls) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(cls.status || 'ANYONE')}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          {(cls.status || 'ANYONE').replace(/_/g, ' ')}
        </span>
      ),
    },
    { id: 'vision', label: 'Vision', minWidth: 200, defaultVisible: false, render: (cls) => <span className="text-slate-500 text-sm">{cls.vision || '-'}</span> },
    { id: 'mission', label: 'Mission', minWidth: 200, defaultVisible: false, render: (cls) => <span className="text-slate-500 text-sm">{cls.mission || '-'}</span> },
    { id: 'introVideoUrl', label: 'Intro Video URL', minWidth: 200, defaultVisible: false, render: (cls) => cls.introVideoUrl ? <a href={cls.introVideoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs underline truncate block max-w-[180px]">{cls.introVideoUrl}</a> : <span className="text-slate-400 text-sm">-</span> },
    { id: 'thumbnail', label: 'Thumbnail URL', minWidth: 180, defaultVisible: false, render: (cls) => cls.thumbnail ? <a href={cls.thumbnail} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs underline truncate block max-w-[160px]">{cls.thumbnail}</a> : <span className="text-slate-400 text-sm">-</span> },
    { id: 'createdAt', label: 'Created', minWidth: 120, defaultVisible: false, render: (cls) => <span className="text-slate-400 text-xs">{cls.createdAt ? new Date(cls.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span> },
    { id: 'updatedAt', label: 'Updated', minWidth: 120, defaultVisible: false, render: (cls) => <span className="text-slate-400 text-xs">{cls.updatedAt ? new Date(cls.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span> },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 290,
      align: 'right',
      render: (cls) => (
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={() => setViewClass(cls)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            View
          </button>
          <Link to={`/admin/classes/${cls.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Manage
          </Link>
          <button onClick={() => openEdit(cls)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Edit
          </button>
          <button onClick={() => handleDelete(cls.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Classes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{classes.length} classes</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Class
        </button>
      </div>

      {/* View Detail Modal */}
      {viewClass && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setViewClass(null)}>
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800">Class Details</h2>
                <button onClick={() => setViewClass(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Thumbnail */}
                {viewClass.thumbnail && (
                  <img src={viewClass.thumbnail} alt={viewClass.name} className="w-full h-44 object-cover rounded-xl border border-slate-100" />
                )}
                {/* Name & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{viewClass.name}</h3>
                    {viewClass.subject && <p className="text-sm text-slate-500 mt-0.5">{viewClass.subject}</p>}
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${statusBadge(viewClass.status || 'ANYONE')}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                    {(viewClass.status || 'ANYONE').replace(/_/g, ' ')}
                  </span>
                </div>
                {/* Fee */}
                {viewClass.monthlyFee != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Monthly Fee:</span>
                    <span className="font-bold text-blue-600">Rs. {Number(viewClass.monthlyFee).toLocaleString()}</span>
                  </div>
                )}
                {/* Description */}
                {viewClass.description && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{viewClass.description}</p>
                  </div>
                )}
                {/* Vision */}
                {viewClass.vision && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Vision</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{viewClass.vision}</p>
                  </div>
                )}
                {/* Mission */}
                {viewClass.mission && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Mission</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{viewClass.mission}</p>
                  </div>
                )}
                {/* Intro Video */}
                {viewClass.introVideoUrl && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Intro Video</p>
                    <a href={viewClass.introVideoUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-500 hover:underline break-all">{viewClass.introVideoUrl}</a>
                  </div>
                )}
                {/* Buttons */}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setViewClass(null); openEdit(viewClass); }} className="flex-1 py-2.5 rounded-xl bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100 transition">
                    Edit
                  </button>
                  <Link to={`/admin/classes/${viewClass.id}`} onClick={() => setViewClass(null)} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition text-center">
                    Manage
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Edit/Create Modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="min-h-full flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 rounded-t-2xl">
              <div>
                <h2 className="font-bold text-slate-800">{editingClass ? 'Edit Class' : 'New Class'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editingClass ? 'Update class details' : 'Create a new class'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              {error && <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600"><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Class Name</label>
                <input type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Physics Grade 12" required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                <input type="text" value={form.subject} onChange={e => update('subject', e.target.value)} placeholder="e.g. Physics"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Monthly Fee (Rs.)</label>
                  <input type="number" value={form.monthlyFee} onChange={e => update('monthlyFee', e.target.value)} placeholder="e.g. 2500"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Visibility</label>
                  <select value={form.status} onChange={e => update('status', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    {VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Thumbnail URL</label>
                <div className="space-y-2">
                  <input type="text" value={form.thumbnail} onChange={e => update('thumbnail', e.target.value)} placeholder="https://..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={e => handleThumbnailFileChange(e.target.files?.[0])}
                      />
                      {uploadingThumbnail ? 'Uploading...' : 'Upload Image'}
                    </label>
                    <span className="text-[11px] text-slate-400">JPEG/PNG/WebP/GIF up to 5MB</span>
                  </div>
                  {form.thumbnail && (
                    <img src={form.thumbnail} alt="Class thumbnail preview" className="w-full max-h-28 object-cover rounded-xl border border-slate-200" />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Intro Video URL</label>
                <input type="text" value={form.introVideoUrl} onChange={e => update('introVideoUrl', e.target.value)} placeholder="https://..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Brief class description..." rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Vision</label>
                <textarea value={form.vision} onChange={e => update('vision', e.target.value)} placeholder="Class vision..." rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mission</label>
                <textarea value={form.mission} onChange={e => update('mission', e.target.value)} placeholder="Class mission..." rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={saving || uploadingThumbnail} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {saving ? 'Saving...' : editingClass ? 'Save Changes' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      , document.body)}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <p className="text-sm font-medium text-slate-500">No classes yet</p>
            <p className="text-xs text-slate-400 mt-1">Create your first class to get started</p>
          </div>
        ) : (
          <StickyDataTable
            columns={classColumns}
            rows={classes}
            getRowId={(row) => row.id}
            tableHeight="calc(100vh - 300px)"
            storageKey="admin-classes-columns"
          />
        )}
      </div>
    </div>
  );
}


