import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api';
import { getInstitutePath } from '../lib/instituteRoutes';

const STATUS_MAP: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  VERIFIED: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
};

type PaymentItem = {
  id: string;
  status?: string;
  type?: string;
  createdAt?: string;
  month?: {
    name?: string;
    class?: {
      name?: string;
    };
  };
};

const formatDate = (value?: string) => {
  if (!value) return '\u2014';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '\u2014';
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function MyPaymentsPage() {
  const { instituteId } = useParams();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payments/my').then(r => setPayments(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">My Payments</h1>
            <p className="text-[hsl(var(--muted-foreground))] text-sm">Track your payment submissions and status</p>
          </div>
        </div>
        <Link to={getInstitutePath(instituteId, '/payments/submit')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Upload Slip
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', count: payments.length, color: 'from-blue-500 to-blue-600' },
          { label: 'Pending', count: payments.filter(p => p.status === 'PENDING').length, color: 'from-amber-400 to-amber-500' },
          { label: 'Verified', count: payments.filter(p => p.status === 'VERIFIED').length, color: 'from-emerald-400 to-emerald-500' },
          { label: 'Rejected', count: payments.filter(p => p.status === 'REJECTED').length, color: 'from-red-400 to-red-500' },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-2 shadow-md`}>
              <span className="text-white text-xs font-bold">{count}</span>
            </div>
            <p className="text-[hsl(var(--muted-foreground))] text-xs font-medium">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
        ) : payments.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[hsl(var(--muted-foreground)/0.4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <p className="text-[hsl(var(--foreground))] text-sm font-medium">No payments submitted</p>
            <p className="text-[hsl(var(--muted-foreground))] text-xs mt-1">Upload a payment slip to get started</p>
            <Link to={getInstitutePath(instituteId, '/payments/submit')} className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-500 font-semibold hover:text-blue-600 transition">
              Upload now →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))] text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">Class</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Month</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const st = STATUS_MAP[p.status || ''] || STATUS_MAP.PENDING;
                  return (
                    <tr key={p.id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-[hsl(var(--foreground))] whitespace-nowrap">{p.month?.class?.name || 'Unknown class'}</td>
                      <td className="px-5 py-4 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">{formatDate(p.createdAt)}</td>
                      <td className="px-5 py-4 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">{p.month?.name || '\u2014'}</td>
                      <td className="px-5 py-4 text-sm font-bold text-[hsl(var(--foreground))] whitespace-nowrap">{p.type || '\u2014'}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border w-fit ${st.bg} ${st.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {p.status || 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
