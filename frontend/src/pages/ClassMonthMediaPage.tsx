import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getInstitutePath } from '../lib/instituteRoutes';

/* ─── Types ────────────────────────────────────────────── */

type MediaType = 'PDF' | 'IMAGE' | 'LINK' | 'DOCUMENT' | 'OTHER';
type MediaStatus = 'ANYONE' | 'STUDENTS_ONLY' | 'PAID_ONLY' | 'PRIVATE' | 'INACTIVE';

interface MediaItem {
  id: string;
  monthId: string;
  title: string;
  description?: string | null;
  fileUrl: string;
  mediaType: MediaType;
  thumbnail?: string | null;
  size?: number | null;
  order: number;
  status: MediaStatus;
  createdAt: string;
}

/* ─── Helpers ─────────────────────────────────────────── */

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MEDIA_TYPE_META: Record<MediaType, { label: string; icon: React.ReactNode; colorCls: string; bgCls: string }> = {
  PDF:      { label: 'PDF',      colorCls: 'text-red-600',    bgCls: 'bg-red-50 border-red-200',    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg> },
  IMAGE:    { label: 'Image',    colorCls: 'text-emerald-600', bgCls: 'bg-emerald-50 border-emerald-200', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg> },
  LINK:     { label: 'Link',     colorCls: 'text-blue-600',   bgCls: 'bg-blue-50 border-blue-200',   icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg> },
  DOCUMENT: { label: 'Document', colorCls: 'text-amber-600',  bgCls: 'bg-amber-50 border-amber-200',  icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg> },
  OTHER:    { label: 'File',     colorCls: 'text-slate-600',  bgCls: 'bg-slate-50 border-slate-200',  icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.375" /></svg> },
};

const VIS_MAP: Record<MediaStatus, { label: string; cls: string }> = {
  ANYONE:        { label: '🌍 Anyone',        cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  STUDENTS_ONLY: { label: '🎓 Students Only', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  PAID_ONLY:     { label: '💳 Paid Only',     cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  PRIVATE:       { label: '🔒 Private',       cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  INACTIVE:      { label: '⏸ Inactive',      cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

/* ─── Media Card ───────────────────────────────────────── */

function MediaCard({
  item,
  isAdmin,
  onEdit,
  onDelete,
}: {
  item: MediaItem;
  isAdmin: boolean;
  onEdit: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}) {
  const meta = MEDIA_TYPE_META[item.mediaType] ?? MEDIA_TYPE_META.OTHER;
  const vis = VIS_MAP[item.status] ?? { label: item.status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden shadow-sm hover:shadow-md transition-all group">
      {/* Thumbnail or type placeholder */}
      {item.thumbnail ? (
        <div className="h-36 overflow-hidden">
          <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      ) : (
        <div className={`h-28 flex items-center justify-center border-b border-[hsl(var(--border))] ${meta.bgCls}`}>
          <span className={`${meta.colorCls} opacity-60`}>
            <span className="scale-[2] inline-block">{meta.icon}</span>
          </span>
        </div>
      )}

      <div className="p-4">
        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${meta.bgCls} ${meta.colorCls}`}>
            {meta.icon}
            {meta.label}
          </span>
          {isAdmin && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${vis.cls}`}>
              {vis.label}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-[hsl(var(--foreground))] leading-snug mb-1 line-clamp-2">{item.title}</h3>
        {item.description && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 leading-relaxed line-clamp-2">{item.description}</p>
        )}

        {/* Size */}
        {item.size != null && (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-3">Size: {fmtBytes(item.size)}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto">
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition ${meta.bgCls} ${meta.colorCls} hover:opacity-80`}
          >
            {item.mediaType === 'LINK' ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            )}
            {item.mediaType === 'LINK' ? 'Open Link' : 'Download'}
          </a>

          {isAdmin && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEdit(item)}
                className="p-2 rounded-xl text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition"
                title="Edit"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button
                onClick={() => onDelete(item)}
                className="p-2 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared styles ─────────────────────────────────────── */

const inputCls = 'w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/30 focus:border-[hsl(var(--ring))] transition';
const labelCls = 'block text-sm font-semibold text-[hsl(var(--foreground))]/80 mb-1.5';
const sectionCls = 'bg-[hsl(var(--muted))]/50 rounded-2xl p-4 space-y-4 ring-1 ring-[hsl(var(--border))]/50';
const sectionLabelCls = 'text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest';

/* ─── Create Media Modal ───────────────────────────────── */

const EMPTY_FORM = {
  title: '',
  description: '',
  fileUrl: '',
  mediaType: 'PDF' as MediaType,
  thumbnail: '',
  size: '',
  order: '0',
  status: 'STUDENTS_ONLY' as MediaStatus,
};

function CreateMediaModal({
  monthId,
  onClose,
  onCreated,
}: {
  monthId: string;
  onClose: () => void;
  onCreated: (item: MediaItem) => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setErr('Title is required'); return; }
    if (!form.fileUrl.trim()) { setErr('File URL is required'); return; }
    setSaving(true); setErr('');
    try {
      const body: Record<string, unknown> = {
        monthId,
        title: form.title.trim(),
        fileUrl: form.fileUrl.trim(),
        mediaType: form.mediaType,
        status: form.status,
        order: Number(form.order) || 0,
      };
      if (form.description.trim()) body.description = form.description.trim();
      if (form.thumbnail.trim())   body.thumbnail   = form.thumbnail.trim();
      if (form.size)               body.size        = Number(form.size);
      const res = await api.post('/media', body);
      onCreated(res.data?.media ?? res.data);
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Failed to create study material');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl bg-[hsl(var(--card))] rounded-2xl shadow-2xl border border-[hsl(var(--border))] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">Add Study Material</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Upload a PDF, link, image, or document for this month</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">
            {err && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                <p className="text-sm text-red-500">{err}</p>
              </div>
            )}

            {/* Details */}
            <div className={sectionCls}>
              <p className={sectionLabelCls}>Details</p>
              <div>
                <label className={labelCls}>Title <span className="text-red-500">*</span></label>
                <input className={inputCls} placeholder="e.g. Chapter 3 Grammar Paper" value={form.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Optional description..." value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <select className={inputCls} value={form.mediaType} onChange={e => set('mediaType', e.target.value)}>
                  <option value="PDF">PDF</option>
                  <option value="IMAGE">Image</option>
                  <option value="LINK">Link / URL</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            {/* File */}
            <div className={sectionCls}>
              <p className={sectionLabelCls}>File / URL</p>
              <div>
                <label className={labelCls}>
                  {form.mediaType === 'LINK' ? 'URL' : 'File URL'} <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputCls}
                  placeholder={form.mediaType === 'LINK' ? 'https://example.com/resource' : 'https://files.example.com/paper.pdf'}
                  value={form.fileUrl}
                  onChange={e => set('fileUrl', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Thumbnail URL</label>
                <input className={inputCls} placeholder="https://example.com/thumbnail.jpg (optional)" value={form.thumbnail} onChange={e => set('thumbnail', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>File Size (bytes)</label>
                <input type="number" min={0} className={inputCls} placeholder="e.g. 204800 for 200 KB" value={form.size} onChange={e => set('size', e.target.value)} />
              </div>
            </div>

            {/* Settings */}
            <div className={sectionCls}>
              <p className={sectionLabelCls}>Settings</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Visibility</label>
                  <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
                    <option value="ANYONE">Anyone</option>
                    <option value="STUDENTS_ONLY">Students Only</option>
                    <option value="PAID_ONLY">Paid Only</option>
                    <option value="PRIVATE">Private</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Display Order</label>
                  <input type="number" min={0} className={inputCls} placeholder="0" value={form.order} onChange={e => set('order', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-2 pb-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm font-semibold hover:bg-[hsl(var(--muted))] transition">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-semibold hover:from-purple-600 hover:to-indigo-700 transition shadow-lg shadow-purple-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {saving ? 'Adding...' : 'Add Material'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ─── Edit Media Modal ─────────────────────────────────── */

function EditMediaModal({
  item,
  onClose,
  onUpdated,
}: {
  item: MediaItem;
  onClose: () => void;
  onUpdated: (updated: MediaItem) => void;
}) {
  const [form, setForm] = useState({
    title: item.title,
    description: item.description ?? '',
    fileUrl: item.fileUrl,
    mediaType: item.mediaType,
    thumbnail: item.thumbnail ?? '',
    size: item.size != null ? String(item.size) : '',
    order: String(item.order),
    status: item.status,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setErr('Title is required'); return; }
    if (!form.fileUrl.trim()) { setErr('File URL is required'); return; }
    setSaving(true); setErr('');
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        fileUrl: form.fileUrl.trim(),
        mediaType: form.mediaType,
        status: form.status,
        order: Number(form.order) || 0,
        description: form.description.trim() || null,
        thumbnail: form.thumbnail.trim() || null,
        size: form.size ? Number(form.size) : null,
      };
      const res = await api.patch(`/media/${item.id}`, body);
      onUpdated(res.data?.media ?? res.data);
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Failed to update study material');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl bg-[hsl(var(--card))] rounded-2xl shadow-2xl border border-[hsl(var(--border))] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">Edit Study Material</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Update the details for this material</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">
            {err && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                <p className="text-sm text-red-500">{err}</p>
              </div>
            )}

            {/* Details */}
            <div className={sectionCls}>
              <p className={sectionLabelCls}>Details</p>
              <div>
                <label className={labelCls}>Title <span className="text-red-500">*</span></label>
                <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <select className={inputCls} value={form.mediaType} onChange={e => set('mediaType', e.target.value)}>
                  <option value="PDF">PDF</option>
                  <option value="IMAGE">Image</option>
                  <option value="LINK">Link / URL</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            {/* File */}
            <div className={sectionCls}>
              <p className={sectionLabelCls}>File / URL</p>
              <div>
                <label className={labelCls}>
                  {form.mediaType === 'LINK' ? 'URL' : 'File URL'} <span className="text-red-500">*</span>
                </label>
                <input className={inputCls} value={form.fileUrl} onChange={e => set('fileUrl', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Thumbnail URL</label>
                <input className={inputCls} placeholder="Optional" value={form.thumbnail} onChange={e => set('thumbnail', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>File Size (bytes)</label>
                <input type="number" min={0} className={inputCls} placeholder="Optional" value={form.size} onChange={e => set('size', e.target.value)} />
              </div>
            </div>

            {/* Settings */}
            <div className={sectionCls}>
              <p className={sectionLabelCls}>Settings</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Visibility</label>
                  <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
                    <option value="ANYONE">Anyone</option>
                    <option value="STUDENTS_ONLY">Students Only</option>
                    <option value="PAID_ONLY">Paid Only</option>
                    <option value="PRIVATE">Private</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Display Order</label>
                  <input type="number" min={0} className={inputCls} value={form.order} onChange={e => set('order', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-2 pb-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm font-semibold hover:bg-[hsl(var(--muted))] transition">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-semibold hover:from-purple-600 hover:to-indigo-700 transition shadow-lg shadow-purple-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ─── Delete Confirm Modal ─────────────────────────────── */

function DeleteMediaModal({
  item,
  onClose,
  onDeleted,
}: {
  item: MediaItem;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  const handleDelete = async () => {
    setDeleting(true); setErr('');
    try {
      await api.delete(`/media/${item.id}`);
      onDeleted(item.id);
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Failed to delete');
      setDeleting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-[hsl(var(--card))] rounded-2xl shadow-2xl border border-[hsl(var(--border))] p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-100 mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-[hsl(var(--foreground))] text-center mb-1">Delete Material</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] text-center mb-5">
          Are you sure you want to delete <span className="font-semibold text-[hsl(var(--foreground))]">"{item.title}"</span>? This cannot be undone.
        </p>
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{err}</p>}
        <div className="flex items-center gap-3">
          <button onClick={onClose} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] transition">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition flex items-center justify-center gap-2">
            {deleting && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════ */
/*              CLASS MONTH MEDIA PAGE                    */
/* ═══════════════════════════════════════════════════════ */

export default function ClassMonthMediaPage() {
  const { classId, monthId, instituteId } = useParams<{ classId: string; monthId: string; instituteId: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [monthName, setMonthName]   = useState('');
  const [classData, setClassData]   = useState<any>(null);
  const [allMonths, setAllMonths]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // Modal state
  const [showCreate, setShowCreate]           = useState(false);
  const [editItem, setEditItem]               = useState<MediaItem | null>(null);
  const [deleteItem, setDeleteItem]           = useState<MediaItem | null>(null);

  /* ─── Fetch ─────────────────────────────────────────── */

  useEffect(() => {
    if (!monthId || !classId) return;
    const fetchData = async () => {
      setLoading(true); setError('');
      try {
        const [mediaRes, classRes, monthsRes] = await Promise.all([
          api.get(`/media/month/${monthId}`),
          api.get(`/classes/${classId}`),
          api.get(`/classes/${classId}/months`),
        ]);
        const items: MediaItem[] = mediaRes.data?.media ?? mediaRes.data ?? [];
        // Sort by order then createdAt
        items.sort((a, b) => a.order - b.order || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMediaItems(items);
        const cls = classRes.data?.class ?? classRes.data;
        setClassData(cls);
        const months: any[] = monthsRes.data || [];
        setAllMonths(months);
        // Find month name
        const month = months.find((m: any) => m.id === monthId);
        if (month) setMonthName(month.name);
      } catch {
        setError('Failed to load study materials');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [monthId, classId]);

  /* ─── Handlers ──────────────────────────────────────── */

  const handleCreated = (item: MediaItem) => {
    setMediaItems(prev => {
      const next = [...prev, item];
      next.sort((a, b) => a.order - b.order || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return next;
    });
    setShowCreate(false);
  };

  const handleUpdated = (updated: MediaItem) => {
    setMediaItems(prev => {
      const next = prev.map(it => it.id === updated.id ? updated : it);
      next.sort((a, b) => a.order - b.order || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return next;
    });
    setEditItem(null);
  };

  const handleDeleted = (id: string) => {
    setMediaItems(prev => prev.filter(it => it.id !== id));
    setDeleteItem(null);
  };

  /* ─── Render ─────────────────────────────────────────── */

  const resolvedInstId = instituteId || classData?.instituteId || classData?.institute?.id || null;
  const mkPath = (suffix: string) => getInstitutePath(resolvedInstId, suffix);

  const monthGradients = [
    'from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600', 'from-purple-500 to-violet-600',
    'from-rose-500 to-pink-600',   'from-cyan-500 to-sky-600',
    'from-fuchsia-500 to-pink-600','from-lime-500 to-green-600',
  ];

  const subNavItems: { label: string; icon: string; to: string; active?: boolean }[] = [
    { label: 'Recordings',      icon: '🎬', to: mkPath(`/classes/${classId}/months/${monthId}`) },
    { label: 'Live Lessons',    icon: '📡', to: mkPath(`/classes/${classId}/months/${monthId}/live-lessons`) },
    { label: 'Study Materials', icon: '📚', to: mkPath(`/classes/${classId}/months/${monthId}/media`), active: true },
    ...(isAdmin ? [{ label: 'Attendance', icon: '📅', to: mkPath(`/classes/${classId}/physical-attendance`) }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        to={mkPath(`/classes/${classId}`)}
        className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition font-medium group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to class
      </Link>

      <div className="flex gap-6 mt-6">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col gap-4 w-60 shrink-0">
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] px-2 mb-2">This Month</p>
            <div className="space-y-0.5">
              {subNavItems.map(item => (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${item.active ? 'bg-purple-50 text-purple-700 font-semibold ring-1 ring-purple-200' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'}`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          {allMonths.length > 0 && (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] px-2 mb-2">All Months</p>
              <div className="space-y-0.5 max-h-72 overflow-y-auto">
                {allMonths.map((m: any, idx: number) => {
                  const isAct = m.id === monthId;
                  const grad = monthGradients[idx % monthGradients.length];
                  return (
                    <Link
                      key={m.id}
                      to={mkPath(`/classes/${classId}/months/${m.id}/media`)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${isAct ? 'bg-purple-50 text-purple-700 font-semibold ring-1 ring-purple-200' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'}`}
                    >
                      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 text-white text-[9px] font-bold`}>
                        {idx + 1}
                      </div>
                      <span className="truncate font-medium">{m.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Mobile sub-nav */}
          <div className="flex gap-2 lg:hidden overflow-x-auto pb-1">
            {subNavItems.map(item => (
              <Link
                key={item.label}
                to={item.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${item.active ? 'bg-purple-50 text-purple-700 font-semibold ring-1 ring-purple-200' : 'bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] border border-[hsl(var(--border))]'}`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <div>
            {classData?.name && <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{classData.name}</p>}
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">{monthName || 'Study Materials'}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              {loading ? 'Loading...' : `${mediaItems.length} material${mediaItems.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 shadow-lg shadow-purple-500/20 transition-all shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Add Material
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <svg className="w-8 h-8 animate-spin text-[hsl(var(--muted-foreground))]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-red-50 border border-red-200 text-red-700">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && mediaItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-[hsl(var(--foreground))] mb-1">No study materials yet</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-xs">
            {isAdmin
              ? 'Add PDFs, papers, images, or links for students to access.'
              : 'No study materials have been added for this month yet.'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 shadow-lg shadow-purple-500/20 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              Add First Material
            </button>
          )}
        </div>
      )}

      {/* Media grid */}
      {!loading && !error && mediaItems.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mediaItems.map(item => (
            <MediaCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onEdit={setEditItem}
              onDelete={setDeleteItem}
            />
          ))}
        </div>
      )}

          {/* Modals */}
          {showCreate && monthId && (
            <CreateMediaModal monthId={monthId} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
          )}
          {editItem && (
            <EditMediaModal item={editItem} onClose={() => setEditItem(null)} onUpdated={handleUpdated} />
          )}
          {deleteItem && (
            <DeleteMediaModal item={deleteItem} onClose={() => setDeleteItem(null)} onDeleted={handleDeleted} />
          )}
        </div>
      </div>
    </div>
  );
}
