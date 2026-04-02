import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import StickyDataTable, { type StickyColumn } from '../../components/StickyDataTable';

export default function AdminSlips() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [preview, setPreview] = useState<any>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = () => { setLoading(true); api.get('/payments/all').then(r => setPayments(r.data)).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const act = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
    setActingId(id);
    if (status === 'VERIFIED') await api.patch(`/payments/${id}/verify`, {}).catch(() => {});
    else await api.patch(`/payments/${id}/reject`, {}).catch(() => {});
    setActingId(null); load();
  };

  const filtered = payments.filter(p => filter === 'ALL' || p.status === filter);
  const counts = { PENDING: payments.filter(p => p.status === 'PENDING').length, VERIFIED: payments.filter(p => p.status === 'VERIFIED').length, REJECTED: payments.filter(p => p.status === 'REJECTED').length };

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
              <button onClick={() => act(p.id, 'VERIFIED')} disabled={actingId === p.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition disabled:opacity-50">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Verify
              </button>
              <button onClick={() => act(p.id, 'REJECTED')} disabled={actingId === p.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Payment Slips</h1>
        <p className="text-slate-500 text-sm mt-0.5">Review and verify student payment submissions</p>
      </div>

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
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200 w-full">
        {(['PENDING', 'VERIFIED', 'REJECTED', 'ALL'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`flex-1 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${filter === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Slip preview modal */}
      {preview && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="font-bold text-slate-800">{preview.user?.profile?.fullName || preview.user?.email}</p>
                <p className="text-xs text-slate-400 mt-0.5">{preview.month?.class?.name} � {preview.month?.name}</p>
              </div>
              <button onClick={() => setPreview(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 bg-slate-50"><img src={preview.slipUrl} alt="slip" className="w-full object-contain max-h-80 rounded-xl" /></div>
            {preview.status === 'PENDING' && (
              <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
                <button onClick={() => { act(preview.id, 'VERIFIED'); setPreview(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold hover:from-emerald-600 hover:to-green-700 transition shadow-lg shadow-emerald-500/25">Verify</button>
                <button onClick={() => { act(preview.id, 'REJECTED'); setPreview(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold hover:from-red-600 hover:to-red-700 transition shadow-lg shadow-red-500/25">Reject</button>
              </div>
            )}
          </div>
        </div>
      , document.body)}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
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
    </div>
  );
}


