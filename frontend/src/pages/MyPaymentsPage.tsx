import { useEffect, useState } from 'react';
import api from '../lib/api';

const STATUS_MAP: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING: { bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  VERIFIED: { bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  REJECTED: { bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
};

export default function MyPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payments/my').then(r => setPayments(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">My Payments</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Track your payment submissions and status</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', count: payments.length, color: 'from-blue-500 to-blue-600' },
          { label: 'Pending', count: payments.filter(p => p.status === 'PENDING').length, color: 'from-amber-400 to-amber-500' },
          { label: 'Verified', count: payments.filter(p => p.status === 'VERIFIED').length, color: 'from-emerald-400 to-emerald-500' },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-2 shadow-md`}>
              <span className="text-white text-xs font-bold">{count}</span>
            </div>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
        ) : payments.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No payments submitted</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Upload a payment slip to get started</p>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr,auto,auto,auto] gap-4 px-5 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <span>Class</span><span>Month</span><span>Type</span><span>Status</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {payments.map((p: any) => {
                const st = STATUS_MAP[p.status] || STATUS_MAP.PENDING;
                return (
                  <div key={p.id} className="px-5 py-4 flex flex-col sm:grid sm:grid-cols-[1fr,auto,auto,auto] gap-2 sm:gap-4 sm:items-center hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{p.month?.class?.name || 'Unknown class'}</p>
                      {p.createdAt && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">{p.month?.name || '\u2014'}</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{p.type || '\u2014'}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border w-fit ${st.bg} ${st.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {p.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
