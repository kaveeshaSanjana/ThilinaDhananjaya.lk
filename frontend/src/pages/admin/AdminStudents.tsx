import { useEffect, useState } from 'react';
import api from '../../lib/api';

const STUDENT_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING', 'OLD'];
const studentStatusBadge = (s: string) => {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    INACTIVE: 'bg-slate-100 text-slate-500 dark:bg-slate-700/30 dark:text-slate-400',
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    OLD: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return map[s] || map.ACTIVE;
};

const emptyForm = { fullName: '', email: '', password: '', phone: '', whatsappPhone: '', address: '', school: '', occupation: '', dateOfBirth: '', guardianName: '', guardianPhone: '', relationship: '' };

export default function AdminStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => { setLoading(true); api.get('/users/students').then(r => setStudents(r.data || [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const filtered = students.filter(s =>
    s.profile?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.profile?.instituteId?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm({ ...emptyForm }); setEditingStudent(null); setShowForm(true); setError(''); };
  const openEdit = (s: any) => {
    setForm({
      fullName: s.profile?.fullName || '', email: s.email, password: '',
      phone: s.profile?.phone || '', whatsappPhone: s.profile?.whatsappPhone || '',
      address: s.profile?.address || '', school: s.profile?.school || '',
      occupation: s.profile?.occupation || '',
      dateOfBirth: s.profile?.dateOfBirth ? new Date(s.profile.dateOfBirth).toISOString().split('T')[0] : '',
      guardianName: s.profile?.guardianName || '', guardianPhone: s.profile?.guardianPhone || '',
      relationship: s.profile?.relationship || '',
    });
    setEditingStudent(s); setShowForm(true); setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (editingStudent) {
        const payload: any = {
          fullName: form.fullName, phone: form.phone || undefined, whatsappPhone: form.whatsappPhone || undefined,
          address: form.address || undefined, school: form.school || undefined, occupation: form.occupation || undefined,
          dateOfBirth: form.dateOfBirth || undefined, guardianName: form.guardianName || undefined,
          guardianPhone: form.guardianPhone || undefined, relationship: form.relationship || undefined,
        };
        await api.patch(`/users/students/${editingStudent.id}/profile`, payload);
      } else {
        await api.post('/users/students', {
          fullName: form.fullName, email: form.email, password: form.password,
          phone: form.phone || undefined, whatsappPhone: form.whatsappPhone || undefined,
          address: form.address || undefined, school: form.school || undefined,
          occupation: form.occupation || undefined, dateOfBirth: form.dateOfBirth || undefined,
          guardianName: form.guardianName || undefined, guardianPhone: form.guardianPhone || undefined,
          relationship: form.relationship || undefined,
        });
      }
      setShowForm(false); setForm({ ...emptyForm }); load();
    } catch (err: any) { setError(err.response?.data?.message || 'Failed to save student'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await api.patch(`/users/students/${id}/profile`, { status }).catch(() => {}); load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student? This will remove all their data.')) return;
    await api.delete(`/users/students/${id}`).catch(() => {}); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Students</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{students.length} registered</p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, ID..."
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-64" />
          <button onClick={openNew}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Student
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{editingStudent ? 'Edit Student' : 'New Student'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} placeholder="John Doe" required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                {!editingStudent && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Email <span className="text-red-500">*</span></label>
                      <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="student@email.com" required
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Password <span className="text-red-500">*</span></label>
                      <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 chars" required
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Phone</label>
                  <input type="text" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="07X XXXX XXX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">WhatsApp Phone</label>
                  <input type="text" value={form.whatsappPhone} onChange={e => setForm(p => ({ ...p, whatsappPhone: e.target.value }))} placeholder="07X XXXX XXX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Address</label>
                  <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Home address"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">School</label>
                  <input type="text" value={form.school} onChange={e => setForm(p => ({ ...p, school: e.target.value }))} placeholder="School name"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Date of Birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Occupation</label>
                  <input type="text" value={form.occupation} onChange={e => setForm(p => ({ ...p, occupation: e.target.value }))} placeholder="Student / Other"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Guardian Name</label>
                  <input type="text" value={form.guardianName} onChange={e => setForm(p => ({ ...p, guardianName: e.target.value }))} placeholder="Parent / Guardian"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Guardian Phone</label>
                  <input type="text" value={form.guardianPhone} onChange={e => setForm(p => ({ ...p, guardianPhone: e.target.value }))} placeholder="07X XXXX XXX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Relationship</label>
                  <input type="text" value={form.relationship} onChange={e => setForm(p => ({ ...p, relationship: e.target.value }))} placeholder="e.g. Father, Mother"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {saving ? 'Saving...' : editingStudent ? 'Save' : 'Create Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">{search ? 'No students match your search' : 'No students registered yet'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Student ID</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">School</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Joined</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">{s.profile?.instituteId || '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{s.profile?.fullName || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.email}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.profile?.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.profile?.school || '—'}</td>
                    <td className="px-4 py-3">
                      <select value={s.profile?.status || 'PENDING'} onChange={e => handleStatusChange(s.id, e.target.value)}
                        className={`px-2 py-0.5 rounded text-xs font-medium border-0 cursor-pointer ${studentStatusBadge(s.profile?.status || 'PENDING')}`}>
                        {STUDENT_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openEdit(s)} className="text-blue-600 dark:text-blue-400 text-xs font-medium hover:underline">Edit</button>
                        <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-xs font-medium hover:underline">Delete</button>
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
