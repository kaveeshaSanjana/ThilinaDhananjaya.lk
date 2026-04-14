import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import api from '../../lib/api';
import { uploadImage, uploadStudentAvatar } from '../../lib/imageUpload';
import CropImageInput from '../../components/CropImageInput';
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

const emptyForm = {
  fullName: '',
  instituteUserId: '',
  barcodeId: '',
  email: '',
  password: '',
  phone: '',
  whatsappPhone: '',
  address: '',
  school: '',
  occupation: '',
  gender: '',
  dateOfBirth: '',
  guardianName: '',
  guardianPhone: '',
  relationship: '',
  avatarUrl: '',
};
const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

export default function AdminStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [viewStudent, setViewStudent] = useState<any>(null);
  const [imageCardStudent, setImageCardStudent] = useState<any>(null);
  const [showExport, setShowExport] = useState(false);
  const [exportCols, setExportCols] = useState<string[]>(['instituteId', 'barcodeId', 'fullName', 'email', 'phone', 'status']);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const EXPORT_COLUMNS = [
    { key: 'userId',         label: 'User ID' },
    { key: 'instituteId',    label: 'Student ID' },
    { key: 'fullName',       label: 'Full Name' },
    { key: 'email',          label: 'Email' },
    { key: 'phone',          label: 'Phone' },
    { key: 'whatsappPhone',  label: 'WhatsApp' },
    { key: 'status',         label: 'Status' },
    { key: 'school',         label: 'School' },
    { key: 'address',        label: 'Address' },
    { key: 'occupation',     label: 'Occupation' },
    { key: 'dateOfBirth',    label: 'Date of Birth' },
    { key: 'guardianName',   label: 'Guardian Name' },
    { key: 'guardianPhone',  label: 'Guardian Phone' },
    { key: 'relationship',   label: 'Relationship' },
    { key: 'gender',         label: 'Gender' },
    { key: 'barcodeId',      label: 'Barcode ID' },
    { key: 'joined',         label: 'Joined Date' },
  ];

  const toggleExportCol = (key: string) =>
    setExportCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const getCellValue = (s: any, key: string): string => {
    switch (key) {
      case 'userId':        return s.id || '';
      case 'instituteId':   return s.profile?.instituteId || '';
      case 'fullName':      return s.profile?.fullName || '';
      case 'email':         return s.email || '';
      case 'phone':         return s.profile?.phone || '';
      case 'whatsappPhone': return s.profile?.whatsappPhone || '';
      case 'status':        return s.profile?.status || '';
      case 'school':        return s.profile?.school || '';
      case 'address':       return s.profile?.address || '';
      case 'occupation':    return s.profile?.occupation || '';
      case 'dateOfBirth':   return s.profile?.dateOfBirth ? new Date(s.profile.dateOfBirth).toLocaleDateString('en-GB') : '';
      case 'guardianName':  return s.profile?.guardianName || '';
      case 'guardianPhone': return s.profile?.guardianPhone || '';
      case 'relationship':  return s.profile?.relationship || '';
      case 'gender':        return s.profile?.gender || '';
      case 'barcodeId':     return s.profile?.barcodeId || '';
      case 'joined':        return s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-GB') : '';
      default: return '';
    }
  };

  const handleExport = () => {
    if (exportCols.length === 0) return;
    const headers = exportCols.map(k => EXPORT_COLUMNS.find(c => c.key === k)?.label || k);
    const rows = students.map(s => exportCols.map(k => getCellValue(s, k)));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Auto column widths
    ws['!cols'] = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] || '').length));
      return { wch: Math.min(maxLen + 2, 40) };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `students_${date}.xlsx`);
    setShowExport(false);
  };

  const load = useCallback((searchTerm?: string) => {
    setLoading(true);
    const params: any = { limit: 200 };
    if (searchTerm) params.search = searchTerm;
    api.get('/users/students', { params })
      .then(r => {
        const res = r.data;
        if (res?.data) { setStudents(res.data); setTotalStudents(res.total); }
        else { setStudents(Array.isArray(res) ? res : []); setTotalStudents(Array.isArray(res) ? res.length : 0); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value), 300);
  };

  const openNew = () => { setForm({ ...emptyForm }); setEditingStudent(null); setShowForm(true); setError(''); };
  const openEdit = (s: any) => {
    setForm({
      fullName: s.profile?.fullName || '',
      instituteUserId: s.profile?.instituteId || '',
      barcodeId: s.profile?.barcodeId || '',
      email: s.email,
      password: '',
      phone: s.profile?.phone || '', whatsappPhone: s.profile?.whatsappPhone || '',
      address: s.profile?.address || '', school: s.profile?.school || '',
      occupation: s.profile?.occupation || '',
      gender: s.profile?.gender || '',
      dateOfBirth: s.profile?.dateOfBirth ? new Date(s.profile.dateOfBirth).toISOString().split('T')[0] : '',
      guardianName: s.profile?.guardianName || '', guardianPhone: s.profile?.guardianPhone || '',
      relationship: s.profile?.relationship || '', avatarUrl: s.profile?.avatarUrl || '',
    });
    setEditingStudent(s); setShowForm(true); setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedInstituteUserId = form.instituteUserId.trim();
    const trimmedBarcodeId = form.barcodeId.trim();

    if (!trimmedInstituteUserId) {
      setError('Institute User ID is required');
      return;
    }

    if (!trimmedBarcodeId) {
      setError('Barcode ID is required');
      return;
    }

    const trimmedPassword = form.password.trim();
    if (!editingStudent && trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (editingStudent && trimmedPassword && trimmedPassword.length < 6) {
      setError('Assigned password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      if (editingStudent) {
        const payload: any = {
          fullName: form.fullName,
          instituteId: trimmedInstituteUserId,
          barcodeId: trimmedBarcodeId,
          phone: form.phone || undefined,
          whatsappPhone: form.whatsappPhone || undefined,
          address: form.address || undefined, school: form.school || undefined, occupation: form.occupation || undefined,
          gender: form.gender || undefined,
          dateOfBirth: form.dateOfBirth || undefined, guardianName: form.guardianName || undefined,
          guardianPhone: form.guardianPhone || undefined, relationship: form.relationship || undefined,
          avatarUrl: form.avatarUrl || undefined,
        };
        await api.patch(`/users/students/${editingStudent.id}/profile`, payload);
        if (trimmedPassword) {
          await api.patch(`/users/students/${editingStudent.id}/password`, { newPassword: trimmedPassword });
        }
      } else {
        await api.post('/users/students', {
          fullName: form.fullName, email: form.email, password: trimmedPassword,
          instituteUserId: trimmedInstituteUserId,
          barcodeId: trimmedBarcodeId,
          phone: form.phone || undefined, whatsappPhone: form.whatsappPhone || undefined,
          address: form.address || undefined, school: form.school || undefined,
          occupation: form.occupation || undefined, gender: form.gender || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          guardianName: form.guardianName || undefined, guardianPhone: form.guardianPhone || undefined,
          relationship: form.relationship || undefined, avatarUrl: form.avatarUrl || undefined,
        });
      }
      setShowForm(false);
      setForm({ ...emptyForm });
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      if (editingStudent) {
        load(search);
      } else {
        setSearch('');
        load();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to save student'));
    }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await api.patch(`/users/students/${id}/profile`, { status }).catch(() => {}); load(search);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student? This will remove all their data.')) return;
    await api.delete(`/users/students/${id}`).catch(() => {}); load(search);
  };

  const handleAvatarFileChange = async (file?: File) => {
    if (!file) return;
    setError('');
    setUploadingAvatar(true);
    try {
      const url = editingStudent
        ? await uploadStudentAvatar(editingStudent.id, file)
        : await uploadImage(file, 'avatars');
      setForm(p => ({ ...p, avatarUrl: url }));
    } catch (err: any) {
      setError(err.message || 'Avatar upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const studentColumns: readonly StickyColumn<any>[] = [
    { id: 'userId', label: 'User ID', minWidth: 220, defaultVisible: false, render: (s) => <span className="font-mono text-xs text-slate-600">{s.id || '-'}</span> },
    { id: 'instituteId', label: 'Student ID', minWidth: 130, render: (s) => <span className="font-mono text-xs text-blue-600 font-bold">{s.profile?.instituteId || '-'}</span> },
    { id: 'barcodeId', label: 'Barcode ID', minWidth: 140, render: (s) => <span className="font-mono text-xs text-emerald-700 font-semibold">{s.profile?.barcodeId || '-'}</span> },
    {
      id: 'name',
      label: 'Name',
      minWidth: 200,
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden shadow-sm">
            {s.profile?.avatarUrl ? (
              <button
                type="button"
                onClick={() => setImageCardStudent(s)}
                className="w-full h-full block cursor-zoom-in"
                title="View image card"
              >
                <img src={s.profile.avatarUrl} alt={s.profile?.fullName || s.email || 'Student'} className="w-full h-full object-cover" />
              </button>
            ) : (
              (s.profile?.fullName || s.email || '?')[0].toUpperCase()
            )}
          </div>
          <span className="font-semibold text-slate-800 text-sm">{s.profile?.fullName || '-'}</span>
        </div>
      ),
    },
    { id: 'email', label: 'Email', minWidth: 220, render: (s) => <span className="text-slate-500 text-sm">{s.email}</span> },
    { id: 'phone', label: 'Phone', minWidth: 140, render: (s) => <span className="text-slate-500 text-sm">{s.profile?.phone || '-'}</span> },
    { id: 'whatsappPhone', label: 'WhatsApp', minWidth: 140, defaultVisible: false, render: (s) => <span className="text-slate-500 text-sm">{s.profile?.whatsappPhone || '-'}</span> },
    { id: 'school', label: 'School', minWidth: 160, defaultVisible: false, render: (s) => <span className="text-slate-500 text-sm">{s.profile?.school || '-'}</span> },
    { id: 'address', label: 'Address', minWidth: 180, defaultVisible: false, render: (s) => <span className="text-slate-500 text-sm">{s.profile?.address || '-'}</span> },
    { id: 'occupation', label: 'Occupation', minWidth: 140, defaultVisible: false, render: (s) => <span className="text-slate-500 text-sm">{s.profile?.occupation || '-'}</span> },
    { id: 'dateOfBirth', label: 'Date of Birth', minWidth: 130, defaultVisible: false, render: (s) => <span className="text-slate-500 text-sm">{s.profile?.dateOfBirth ? new Date(s.profile.dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span> },
    { id: 'guardianName', label: 'Guardian', minWidth: 150, defaultVisible: false, render: (s) => <span className="text-slate-500 text-sm">{s.profile?.guardianName || '-'}</span> },
    { id: 'guardianPhone', label: 'Guardian Phone', minWidth: 140, defaultVisible: false, render: (s) => <span className="text-slate-500 text-sm">{s.profile?.guardianPhone || '-'}</span> },
    { id: 'relationship', label: 'Relationship', minWidth: 130, defaultVisible: false, render: (s) => <span className="text-slate-500 text-sm">{s.profile?.relationship || '-'}</span> },
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
          <button onClick={() => setViewStudent(s)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            View
          </button>
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
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Students</h1>
          <p className="text-slate-500 text-sm mt-0.5">{totalStudents} registered students</p>
        </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search by name, email, institute ID, barcode, user ID..."
                className="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 shadow-sm transition w-full sm:w-64" />
          </div>
          <button
            onClick={() => setShowExport(true)}
            className="px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          <button onClick={openNew}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Student
          </button>
        </div>
      </div>

      {/* Export Modal */}
      {showExport && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowExport(false)}>
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                <div>
                  <h2 className="font-bold text-[hsl(var(--foreground))]">Export Students</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Select columns to include in the Excel file</p>
                </div>
                <button onClick={() => setShowExport(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Select all / none */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExportCols(EXPORT_COLUMNS.map(c => c.key))}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
                  >Select all</button>
                  <span className="text-slate-300">·</span>
                  <button
                    onClick={() => setExportCols([])}
                    className="text-xs font-semibold text-slate-400 hover:text-red-500 transition"
                  >Clear</button>
                  <span className="ml-auto text-xs text-slate-400">{exportCols.length} selected · {students.length} rows</span>
                </div>
                {/* Column checkboxes */}
                <div className="grid grid-cols-2 gap-2">
                  {EXPORT_COLUMNS.map(col => (
                    <label
                      key={col.key}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition select-none ${
                        exportCols.includes(col.key)
                          ? 'bg-blue-50 border-blue-300'
                          : 'border-[hsl(var(--border))] hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition ${
                        exportCols.includes(col.key)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-slate-300'
                      }`}>
                        {exportCols.includes(col.key) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-xs font-medium ${
                        exportCols.includes(col.key) ? 'text-blue-700' : 'text-slate-600'
                      }`}>{col.label}</span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={exportCols.includes(col.key)}
                        onChange={() => toggleExportCol(col.key)}
                      />
                    </label>
                  ))}
                </div>
                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowExport(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exportCols.length === 0}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold hover:from-emerald-600 hover:to-emerald-700 transition shadow-lg shadow-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* View Detail Modal */}
      {viewStudent && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setViewStudent(null)}>
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                <h2 className="font-bold text-[hsl(var(--foreground))]">Student Details</h2>
                <button onClick={() => setViewStudent(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Avatar + name */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0 overflow-hidden">
                    {viewStudent.profile?.avatarUrl ? (
                      <button
                        type="button"
                        onClick={() => setImageCardStudent(viewStudent)}
                        className="w-full h-full block cursor-zoom-in"
                        title="View image card"
                      >
                        <img src={viewStudent.profile.avatarUrl} alt={viewStudent.profile?.fullName || viewStudent.email || 'Student'} className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      (viewStudent.profile?.fullName || viewStudent.email || '?')[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">{viewStudent.profile?.fullName || '-'}</h3>
                    <p className="text-sm text-slate-500">{viewStudent.email}</p>
                    {viewStudent.profile?.instituteId && <p className="text-xs font-mono text-blue-600 font-bold mt-0.5">{viewStudent.profile.instituteId}</p>}
                  </div>
                  <span className={`ml-auto inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${studentStatusBadge(viewStudent.profile?.status || 'PENDING')}`}>
                    {viewStudent.profile?.status || 'PENDING'}
                  </span>
                </div>
                {/* Details grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {[
                    { label: 'User ID', value: viewStudent.id },
                    { label: 'Barcode ID', value: viewStudent.profile?.barcodeId },
                    { label: 'Phone', value: viewStudent.profile?.phone },
                    { label: 'WhatsApp', value: viewStudent.profile?.whatsappPhone },
                    { label: 'School', value: viewStudent.profile?.school },
                    { label: 'Occupation', value: viewStudent.profile?.occupation },
                    { label: 'Date of Birth', value: viewStudent.profile?.dateOfBirth ? new Date(viewStudent.profile.dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null },
                    { label: 'Joined', value: viewStudent.createdAt ? new Date(viewStudent.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null },
                    { label: 'Gender', value: viewStudent.profile?.gender ? GENDERS.find(g => g.value === viewStudent.profile.gender)?.label : null },
                    { label: 'Guardian', value: viewStudent.profile?.guardianName },
                    { label: 'Guardian Phone', value: viewStudent.profile?.guardianPhone },
                    { label: 'Relationship', value: viewStudent.profile?.relationship },
                  ].map(({ label, value }) => value ? (
                    <div key={label}>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                      <p className="text-slate-700 font-medium mt-0.5">{value}</p>
                    </div>
                  ) : null)}
                </div>
                {viewStudent.profile?.address && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Address</p>
                    <p className="text-sm text-slate-700">{viewStudent.profile.address}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setViewStudent(null); openEdit(viewStudent); }} className="flex-1 py-2.5 rounded-xl bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100 transition">Edit</button>
                  <button onClick={() => setViewStudent(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition">Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Student Image Card Modal */}
      {imageCardStudent && createPortal(
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={() => setImageCardStudent(null)}>
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-[hsl(var(--card))] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="relative h-72 bg-slate-100">
                {imageCardStudent.profile?.avatarUrl ? (
                  <img
                    src={imageCardStudent.profile.avatarUrl}
                    alt={imageCardStudent.profile?.fullName || imageCardStudent.email || 'Student'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-6xl font-bold flex items-center justify-center">
                    {(imageCardStudent.profile?.fullName || imageCardStudent.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => setImageCardStudent(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/45 text-white hover:bg-black/60 transition"
                >
                  <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-5">
                <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">{imageCardStudent.profile?.fullName || '-'}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{imageCardStudent.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {imageCardStudent.profile?.instituteId && (
                    <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-mono font-semibold">
                      {imageCardStudent.profile.instituteId}
                    </span>
                  )}
                  {imageCardStudent.profile?.barcodeId && (
                    <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-mono font-semibold">
                      {imageCardStudent.profile.barcodeId}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {showForm && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="min-h-full flex items-center justify-center p-4">
          <div className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))] rounded-t-2xl">
              <div>
                <h2 className="font-bold text-[hsl(var(--foreground))]">{editingStudent ? 'Edit Student' : 'New Student'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editingStudent ? 'Update student information' : 'Add a new student to the system'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} autoComplete="off" className="overflow-y-auto max-h-[80vh]">
            <div className="p-6 space-y-5">
              {error && <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600"><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</div>}

              {/* Prevent browser credential autofill in create mode */}
              {!editingStudent && (
                <div className="hidden" aria-hidden="true">
                  <input type="text" name="username" autoComplete="username" />
                  <input type="password" name="current-password" autoComplete="current-password" />
                </div>
              )}

              {/* Account */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Account</p>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} placeholder="John Doe" required
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Institute User ID <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.instituteUserId}
                      onChange={e => setForm(p => ({ ...p, instituteUserId: e.target.value }))}
                      placeholder="e.g. TD-2026-0001"
                      required
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Barcode ID <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.barcodeId}
                      onChange={e => setForm(p => ({ ...p, barcodeId: e.target.value }))}
                      placeholder="e.g. BAR-0001"
                      required
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Avatar</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CropImageInput onFile={handleAvatarFileChange} aspectRatio={1} loading={uploadingAvatar} label="Upload Avatar" cropTitle="Crop Avatar" />
                    <span className="text-[11px] text-slate-400">JPEG/PNG/WebP/GIF up to 5MB</span>
                  </div>
                  {form.avatarUrl && <img src={form.avatarUrl} alt="Avatar preview" className="w-16 h-16 rounded-full object-cover border border-slate-200" />}
                </div>
                {!editingStudent && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                      <input type="email" name="student-email-create" autoComplete="off" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="student@email.com" required
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-1.5">Password <span className="text-red-500">*</span></label>
                      <input type="password" name="student-password-create" autoComplete="new-password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 chars" minLength={6} required
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>
                  </div>
                )}

                {editingStudent && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Assign New Password <span className="text-slate-400 font-normal text-xs">(optional)</span></label>
                    <input
                      type="password"
                      name="student-password-edit"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="Leave blank to keep current password"
                      minLength={6}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    <p className="text-xs text-slate-400 mt-1.5">If provided, this replaces the student's password and signs them out from existing sessions.</p>
                  </div>
                )}
              </div>

              {/* Contact */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contact</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Phone</label>
                    <input type="text" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="07X XXXX XXX"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">WhatsApp Phone</label>
                    <input type="text" value={form.whatsappPhone} onChange={e => setForm(p => ({ ...p, whatsappPhone: e.target.value }))} placeholder="07X XXXX XXX"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Address</label>
                    <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Home address"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  </div>
                </div>
              </div>

              {/* Personal */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Personal</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">School</label>
                    <input type="text" value={form.school} onChange={e => setForm(p => ({ ...p, school: e.target.value }))} placeholder="School name"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Date of Birth</label>
                    <input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Occupation</label>
                    <input type="text" value={form.occupation} onChange={e => setForm(p => ({ ...p, occupation: e.target.value }))} placeholder="Student / Other"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Gender <span className="text-slate-400 font-normal text-xs">(optional)</span></label>
                    <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                      <option value="">— Select —</option>
                      {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Guardian */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Guardian</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Guardian Name</label>
                    <input type="text" value={form.guardianName} onChange={e => setForm(p => ({ ...p, guardianName: e.target.value }))} placeholder="Parent / Guardian"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Guardian Phone</label>
                    <input type="text" value={form.guardianPhone} onChange={e => setForm(p => ({ ...p, guardianPhone: e.target.value }))} placeholder="07X XXXX XXX"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Relationship</label>
                    <input type="text" value={form.relationship} onChange={e => setForm(p => ({ ...p, relationship: e.target.value }))} placeholder="e.g. Father, Mother"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 pb-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={saving || uploadingAvatar} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {saving ? 'Saving...' : editingStudent ? 'Save Changes' : 'Create Student'}
                </button>
              </div>
            </div>
            </form>
          </div>
          </div>
        </div>
      , document.body)}

      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <p className="text-sm font-medium text-slate-500">{search ? 'No students match your search' : 'No students registered yet'}</p>
          </div>
        ) : (
          <StickyDataTable
            columns={studentColumns}
            rows={students}
            getRowId={(row) => row.id}
            tableHeight="calc(100vh - 320px)"
            storageKey="admin-students-columns"
          />
        )}
      </div>
    </div>
  );
}


