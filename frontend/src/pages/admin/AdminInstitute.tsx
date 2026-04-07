import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { useInstitute, type Institute } from "../../context/InstituteContext";
import CropImageInput from "../../components/CropImageInput";
import { uploadImage } from "../../lib/imageUpload";

const inputCls =
  "w-full px-3 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition";

// ─── Sub-components ─────────────────────────────────────────────────────────

function CreateInstituteForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", description: "", themeColor: "#4f46e5" });
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleLogoFile = async (file: File) => {
    setLogoUploading(true); setError("");
    try { const url = await uploadImage(file, "general"); setLogoUrl(url); }
    catch (e: any) { setError(e.message || "Logo upload failed"); }
    finally { setLogoUploading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return setError("Institute name is required");
    setSaving(true); setError("");
    try {
      await api.post("/institutes", { ...form, logoUrl: logoUrl || undefined });
      onCreated();
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to create institute");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Create Your Institute</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Set up your institute to manage students and classes</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Institute Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Thilina Dhananjaya Institute" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Logo</label>
            {logoUrl && <img src={logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover mb-2 border border-[hsl(var(--border))]" />}
            <CropImageInput onFile={handleLogoFile} loading={logoUploading} label="Upload Logo" aspectRatio={1} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Phone</label>
              <input type="text" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Theme Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={form.themeColor} onChange={e => setForm(p => ({ ...p, themeColor: e.target.value }))} className="w-10 h-10 rounded-lg border border-[hsl(var(--border))] cursor-pointer bg-transparent" />
                <span className="text-sm font-mono text-[hsl(var(--muted-foreground))]">{form.themeColor}</span>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Address</label>
            <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Description</label>
            <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inputCls + " resize-none"} />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 transition-all">
          {saving ? "Creating…" : "Create Institute"}
        </button>
      </div>
    </div>
  );
}

function AdminCard({ admin, isOwner, onRemove }: { admin: any; isOwner: boolean; onRemove?: () => void }) {
  const name = admin.admin?.profile?.fullName || admin.admin?.email || "—";
  const avatar = admin.admin?.profile?.avatarUrl;
  const initials = name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[hsl(var(--muted)/0.4)] border border-[hsl(var(--border)/0.5)]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
          {avatar ? <img src={avatar} alt="" className="w-9 h-9 object-cover" /> : initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{name}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{admin.admin?.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${admin.isOwner ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
          {admin.isOwner ? "Owner" : "Admin"}
        </span>
        {isOwner && !admin.isOwner && onRemove && (
          <button onClick={onRemove} className="w-6 h-6 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminInstitute() {
  const { selected, refresh, loading: ctxLoading } = useInstitute();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<Institute & { admins?: any[]; _count?: any } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", description: "", themeColor: "" });
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleLogoFile = async (file: File) => {
    setLogoUploading(true); setError("");
    try { const url = await uploadImage(file, "general"); setLogoUrl(url); }
    catch (e: any) { setError(e.message || "Logo upload failed"); }
    finally { setLogoUploading(false); }
  };

  useEffect(() => {
    if (!selected) return;
    setLoadingDetail(true);
    api.get(`/institutes/${selected.id}`)
      .then(r => {
        setDetail(r.data);
        setForm({ name: r.data.name, phone: r.data.phone || "", address: r.data.address || "", description: r.data.description || "", themeColor: r.data.themeColor || "#4f46e5" });
        setLogoUrl(r.data.logoUrl || "");
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [selected]);

  const handleSave = async () => {
    if (!selected || !form.name.trim()) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      await api.patch(`/institutes/${selected.id}`, { ...form, logoUrl: logoUrl || undefined });
      await refresh();
      setSuccess("Institute settings saved!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const handleAddAdmin = async () => {
    if (!selected || !addEmail.trim()) return;
    setAddLoading(true); setAddError("");
    try {
      await api.post(`/institutes/${selected.id}/admins`, { email: addEmail.trim() });
      setAddEmail("");
      const r = await api.get(`/institutes/${selected.id}`);
      setDetail(r.data);
    } catch (e: any) {
      setAddError(e.response?.data?.message || "Failed to add admin");
    } finally { setAddLoading(false); }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    if (!selected) return;
    try {
      await api.delete(`/institutes/${selected.id}/admins/${adminId}`);
      const r = await api.get(`/institutes/${selected.id}`);
      setDetail(r.data);
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to remove admin");
    }
  };

  if (ctxLoading) return <div className="flex justify-center items-center h-60"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (!selected) return <CreateInstituteForm onCreated={async () => { await refresh(); navigate("/admin/institute"); }} />;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0 overflow-hidden">
            {selected.logoUrl
              ? <img src={selected.logoUrl} alt="" className="w-10 h-10 object-cover" />
              : <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">{selected.name}</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Institute Settings</p>
          </div>
        </div>
        <div className="flex gap-3 text-center">
          <div className="px-4 py-2 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
            <p className="text-lg font-bold text-[hsl(var(--foreground))]">{detail?._count?.users ?? "—"}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Students</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
            <p className="text-lg font-bold text-[hsl(var(--foreground))]">{detail?._count?.classes ?? "—"}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Classes</p>
          </div>
        </div>
      </div>

      {loadingDetail && <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}

      {!loadingDetail && (
        <>
          {/* Settings form */}
          <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm">
            <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
              <p className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Institute Details</p>
            </div>
            <div className="p-5 space-y-5">
              {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
              {success && <p className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">{success}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Institute Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Phone</label>
                  <input type="text" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Logo</label>
                  {logoUrl && <img src={logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover mb-2 border border-[hsl(var(--border))]" />}
                  <CropImageInput onFile={handleLogoFile} loading={logoUploading} label="Upload Logo" aspectRatio={1} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Theme Color</label>
                  <div className="flex gap-3 items-center mt-2">
                    <input type="color" value={form.themeColor || "#4f46e5"} onChange={e => setForm(p => ({ ...p, themeColor: e.target.value }))} className="w-12 h-12 rounded-xl border border-[hsl(var(--border))] cursor-pointer bg-transparent" />
                    <div>
                      <p className="text-sm font-mono font-bold text-[hsl(var(--foreground))]">{form.themeColor || "#4f46e5"}</p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">Used on ID cards &amp; branding</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Address</label>
                <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inputCls} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inputCls + " resize-none"} />
              </div>

              <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-sm hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 transition-all">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>

          {/* Admins section */}
          {selected.isOwner && (
            <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm">
              <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
                <p className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Admin Team</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-2.5">
                  {(detail?.admins ?? []).map((a: any) => (
                    <AdminCard key={a.id} admin={a} isOwner={selected.isOwner}
                      onRemove={() => handleRemoveAdmin(a.adminId)} />
                  ))}
                </div>
                <div className="pt-2">
                  <label className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Add Admin by Email</label>
                  {addError && <p className="text-xs text-red-500 mb-2">{addError}</p>}
                  <div className="flex gap-2">
                    <input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAddAdmin()}
                      placeholder="admin@example.com" className={inputCls + " flex-1"} />
                    <button onClick={handleAddAdmin} disabled={addLoading || !addEmail.trim()}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition flex-shrink-0">
                      {addLoading ? "…" : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
