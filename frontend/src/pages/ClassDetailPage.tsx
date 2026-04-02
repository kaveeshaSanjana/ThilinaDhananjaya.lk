import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

/** Format seconds as h:mm:ss or m:ss */
function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PaymentBadge({ month, classStatus, payments, user }: {
  month: any; classStatus: string; payments: any[]; user: any;
}) {
  if (user?.role === 'ADMIN') {
    return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">Admin</span>;
  }
  const highestReq = Math.max(
    statusRank(classStatus),
    statusRank(month.status),
  );
  if (highestReq === 0) {
    return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Free</span>;
  }
  if (highestReq === 1) {
    return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">Enrolled</span>;
  }
  // PAID_ONLY — check if user has paid
  const hasPaid = payments.some(
    (p: any) => p.monthId === month.id && p.type === 'MONTHLY' && p.status === 'VERIFIED',
  );
  if (hasPaid) {
    return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Paid ✓</span>;
  }
  const hasPending = payments.some(
    (p: any) => p.monthId === month.id && p.type === 'MONTHLY' && p.status === 'PENDING',
  );
  if (hasPending) {
    return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Pending</span>;
  }
  return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-100 text-orange-700 border border-orange-200">Pay Now</span>;
}

function statusRank(status: string): number {
  const ranks: Record<string, number> = { ANYONE: 0, STUDENTS_ONLY: 1, PAID_ONLY: 2, PRIVATE: 3, INACTIVE: 4 };
  return ranks[status] ?? 4;
}

export default function ClassDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [classData, setClassData] = useState<any>(null);
  const [months, setMonths] = useState<any[]>([]);
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);
  const [recordingsMap, setRecordingsMap] = useState<Record<string, any[]>>({});
  const [loadingRecs, setLoadingRecs] = useState<Record<string, boolean>>({});
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch class, months and payments
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, monthsRes] = await Promise.all([
          api.get(`/classes/${id}`),
          api.get(`/classes/${id}/months`),
        ]);
        setClassData(classRes.data);
        const visibleMonths = (monthsRes.data || []).filter(
          (m: any) => m.status !== 'INACTIVE' && m.status !== 'PRIVATE',
        );
        setMonths(visibleMonths);

        // Fetch user payments if logged in
        if (token) {
          try {
            const payRes = await api.get('/payments/my');
            setPayments(payRes.data || []);
          } catch { /* guest */ }
        }
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load class');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, token]);

  // Load recordings for a month (cached)
  const toggleMonth = async (monthId: string) => {
    if (expandedMonthId === monthId) {
      setExpandedMonthId(null);
      return;
    }
    setExpandedMonthId(monthId);
    if (recordingsMap[monthId]) return; // already loaded
    setLoadingRecs(prev => ({ ...prev, [monthId]: true }));
    try {
      const res = await api.get(`/recordings/by-month/${monthId}`);
      setRecordingsMap(prev => ({ ...prev, [monthId]: res.data || [] }));
    } catch {
      setRecordingsMap(prev => ({ ...prev, [monthId]: [] }));
    } finally {
      setLoadingRecs(prev => ({ ...prev, [monthId]: false }));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center bg-white rounded-2xl border border-slate-100 p-12 shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <p className="text-slate-600 text-sm font-medium">{error}</p>
      <Link to="/classes" className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 font-semibold hover:text-blue-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to classes
      </Link>
    </div>
  );

  const classStatus = classData?.status || 'ANYONE';

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Back */}
      <Link to="/classes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to classes
      </Link>

      {/* Vertical month list */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm min-h-[calc(100vh-220px)]">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Months
          </h2>
          <span className="text-xs font-medium text-slate-400">{months.length} month{months.length !== 1 ? 's' : ''}</span>
        </div>

        {months.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-slate-500 text-sm">No months available yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {months.map((m) => {
              const isExpanded = expandedMonthId === m.id;
              const recs = recordingsMap[m.id];
              const isLoadingRecs = loadingRecs[m.id];
              const recCount = m._count?.recordings ?? 0;

              return (
                <div key={m.id}>
                  {/* Month row */}
                  <button
                    onClick={() => toggleMonth(m.id)}
                    className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 ${isExpanded ? 'bg-blue-50/50' : ''}`}
                  >
                    {/* Chevron */}
                    <svg
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>

                    {/* Month icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isExpanded ? 'bg-blue-100' : 'bg-slate-100'}`}>
                      <svg className={`w-5 h-5 ${isExpanded ? 'text-blue-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>

                    {/* Month name & recording count */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isExpanded ? 'text-blue-700' : 'text-slate-800'}`}>{m.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{recCount} recording{recCount !== 1 ? 's' : ''}</p>
                    </div>

                    {/* Payment badge */}
                    <PaymentBadge month={m} classStatus={classStatus} payments={payments} user={user} />
                  </button>

                  {/* Expanded recordings */}
                  {isExpanded && (
                    <div className="bg-slate-50/50 border-t border-slate-100 px-5 py-4">
                      {isLoadingRecs ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                        </div>
                      ) : !recs || recs.length === 0 ? (
                        <div className="py-8 text-center">
                          <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <p className="text-slate-400 text-sm">No recordings in this month</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {recs.map((rec: any, idx: number) => (
                            <div
                              key={rec.id}
                              onClick={() => navigate(`/recording/${rec.id}`)}
                              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition cursor-pointer group"
                            >
                              {/* Order number */}
                              <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition">
                                <span className="text-xs font-bold text-slate-500 group-hover:text-blue-600 transition">{idx + 1}</span>
                              </div>

                              {/* Thumbnail */}
                              <div className="relative w-20 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-200">
                                {rec.thumbnail ? (
                                  <img src={rec.thumbnail} alt={rec.title} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                                    </svg>
                                  </div>
                                )}
                                {/* Play icon overlay */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/20">
                                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                </div>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition truncate">{rec.title}</p>
                                {rec.topic && <p className="text-xs text-blue-500 font-medium mt-0.5 truncate">{rec.topic}</p>}
                              </div>

                              {/* Duration & date */}
                              <div className="text-right shrink-0">
                                {rec.duration && (
                                  <p className="text-xs font-semibold text-slate-600">{typeof rec.duration === 'number' ? fmtDuration(rec.duration) : rec.duration}</p>
                                )}
                                {rec.createdAt && (
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {new Date(rec.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  </p>
                                )}
                              </div>

                              {/* Arrow */}
                              <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
