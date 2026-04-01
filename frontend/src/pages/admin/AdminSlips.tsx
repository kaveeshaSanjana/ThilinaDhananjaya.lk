import { useEffect, useState } from 'react';
import api from '../../lib/api';

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
      PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      VERIFIED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return map[s] || map.PENDING;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Payment Slips</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Review and verify student payment submissions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg p-1 w-fit">
        {(['PENDING', 'VERIFIED', 'REJECTED', 'ALL'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${filter === s ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
            {s} {s !== 'ALL' && <span className="ml-1 text-slate-400">({(counts as any)[s]})</span>}
          </button>
        ))}
      </div>

      {/* Slip preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{preview.user?.profile?.fullName || preview.user?.email}</p>
                <p className="text-xs text-slate-400">{preview.month?.class?.name} · {preview.month?.name}</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-3"><img src={preview.slipUrl} alt="slip" className="w-full object-contain max-h-80 rounded" /></div>
            {preview.status === 'PENDING' && (
              <div className="flex gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                <button onClick={() => { act(preview.id, 'VERIFIED'); setPreview(null); }}
                  className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition">Verify</button>
                <button onClick={() => { act(preview.id, 'REJECTED'); setPreview(null); }}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition">Reject</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}slips found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Class</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Month</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{p.user?.profile?.fullName || '—'}</p>
                      <p className="text-xs text-slate-400">{p.user?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.month?.class?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.month?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.type}</td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge(p.status)}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {p.slipUrl && <button onClick={() => setPreview(p)} className="text-blue-600 dark:text-blue-400 text-xs font-medium hover:underline">View</button>}
                      {p.status === 'PENDING' && (
                        <>
                          <button onClick={() => act(p.id, 'VERIFIED')} disabled={actingId === p.id} className="text-green-600 dark:text-green-400 text-xs font-medium hover:underline disabled:opacity-50">Verify</button>
                          <button onClick={() => act(p.id, 'REJECTED')} disabled={actingId === p.id} className="text-red-600 dark:text-red-400 text-xs font-medium hover:underline disabled:opacity-50">Reject</button>
                        </>
                      )}
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
