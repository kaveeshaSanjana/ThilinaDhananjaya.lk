import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import StickyDataTable, { type StickyColumn } from '../../components/StickyDataTable';

type SlipsTab = 'online' | 'physical';

interface ClassItem {
  id: string;
  name: string;
  subject?: string;
  monthlyFee?: number;
}

interface PaymentMonth {
  id: string;
  name: string;
  year: number;
  month: number;
}

interface PaymentOverviewStudent {
  userId: string;
  email: string;
  profile?: {
    fullName?: string;
    instituteId?: string;
    avatarUrl?: string | null;
    phone?: string;
  };
  paymentStatus: 'PAID' | 'LATE' | 'PENDING' | 'UNPAID';
  slip?: {
    id: string;
    status: string;
    type?: string;
    slipUrl?: string;
    amount?: number | null;
    paidDate?: string | null;
    adminNote?: string | null;
    createdAt?: string;
  } | null;
}

interface PaymentOverview {
  monthlyFee?: number | null;
  summary: {
    total: number;
    paid: number;
    late: number;
    pending: number;
    unpaid: number;
  };
  students: PaymentOverviewStudent[];
}

const PHYSICAL_PAY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  PAID: { label: 'Paid', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  LATE: { label: 'Late', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  PENDING: { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  UNPAID: { label: 'Unpaid', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

export default function AdminSlips() {
  const [tab, setTab] = useState<SlipsTab>('online');

  // Online payments (slip upload approvals)
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [preview, setPreview] = useState<any>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [verifyModal, setVerifyModal] = useState<{ slip: any } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ slip: any } | null>(null);
  const [verifyForm, setVerifyForm] = useState({ transactionId: '', adminNote: '', paidDate: new Date().toISOString().split('T')[0] });
  const [rejectForm, setRejectForm] = useState({ rejectReason: '', adminNote: '' });
  const [actionError, setActionError] = useState('');

  // Physical class payments
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [paymentMonths, setPaymentMonths] = useState<PaymentMonth[]>([]);
  const [paymentMonthId, setPaymentMonthId] = useState('');
  const [paymentOverview, setPaymentOverview] = useState<PaymentOverview | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [payFilter, setPayFilter] = useState<'all' | 'PAID' | 'LATE' | 'PENDING' | 'UNPAID'>('all');
  const [paymentUpdatingId, setPaymentUpdatingId] = useState('');
  const [physicalVerifyModal, setPhysicalVerifyModal] = useState<{
    userId: string;
    studentName: string;
    status: 'PAID' | 'LATE' | 'UNPAID';
    adminNote: string;
    paidDate: string;
  } | null>(null);

  const currentClassId = useRef('');
  const overviewCache = useRef<Record<string, PaymentOverview>>({});

  const load = () => {
    setLoading(true);
    const params: any = { limit: 200 };
    if (filter && filter !== 'ALL') params.status = filter;
    api.get('/payments/all', { params }).then(r => {
      const res = r.data;
      setPayments(res?.data ? res.data : Array.isArray(res) ? res : []);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    api.get('/classes').then(r => setClasses(r.data || [])).catch(() => {});
  }, []);

  const openVerifyModal = (slip: any) => {
    setVerifyForm({ transactionId: '', adminNote: '', paidDate: new Date().toISOString().split('T')[0] });
    setActionError('');
    setVerifyModal({ slip });
  };

  const openRejectModal = (slip: any) => {
    setRejectForm({ rejectReason: '', adminNote: '' });
    setActionError('');
    setRejectModal({ slip });
  };

  const doVerify = async () => {
    if (!verifyModal) return;
    if (!verifyForm.transactionId.trim()) { setActionError('Transaction ID is required'); return; }
    setActingId(verifyModal.slip.id);
    setActionError('');
    try {
      await api.patch(`/payments/${verifyModal.slip.id}/verify`, {
        transactionId: verifyForm.transactionId.trim(),
        adminNote: verifyForm.adminNote || undefined,
        paidDate: verifyForm.paidDate || undefined,
      });
      setVerifyModal(null);
      load();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to verify slip');
    } finally {
      setActingId(null);
    }
  };

  const doReject = async () => {
    if (!rejectModal) return;
    if (!rejectForm.rejectReason.trim()) { setActionError('Rejection reason is required'); return; }
    setActingId(rejectModal.slip.id);
    setActionError('');
    try {
      await api.patch(`/payments/${rejectModal.slip.id}/reject`, {
        rejectReason: rejectForm.rejectReason.trim(),
        adminNote: rejectForm.adminNote || undefined,
      });
      setRejectModal(null);
      load();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to reject slip');
    } finally {
      setActingId(null);
    }
  };

  const filtered = payments.filter(p => filter === 'ALL' || p.status === filter);
  const counts = { PENDING: payments.filter(p => p.status === 'PENDING').length, VERIFIED: payments.filter(p => p.status === 'VERIFIED').length, REJECTED: payments.filter(p => p.status === 'REJECTED').length };

  const fetchOverview = async (classId: string, monthId: string, forceRefresh = false) => {
    const cacheKey = `${classId}:${monthId}`;
    if (!forceRefresh && overviewCache.current[cacheKey]) {
      setPaymentOverview(overviewCache.current[cacheKey]);
      setPaymentLoading(false);
      return;
    }
    setPaymentLoading(true);
    setPaymentError('');
    try {
      const { data } = await api.get(`/payments/class/${classId}/month/${monthId}`);
      overviewCache.current[cacheKey] = data || null;
      setPaymentOverview(data || null);
    } catch (err: any) {
      setPaymentOverview(null);
      setPaymentError(err.response?.data?.message || 'Failed to load payment overview');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Single effect: fetches months then overview in one go
  useEffect(() => {
    if (!selectedClassId || tab !== 'physical') return;
    currentClassId.current = selectedClassId;
    setPaymentOverview(null);
    setPaymentMonthId('');
    setPaymentMonths([]);
    setPaymentLoading(true);
    setPaymentError('');
    api.get(`/classes/${selectedClassId}/months`)
      .then(async r => {
        const months = (r.data || []) as PaymentMonth[];
        setPaymentMonths(months);
        if (months.length === 0) {
          setPaymentError('No months found for this class');
          setPaymentLoading(false);
          return;
        }
        const lastMonth = months[months.length - 1];
        setPaymentMonthId(lastMonth.id);
        await fetchOverview(selectedClassId, lastMonth.id);
      })
      .catch(() => {
        setPaymentMonths([]);
        setPaymentError('Failed to load class months');
        setPaymentLoading(false);
      });
  }, [selectedClassId, tab]);

  const setStudentPaymentStatus = async (userId: string, status: 'PAID' | 'LATE' | 'UNPAID', adminNote = '', paidDate = '') => {
    if (!paymentMonthId) return;
    setPaymentUpdatingId(`${userId}:${status}`);
    try {
      await api.patch(`/payments/student/${userId}/month/${paymentMonthId}/status`, {
        status,
        adminNote,
        ...(paidDate ? { paidDate } : {}),
      });
      // Force refresh from API and update cache
      await fetchOverview(currentClassId.current, paymentMonthId, true);
    } catch {
      setPaymentError('Failed to update payment status');
    } finally {
      setPaymentUpdatingId('');
    }
  };

  const filteredPhysicalStudents = (paymentOverview?.students || []).filter(student => {
    if (payFilter !== 'all' && student.paymentStatus !== payFilter) return false;
    if (!paymentSearch.trim()) return true;
    const q = paymentSearch.toLowerCase();
    return (
      (student.profile?.fullName || '').toLowerCase().includes(q) ||
      (student.profile?.instituteId || '').toLowerCase().includes(q) ||
      (student.email || '').toLowerCase().includes(q)
    );
  });

  const physicalCounts = {
    all: paymentOverview?.summary?.total || 0,
    PAID: paymentOverview?.summary?.paid || 0,
    LATE: paymentOverview?.summary?.late || 0,
    PENDING: paymentOverview?.summary?.pending || 0,
    UNPAID: paymentOverview?.summary?.unpaid || 0,
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-700',
      VERIFIED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
    };
    return map[s] || map.PENDING;
  };

  const slipColumns: readonly StickyColumn<any>[] = [
    {
      id: 'student',
      label: 'Student',
      minWidth: 200,
      render: (p) => (
        <>
          <p className="font-semibold text-slate-800 text-sm">{p.user?.profile?.fullName || '-'}</p>
          <p className="text-xs text-slate-400">{p.user?.email}</p>
        </>
      ),
    },
    { id: 'class', label: 'Class', minWidth: 160, render: (p) => <span className="text-slate-600 text-sm">{p.month?.class?.name || '-'}</span> },
    { id: 'month', label: 'Month', minWidth: 140, render: (p) => <span className="text-slate-500 text-sm">{p.month?.name || '-'}</span> },
    { id: 'type', label: 'Type', minWidth: 90, render: (p) => <span className="text-slate-500 text-sm">{p.type}</span> },
    { id: 'date', label: 'Date', minWidth: 120, render: (p) => <span className="text-slate-400 text-xs">{p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span> },
    {
      id: 'status',
      label: 'Status',
      minWidth: 110,
      render: (p) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(p.status)}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          {p.status}
        </span>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 210,
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          {p.slipUrl && <button onClick={() => setPreview(p)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            View
          </button>}
          {p.status === 'PENDING' && (
            <>
              <button onClick={() => openVerifyModal(p)} disabled={actingId === p.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition disabled:opacity-50">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Verify
              </button>
              <button onClick={() => openRejectModal(p)} disabled={actingId === p.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                Reject
              </button>
            </>
          )}
          {p.status === 'REJECTED' && p.rejectReason && (
            <span className="text-xs text-red-500 italic max-w-[150px] truncate" title={p.rejectReason}>Reason: {p.rejectReason}</span>
          )}
          {p.status === 'VERIFIED' && p.transactionId && (
            <span className="text-xs text-emerald-600 font-mono" title={`Transaction: ${p.transactionId}`}>#{p.transactionId}</span>
          )}
        </div>
      ),
    },
  ];

  const physicalColumns: readonly StickyColumn<PaymentOverviewStudent>[] = [
    {
      id: 'fullName',
      label: 'Full Name',
      minWidth: 160,
      render: (student) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-[9px]">
              {(student.profile?.fullName || student.email || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          </div>
          <span className="font-medium text-xs text-slate-800 truncate">{student.profile?.fullName || '—'}</span>
        </div>
      ),
    },
    {
      id: 'instituteId',
      label: 'Institute ID',
      minWidth: 120,
      render: (student) => (
        <span className="text-xs font-mono text-slate-500">{student.profile?.instituteId || '—'}</span>
      ),
    },
    {
      id: 'phone',
      label: 'Phone',
      minWidth: 130,
      render: (student) => (
        <span className="text-xs text-slate-500">{student.profile?.phone || '—'}</span>
      ),
    },
    {
      id: 'email',
      label: 'Email',
      minWidth: 180,
      render: (student) => (
        <span className="text-xs text-slate-500">{student.email || '—'}</span>
      ),
    },
    {
      id: 'paymentStatus',
      label: 'Payment Status',
      minWidth: 120,
      align: 'center',
      render: (student) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PHYSICAL_PAY_CFG[student.paymentStatus]?.bg || PHYSICAL_PAY_CFG.UNPAID.bg} ${PHYSICAL_PAY_CFG[student.paymentStatus]?.color || PHYSICAL_PAY_CFG.UNPAID.color}`}>
          {PHYSICAL_PAY_CFG[student.paymentStatus]?.label || student.paymentStatus}
        </span>
      ),
    },
    {
      id: 'amount',
      label: 'Amount (LKR)',
      minWidth: 110,
      align: 'right',
      render: (student) => {
        const amt = student.slip?.amount ?? paymentOverview?.monthlyFee;
        return <span className="text-xs font-mono text-slate-600">{amt != null ? `Rs. ${Number(amt).toLocaleString()}` : '—'}</span>;
      },
    },
    {
      id: 'paidDate',
      label: 'Paid Date',
      minWidth: 110,
      align: 'center',
      render: (student) => (
        <span className="text-xs text-slate-500">
          {student.slip?.paidDate ? new Date(student.slip.paidDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 140,
      align: 'right',
      render: (student) => (
        <div className="flex justify-end">
          {(student.paymentStatus === 'LATE' || student.paymentStatus === 'UNPAID') && (
            <button
              onClick={() => setPhysicalVerifyModal({
                userId: student.userId,
                studentName: student.profile?.fullName || student.email,
                status: 'PAID',
                adminNote: '',
                paidDate: new Date().toISOString().split('T')[0],
              })}
              disabled={!!paymentUpdatingId}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
            >
              Verify
            </button>
          )}
        </div>
      ),
    },
  ];

  const selectedClass = classes.find(c => c.id === selectedClassId);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Payment Slips</h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm mt-0.5">Review online payment slips and manage physical class payments</p>
      </div>

      <div className="flex gap-1 bg-[hsl(var(--muted))] rounded-xl p-1 border border-[hsl(var(--border))] w-full">
        {([
          { key: 'online' as const, label: 'Online' },
          { key: 'physical' as const, label: 'Physical' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${tab === t.key ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'online' ? (
        <>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-3">
        {[{label: 'Pending', count: counts.PENDING, color: 'bg-amber-50 text-amber-700 border border-amber-200'},
          {label: 'Verified', count: counts.VERIFIED, color: 'bg-emerald-50 text-emerald-700 border border-emerald-200'},
          {label: 'Rejected', count: counts.REJECTED, color: 'bg-red-50 text-red-700 border border-red-200'},
        ].map(({label, count, color}) => (
          <span key={label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${color}`}>
            <span className="font-bold">{count}</span> {label}
          </span>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[hsl(var(--muted))] rounded-xl p-1 border border-[hsl(var(--border))] w-full">
        {(['PENDING', 'VERIFIED', 'REJECTED', 'ALL'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`flex-1 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${filter === s ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Slip preview modal */}
      {preview && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
              <div>
                <p className="font-bold text-[hsl(var(--foreground))]">{preview.user?.profile?.fullName || preview.user?.email}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{preview.month?.class?.name} — {preview.month?.name}</p>
              </div>
              <button onClick={() => setPreview(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 bg-slate-50"><img src={preview.slipUrl} alt="slip" className="w-full object-contain max-h-80 rounded-xl" /></div>
            {preview.status === 'PENDING' && (
              <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
                <button onClick={() => { openVerifyModal(preview); setPreview(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold hover:from-emerald-600 hover:to-green-700 transition shadow-lg shadow-emerald-500/25">Verify</button>
                <button onClick={() => { openRejectModal(preview); setPreview(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold hover:from-red-600 hover:to-red-700 transition shadow-lg shadow-red-500/25">Reject</button>
              </div>
            )}
          </div>
        </div>
      , document.body)}

      {/* Verify Modal */}
      {verifyModal && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setVerifyModal(null)}>
          <div className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
              <div>
                <p className="font-bold text-[hsl(var(--foreground))]">Verify Payment Slip</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{verifyModal.slip.user?.profile?.fullName || verifyModal.slip.user?.email} — {verifyModal.slip.month?.class?.name} · {verifyModal.slip.month?.name}</p>
              </div>
              <button onClick={() => setVerifyModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {actionError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <p className="text-sm text-red-600">{actionError}</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Transaction / Reference ID <span className="text-red-500">*</span></label>
                <input type="text" value={verifyForm.transactionId} onChange={e => setVerifyForm(f => ({ ...f, transactionId: e.target.value }))}
                  placeholder="e.g. TXN-2026-04-0012"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Date</label>
                <input type="date" value={verifyForm.paidDate} onChange={e => setVerifyForm(f => ({ ...f, paidDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Note <span className="font-normal text-slate-400">(optional)</span></label>
                <input type="text" value={verifyForm.adminNote} onChange={e => setVerifyForm(f => ({ ...f, adminNote: e.target.value }))}
                  placeholder="Optional note"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
              <button onClick={() => setVerifyModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
              <button onClick={doVerify} disabled={!!actingId}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold hover:from-emerald-600 hover:to-green-700 transition shadow-lg shadow-emerald-500/25 disabled:opacity-50">
                {actingId ? 'Verifying...' : 'Verify Payment'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Reject Modal */}
      {rejectModal && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
              <div>
                <p className="font-bold text-[hsl(var(--foreground))]">Reject Payment Slip</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{rejectModal.slip.user?.profile?.fullName || rejectModal.slip.user?.email} — {rejectModal.slip.month?.class?.name} · {rejectModal.slip.month?.name}</p>
              </div>
              <button onClick={() => setRejectModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {actionError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <p className="text-sm text-red-600">{actionError}</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea value={rejectForm.rejectReason} onChange={e => setRejectForm(f => ({ ...f, rejectReason: e.target.value }))}
                  placeholder="e.g. Blurry image, wrong amount, fake slip..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Note <span className="font-normal text-slate-400">(optional)</span></label>
                <input type="text" value={rejectForm.adminNote} onChange={e => setRejectForm(f => ({ ...f, adminNote: e.target.value }))}
                  placeholder="Internal note (not shown to student)"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/30" />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
              <button onClick={doReject} disabled={!!actingId}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold hover:from-red-600 hover:to-red-700 transition shadow-lg shadow-red-500/25 disabled:opacity-50">
                {actingId ? 'Rejecting...' : 'Reject Slip'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Table */}
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-[hsl(var(--muted))] animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
            </div>
            <p className="text-sm font-medium text-slate-500">No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}slips found</p>
          </div>
        ) : (
          <StickyDataTable
            columns={slipColumns}
            rows={filtered}
            getRowId={(row) => row.id}
            tableHeight="calc(100vh - 320px)"
          />
        )}
      </div>

        </>
      ) : (
        <>
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setPaymentSearch('');
                  setPayFilter('all');
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 min-w-[220px]"
              >
                <option value="">Select Class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.subject ? ` — ${c.subject}` : ''}</option>
                ))}
              </select>

              <select
                value={paymentMonthId}
                onChange={e => { setPaymentMonthId(e.target.value); if (e.target.value) fetchOverview(currentClassId.current, e.target.value); }}
                disabled={!selectedClassId || paymentMonths.length === 0}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 min-w-[220px] disabled:opacity-50"
              >
                <option value="">Select Month...</option>
                {paymentMonths.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>

              <input
                type="text"
                value={paymentSearch}
                onChange={e => setPaymentSearch(e.target.value)}
                placeholder="Search by student name, ID or email..."
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 w-full sm:w-72"
              />

              {(paymentSearch || payFilter !== 'all') && (
                <button
                  onClick={() => { setPaymentSearch(''); setPayFilter('all'); }}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Clear Filters
                </button>
              )}

              <span className="text-xs text-slate-500 ml-auto">
                {filteredPhysicalStudents.length} student{filteredPhysicalStudents.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex gap-1 bg-[hsl(var(--muted))] rounded-xl p-1 border border-[hsl(var(--border))] w-full overflow-x-auto">
              {([
                { key: 'all' as const, label: 'All', count: physicalCounts.all },
                { key: 'PAID' as const, label: 'Paid', count: physicalCounts.PAID },
                { key: 'LATE' as const, label: 'Late', count: physicalCounts.LATE },
                { key: 'PENDING' as const, label: 'Pending', count: physicalCounts.PENDING },
                { key: 'UNPAID' as const, label: 'Unpaid', count: physicalCounts.UNPAID },
              ]).map(item => (
                <button
                  key={item.key}
                  onClick={() => setPayFilter(item.key)}
                  className={`flex-1 min-w-[96px] px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                    payFilter === item.key ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    payFilter === item.key ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]' : 'bg-[hsl(var(--card))]/70 text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]'
                  }`}>
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {!selectedClassId ? (
            <div className="text-center py-12 text-slate-500"><p className="font-medium">Select a class to view physical payments</p></div>
          ) : !paymentMonthId ? (
            <div className="text-center py-12 text-slate-500"><p className="font-medium">Select a month to view payment statuses</p></div>
          ) : paymentLoading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : paymentError ? (
            <div className="text-center py-12 text-red-600"><p className="font-medium">{paymentError}</p></div>
          ) : !paymentOverview ? (
            <div className="text-center py-12 text-slate-500"><p className="font-medium">No payment data found</p></div>
          ) : (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden">
              {filteredPhysicalStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-500"><p className="font-medium">No students found</p></div>
              ) : (
                <StickyDataTable
                  columns={physicalColumns}
                  rows={filteredPhysicalStudents}
                  getRowId={(row) => row.userId}
                  tableHeight="calc(100vh - 380px)"
                />
              )}
            </div>
          )}

          <p className="text-xs text-slate-500 text-center">
            Payment status for {selectedClass?.name || 'selected class'} • {paymentOverview?.monthlyFee != null ? `Rs. ${Number(paymentOverview.monthlyFee).toLocaleString()}/month` : selectedClass?.monthlyFee ? `Rs. ${selectedClass.monthlyFee}/month` : 'No fee set'}
          </p>

          {physicalVerifyModal && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPhysicalVerifyModal(null)}>
              <div className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                  <div>
                    <p className="font-bold text-[hsl(var(--foreground))]">Update Payment Status</p>
                    <p className="text-xs text-slate-400 mt-0.5">{physicalVerifyModal.studentName}</p>
                  </div>
                  <button onClick={() => setPhysicalVerifyModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="p-5 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Select Status</label>
                    <select
                      value={physicalVerifyModal.status}
                      onChange={(e) => setPhysicalVerifyModal(prev => prev ? { ...prev, status: e.target.value as 'PAID' | 'LATE' | 'UNPAID' } : prev)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700"
                    >
                      <option value="PAID">Paid</option>
                      <option value="LATE">Late</option>
                      <option value="UNPAID">Unpaid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={physicalVerifyModal.paidDate}
                      onChange={(e) => setPhysicalVerifyModal(prev => prev ? { ...prev, paidDate: e.target.value } : prev)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Note <span className="font-normal text-slate-400">(optional)</span></label>
                    <input
                      type="text"
                      value={physicalVerifyModal.adminNote}
                      onChange={(e) => setPhysicalVerifyModal(prev => prev ? { ...prev, adminNote: e.target.value } : prev)}
                      placeholder="e.g. Cash paid in person"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
                  <button
                    onClick={() => setPhysicalVerifyModal(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const current = physicalVerifyModal;
                      if (!current) return;
                      await setStudentPaymentStatus(current.userId, current.status, current.adminNote, current.paidDate);
                      setPhysicalVerifyModal(null);
                    }}
                    disabled={!!paymentUpdatingId}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold hover:from-emerald-600 hover:to-green-700 transition disabled:opacity-50"
                  >
                    {paymentUpdatingId ? 'Saving...' : 'Save Status'}
                  </button>
                </div>
              </div>
            </div>
          , document.body)}
        </>
      )}
    </div>
  );
}


