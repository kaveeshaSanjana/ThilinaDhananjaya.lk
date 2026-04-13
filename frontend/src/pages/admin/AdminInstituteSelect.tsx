import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import CropImageInput from '../../components/CropImageInput';
import { uploadImage } from '../../lib/imageUpload';
import { type Institute, useInstitute } from '../../context/InstituteContext';
import { getInstituteAdminPath } from '../../lib/instituteRoutes';

const inputCls = 'w-full px-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.4)] transition';
const labelCls = 'block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1';
const gradients = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-purple-500 to-violet-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
];

function CreateInstituteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (instituteId?: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    description: '',
    themeColor: '#4f46e5',
  });
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleLogoFile = async (file: File) => {
    setLogoUploading(true);
    setError('');
    try {
      const url = await uploadImage(file, 'general');
      setLogoUrl(url);
    } catch (e: any) {
      setError(e.message || 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Institute name is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/institutes', {
        ...form,
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        description: form.description.trim() || undefined,
        logoUrl: logoUrl || undefined,
      });
      const createdId = data?.id ?? data?.institute?.id;
      await onCreated(createdId);
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create institute');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-[hsl(var(--card))] rounded-2xl shadow-2xl border border-[hsl(var(--border))] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Create Institute</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

          <div>
            <label className={labelCls}>Institute Name <span className="text-red-500">*</span></label>
            <input className={inputCls} placeholder="e.g. Thilina Dhananjaya Institute" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Logo</label>
            <div className="space-y-2">
              {logoUrl && <img src={logoUrl} alt="Logo preview" className="w-14 h-14 rounded-xl object-cover border border-[hsl(var(--border))]" />}
              <div className="flex items-center gap-2 flex-wrap">
                <CropImageInput onFile={handleLogoFile} loading={logoUploading} label="Upload Logo" aspectRatio={1} cropTitle="Crop Logo" />
                <span className="text-[11px] text-[hsl(var(--muted-foreground))]">JPEG/PNG/WebP/GIF · max 5 MB</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Theme Color</label>
              <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2">
                <input type="color" value={form.themeColor} onChange={e => setForm(p => ({ ...p, themeColor: e.target.value }))} className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer" />
                <span className="text-sm font-mono text-[hsl(var(--muted-foreground))]">{form.themeColor}</span>
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Address</label>
            <input className={inputCls} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition">
              Cancel
            </button>
            <button type="submit" disabled={saving || logoUploading} className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center gap-2">
              {saving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>}
              {saving ? 'Creating...' : 'Create Institute'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function AdminInstituteSelect() {
  const { selected, select, refresh } = useInstitute();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);

  const redirect = searchParams.get('redirect');

  useEffect(() => {
    const loadInstitutes = async () => {
      setLoading(true);
      try {
        const { data } = await api.get<Institute[]>('/institutes/my');
        setInstitutes(Array.isArray(data) ? data : []);
      } catch {
        setInstitutes([]);
      } finally {
        setLoading(false);
      }
    };

    loadInstitutes();
  }, []);

  const handleCreated = async (createdId?: string) => {
    if (createdId) localStorage.setItem('selectedInstituteId', createdId);
    await refresh();
    const { data } = await api.get<Institute[]>('/institutes/my');
    setInstitutes(Array.isArray(data) ? data : []);
    if (createdId) {
      select(createdId);
      navigate(redirect && redirect.startsWith('/') ? redirect : getInstituteAdminPath(createdId));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-[3px] border-[hsl(var(--primary))] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {showCreate && (
        <CreateInstituteModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      {/* ── Hero Banner ── */}
      <div className="relative bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-2xl p-6 md:p-8 overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-indigo-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">Admin Setup</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Select an Institute</h1>
            <p className="text-slate-400 text-sm mt-1.5 max-w-md">Choose the institute you want to manage for this session.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-sm font-semibold hover:from-indigo-600 hover:to-blue-700 transition shadow-lg shadow-indigo-500/25 flex items-center gap-2 self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Create Institute
          </button>
        </div>
      </div>

      {institutes.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm p-8 sm:p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-indigo-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">No institute found</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Use the Create Institute button above to add your first institute.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {institutes.map((institute, idx) => (
            <button
              key={institute.id}
              type="button"
              onClick={() => {
                select(institute.id);
                navigate(redirect && redirect.startsWith('/') ? redirect : getInstituteAdminPath(institute.id));
              }}
              className={`group relative w-full flex flex-col overflow-hidden rounded-2xl bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-left ${
                selected?.id === institute.id
                  ? 'ring-2 ring-indigo-500/40'
                  : 'hover:ring-[hsl(var(--ring))]/30'
              }`}
            >
              <div className={`relative h-36 overflow-hidden rounded-t-2xl text-white bg-gradient-to-r ${gradients[idx % gradients.length]}`}>
                {institute.logoUrl ? (
                  <img src={institute.logoUrl} alt={institute.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white/20 text-6xl font-black">{institute.name?.[0]?.toUpperCase() || 'I'}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                {institute.isOwner && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-white/90 text-indigo-700 backdrop-blur-sm">
                    Owner
                  </span>
                )}
                {selected?.id === institute.id && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-emerald-500 text-white">
                    Current
                  </span>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col bg-[linear-gradient(160deg,hsl(var(--card))_0%,hsl(var(--card)/0.97)_100%)]">
                <h5 className="mb-1 text-base font-extrabold text-[hsl(var(--foreground))] truncate">
                  {institute.name}
                </h5>
                <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2 min-h-[36px]">
                  {institute.description || institute.address || institute.phone || institute.slug || 'No details available.'}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs gap-2">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wide truncate max-w-[55%]">
                    {institute.slug}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{institute._count?.classes ?? 0} Classes</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <span className="px-2 py-0.5 rounded-md bg-[hsl(var(--muted))] font-semibold text-[hsl(var(--foreground))]/80">
                    {institute._count?.users ?? 0} students
                  </span>
                  {institute.phone && <span className="truncate">{institute.phone}</span>}
                </div>
              </div>

              <div className="p-3 pt-0 mt-auto">
                <span className="block w-full select-none rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 py-2.5 text-center text-[11px] font-bold uppercase text-white shadow-md shadow-indigo-500/20 group-hover:shadow-lg group-hover:from-indigo-600 group-hover:to-blue-700 transition-all">
                  Select Institute
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}