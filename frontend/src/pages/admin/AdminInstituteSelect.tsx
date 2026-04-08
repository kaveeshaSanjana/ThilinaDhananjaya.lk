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
    <div className="w-full px-4 sm:px-6 py-6 space-y-6 animate-fade-in">
      {showCreate && (
        <CreateInstituteModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Admin Setup</p>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Select an Institute</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Choose the institute you want to manage for this session. After selection, the existing pages will work as they do now.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-bold hover:from-indigo-700 hover:to-blue-700 shadow-lg shadow-indigo-500/20 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Create Institute
        </button>
      </div>

      {institutes.length === 0 ? (
        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm p-8 sm:p-10 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-[hsl(var(--muted))] flex items-center justify-center">
            <svg className="w-8 h-8 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">No institute found</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Use the Create Institute button above to add your first institute.</p>
          </div>
        </div>
      ) : (
        <div className="grid [grid-template-columns:repeat(auto-fit,minmax(310px,370px))] justify-center sm:justify-start gap-5">
          {institutes.map((institute, idx) => (
            <button
              key={institute.id}
              type="button"
              onClick={() => {
                select(institute.id);
                navigate(redirect && redirect.startsWith('/') ? redirect : getInstituteAdminPath(institute.id));
              }}
              className={`relative w-full max-w-[370px] flex flex-col rounded-xl bg-white bg-clip-border text-gray-700 shadow-md border border-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg text-left ${
                selected?.id === institute.id
                  ? 'ring-2 ring-indigo-500/20 border-indigo-300'
                  : ''
              }`}
            >
              <div className={`relative mx-3 mt-3 h-36 overflow-hidden rounded-xl bg-clip-border text-white shadow-lg shadow-blue-gray-500/30 bg-gradient-to-r ${gradients[idx % gradients.length]}`}>
                {institute.logoUrl ? (
                  <img src={institute.logoUrl} alt={institute.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white/30 text-7xl font-black">{institute.name?.[0]?.toUpperCase() || 'I'}</span>
                  </div>
                )}
                {institute.isOwner && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-white/90 text-indigo-700">
                    Owner
                  </span>
                )}
                {selected?.id === institute.id && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-emerald-500 text-white">
                    Current
                  </span>
                )}
              </div>

              <div className="p-4">
                <h5 className="mb-1.5 block text-lg font-semibold leading-snug tracking-normal text-slate-900 truncate">
                  {institute.name}
                </h5>
                <p className="block text-sm font-light leading-relaxed text-slate-600 line-clamp-2 min-h-[40px]">
                  {institute.description || institute.address || institute.phone || institute.slug || 'No institute details available yet.'}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs gap-2">
                  <span className="inline-block px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold uppercase tracking-wide truncate max-w-[58%]">
                    {institute.slug}
                  </span>
                  <span className="font-bold text-emerald-600">{institute._count?.classes ?? 0} Classes</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 font-semibold text-slate-600">
                    {institute._count?.users ?? 0} students
                  </span>
                  {institute.phone && <span className="truncate">{institute.phone}</span>}
                </div>
              </div>

              <div className="p-4 pt-0 mt-auto">
                <span className="block w-full select-none rounded-lg bg-blue-500 py-2.5 px-4 text-center align-middle text-[11px] font-bold uppercase text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:shadow-blue-500/35">
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