import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import StickyDataTable, { type StickyColumn } from '../../components/StickyDataTable';

const STUDENT_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING', 'OLD'];
const studentStatusBadge = (s: string) => {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    INACTIVE: 'bg-slate-100 text-slate-500',
    PENDING: 'bg-amber-100 text-amber-700',
    OLD: 'bg-purple-100 text-purple-700',
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

  const studentColumns: readonly StickyColumn<any>[] = [
    { id: 'instituteId', label: 'Student ID', minWidth: 130, render: (s) => <span className="font-mono text-xs text-blue-600 font-bold">{s.profile?.instituteId || '-'}</span> },
    {
      id: 'name',
      label: 'Name',
      minWidth: 200,
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {(s.profile?.fullName || s.email || '?')[0].toUpperCase()}
          </div>
          <span className="font-semibold text-slate-800 text-sm">{s.profile?.fullName || '-'}</span>
        </div>
      ),
    },
    { id: 'email', label: 'Email', minWidth: 220, render: (s) => <span className="text-slate-500 text-sm">{s.email}</span> },
    { id: 'phone', label: 'Phone', minWidth: 140, render: (s) => <span className="text-slate-500 text-sm">{s.profile?.phone || '-'}</span> },
    { id: 'school', label: 'School', minWidth: 160, render: (s) => <span className="text-slate-500 text-sm">{s.profile?.school || '-'}</span> },
    {
      id: 'status',
      label: 'Status',
      minWidth: 120,
      render: (s) => (
        <select value={s.profile?.status || 'PENDING'} onChange={e => handleStatusChange(s.id, e.target.value)}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer ${studentStatusBadge(s.profile?.status || 'PENDING')}`}>
          {STUDENT_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
        </select>
      ),
    },
    { id: 'joined', label: 'Joined', minWidth: 110, render: (s) => <span className="text-slate-400 text-xs">{s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span> },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 180,
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={() => openEdit(s)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Edit
          </button>
          <button onClick={() => handleDelete(s.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition">
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
          <h1 className="text-xl font-bold text-slate-800">Students</h1>
          <p className="text-slate-500 text-sm mt-0.5">{students.length} registered students</p>
        </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, ID..."
                className="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 shadow-sm transition w-full sm:w-64" />
          </div>
          <button onClick={openNew}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Student
          </button>
        </div>
      </div>

      {showForm && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="min-h-full flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 rounded-t-2xl">
              <div>
                <h2 className="font-bold text-slate-800">{editingStudent ? 'Edit Student' : 'New Student'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editingStudent ? 'Update student information' : 'Add a new student to the system'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              {error && <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600"><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} placeholder="John Doe" required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                {!editingStudent && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email <span className="text-red-500">*</span></label>
                      <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="student@email.com" required
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Password <span className="text-red-500">*</span></label>
                      <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 chars" required
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input type="text" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="07X XXXX XXX"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">WhatsApp Phone</label>
                  <input type="text" value={form.whatsappPhone} onChange={e => setForm(p => ({ ...p, whatsappPhone: e.target.value }))} placeholder="07X XXXX XXX"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                  <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Home address"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">School</label>
                  <input type="text" value={form.school} onChange={e => setForm(p => ({ ...p, school: e.target.value }))} placeholder="School name"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Occupation</label>
                  <input type="text" value={form.occupation} onChange={e => setForm(p => ({ ...p, occupation: e.target.value }))} placeholder="Student / Other"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Guardian Name</label>
                  <input type="text" value={form.guardianName} onChange={e => setForm(p => ({ ...p, guardianName: e.target.value }))} placeholder="Parent / Guardian"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Guardian Phone</label>
                  <input type="text" value={form.guardianPhone} onChange={e => setForm(p => ({ ...p, guardianPhone: e.target.value }))} placeholder="07X XXXX XXX"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Relationship</label>
                  <input type="text" value={form.relationship} onChange={e => setForm(p => ({ ...p, relationship: e.target.value }))} placeholder="e.g. Father, Mother"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {saving ? 'Saving...' : editingStudent ? 'Save Changes' : 'Create Student'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      , document.body)}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <p className="text-sm font-medium text-slate-500">{search ? 'No students match your search' : 'No students registered yet'}</p>
          </div>
        ) : (
          <StickyDataTable
            columns={studentColumns}
            rows={filtered}
            getRowId={(row) => row.id}
            tableHeight="calc(100vh - 320px)"
          />
        )}
      </div>
    </div>
  );
}


