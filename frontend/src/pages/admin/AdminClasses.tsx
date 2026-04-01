import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

const VISIBILITY_OPTIONS = ['ANYONE', 'STUDENTS_ONLY', 'PAID_ONLY', 'PRIVATE', 'INACTIVE'];
const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    ANYONE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    STUDENTS_ONLY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PAID_ONLY: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    PRIVATE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    INACTIVE: 'bg-slate-100 text-slate-500 dark:bg-slate-700/30 dark:text-slate-400',
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Classes</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{classes.length} classes</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Class
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{editingClass ? 'Edit Class' : 'New Class'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Class Name</label>
                <input type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Physics Grade 12" required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Subject</label>
                <input type="text" value={form.subject} onChange={e => update('subject', e.target.value)} placeholder="e.g. Physics"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Monthly Fee (Rs.)</label>
                  <input type="number" value={form.monthlyFee} onChange={e => update('monthlyFee', e.target.value)} placeholder="e.g. 2500"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Visibility</label>
                  <select value={form.status} onChange={e => update('status', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    {VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Thumbnail URL</label>
                <input type="text" value={form.thumbnail} onChange={e => update('thumbnail', e.target.value)} placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Intro Video URL</label>
                <input type="text" value={form.introVideoUrl} onChange={e => update('introVideoUrl', e.target.value)} placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>
                <textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Brief class description..." rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Vision</label>
                <textarea value={form.vision} onChange={e => update('vision', e.target.value)} placeholder="Class vision..." rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Mission</label>
                <textarea value={form.mission} onChange={e => update('mission', e.target.value)} placeholder="Class mission..." rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {saving ? 'Saving...' : editingClass ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : classes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No classes yet. Create your first class to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Class</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Subject</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Monthly Fee</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {classes.map((cls: any) => (
                  <tr key={cls.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {cls.thumbnail ? (
                          <img src={cls.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-bold">{cls.name?.[0]?.toUpperCase() || 'C'}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{cls.name}</p>
                          {cls.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{cls.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{cls.subject || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300 font-medium">{cls.monthlyFee != null ? `Rs. ${Number(cls.monthlyFee).toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge(cls.status || 'ANYONE')}`}>{(cls.status || 'ANYONE').replace(/_/g, ' ')}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link to={`/admin/classes/${cls.id}`} className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-medium">Manage</Link>
                        <button onClick={() => openEdit(cls)} className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium">Edit</button>
                        <button onClick={() => handleDelete(cls.id)} className="text-red-500 hover:underline text-xs font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
