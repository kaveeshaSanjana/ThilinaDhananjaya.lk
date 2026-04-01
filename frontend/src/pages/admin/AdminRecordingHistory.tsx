import { useEffect, useState } from 'react';
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

const emptyForm = { classId: '', monthId: '', title: '', description: '', videoUrl: '', thumbnail: '', topic: '', icon: '', materials: '', status: 'PAID_ONLY' };

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

  const load = () => { setLoading(true); Promise.all([
    api.get('/recordings').then(r => setRecordings(r.data)).catch(() => {}),
    api.get('/classes').then(r => setClasses(r.data)).catch(() => {}),
  ]).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (form.classId) {
      api.get(`/classes/${form.classId}/months`).then(r => setMonths(r.data)).catch(() => setMonths([]));
    } else { setMonths([]); }
  }, [form.classId]);

  const openNew = () => { setForm({ ...emptyForm }); setEditingRec(null); setShowForm(true); setError(''); };
  const openEdit = (rec: any) => {
    setForm({
      classId: rec.month?.classId || '', monthId: rec.monthId || '', title: rec.title,
      description: rec.description || '', videoUrl: rec.videoUrl, thumbnail: rec.thumbnail || '',
      topic: rec.topic || '', icon: rec.icon || '', materials: rec.materials || '',
      status: rec.status || 'PAID_ONLY',
    });
    setEditingRec(rec); setShowForm(true); setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload: any = {
        title: form.title, videoUrl: form.videoUrl, status: form.status,
        description: form.description || undefined, thumbnail: form.thumbnail || undefined,
        topic: form.topic || undefined, icon: form.icon || undefined,
        materials: form.materials || undefined,
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recording?')) return;
    await api.delete(`/recordings/${id}`).catch(() => {}); load();
  };

  let filtered = recordings;
  if (filterClass) filtered = filtered.filter(r => r.month?.classId === filterClass);
  if (filterStatus) filtered = filtered.filter(r => r.status === filterStatus);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Recordings</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{recordings.length} total</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Recording
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{editingRec ? 'Edit Recording' : 'Add Recording'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Class</label>
                  <select value={form.classId} onChange={e => { update('classId', e.target.value); update('monthId', ''); }} required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="">Select class</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Month</label>
                  <select value={form.monthId} onChange={e => update('monthId', e.target.value)} required disabled={!form.classId}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50">
                    <option value="">{form.classId ? 'Select month' : 'Select class first'}</option>
                    {months.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Title</label>
                  <input type="text" value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Lesson 01" required
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
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Video URL</label>
                <input type="text" value={form.videoUrl} onChange={e => update('videoUrl', e.target.value)} placeholder="https://..." required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Thumbnail URL</label>
                <input type="text" value={form.thumbnail} onChange={e => update('thumbnail', e.target.value)} placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Topic</label>
                  <input type="text" value={form.topic} onChange={e => update('topic', e.target.value)} placeholder="Topic name"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Icon</label>
                  <input type="text" value={form.icon} onChange={e => update('icon', e.target.value)} placeholder="Icon name/URL"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>
                <textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Optional notes..." rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Materials (JSON or links)</label>
                <textarea value={form.materials} onChange={e => update('materials', e.target.value)} placeholder='e.g. ["https://file1.pdf"]' rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {saving ? 'Saving...' : editingRec ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterClass('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!filterClass ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
            All Classes
          </button>
          {classes.map((c: any) => (
            <button key={c.id} onClick={() => setFilterClass(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterClass === c.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterStatus('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!filterStatus ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
            All Statuses
          </button>
          {VISIBILITY_OPTIONS.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No recordings found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Recording</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Class</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Month</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((rec: any) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {rec.thumbnail ? (
                          <img src={rec.thumbnail} alt="" className="w-16 h-10 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-10 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{rec.title}</p>
                          {rec.topic && <p className="text-xs text-slate-400 truncate">{rec.topic}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{rec.month?.class?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{rec.month?.name || '—'}</td>
                    <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge(rec.status || 'PAID_ONLY')}`}>{(rec.status || 'PAID_ONLY').replace(/_/g, ' ')}</span></td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openEdit(rec)} className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium">Edit</button>
                        {rec.videoUrl && <a href={rec.videoUrl} target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-medium">View</a>}
                        <button onClick={() => handleDelete(rec.id)} className="text-red-500 hover:underline text-xs font-medium">Delete</button>
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
