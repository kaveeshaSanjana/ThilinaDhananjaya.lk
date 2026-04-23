import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { getInstitutePath } from '../lib/instituteRoutes';

interface ClassData {
  id: string;
  name: string;
}

interface MonthData {
  id: string;
  name: string;
}

interface PaymentData {
  id: string;
  status?: string;
  month?: {
    name?: string;
  };
  createdAt?: string;
  type?: string;
}

interface PaymentOverviewStudent {
  userId: string;
  email: string;
  profile?: {
    fullName?: string;
    avatarUrl?: string | null;
    phone?: string;
  };
  paymentStatus: 'PAID' | 'LATE' | 'PENDING' | 'UNPAID';
  slip?: {
    id: string;
    status: string;
    type?: string;
    slipUrl?: string;
    adminNote?: string | null;
    createdAt?: string;
  } | null;
}

interface PaymentOverview {
  summary: {
    total: number;
    paid: number;
    late: number;
    pending: number;
    unpaid: number;
  };
  students: PaymentOverviewStudent[];
}

type ViewMode = 'select' | 'view';

const STATUS_MAP: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  VERIFIED: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function ClassMonthPaymentsPage() {
  const { instituteId, classId: urlClassId, monthId: urlMonthId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const classIdParam = urlClassId || searchParams.get('classId');
  const monthIdsParam = urlMonthId ? urlMonthId : searchParams.get('monthIds');
  
  // Nested route: classId and monthId from URL params
  const isNestedRoute = !!urlClassId && !!urlMonthId;
  
  // Standalone: classId and monthIds from search params
  const isStandaloneRoute = !isNestedRoute && classIdParam && monthIdsParam;
  
  const viewMode: ViewMode = isNestedRoute ? 'view' : (isStandaloneRoute ? 'view' : 'select');

  // Select mode state
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [months, setMonths] = useState<MonthData[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [loadingClasses, setLoadingClasses] = useState(true);

  // View mode state
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [paymentOverview, setPaymentOverview] = useState<PaymentOverview | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedMonthNames, setSelectedMonthNames] = useState<string[]>([]);
  const [payFilter, setPayFilter] = useState<'all' | 'PAID' | 'LATE' | 'PENDING' | 'UNPAID'>('all');
  const [paymentUpdatingId, setPaymentUpdatingId] = useState('');
  const [verifyModal, setVerifyModal] = useState<{
    userId: string;
    studentName: string;
    status: 'PAID' | 'LATE' | 'UNPAID';
  } | null>(null);

  // Load classes
  useEffect(() => {
    api
      .get('/classes')
      .then(r => setClasses(r.data))
      .catch(() => {})
      .finally(() => setLoadingClasses(false));
  }, []);

  // Load months when class is selected
  useEffect(() => {
    if (selectedClass && viewMode === 'select') {
      api
        .get(`/classes/${selectedClass}/months`)
        .then(r => setMonths(r.data))
        .catch(() => setMonths([]));
    }
  }, [selectedClass, viewMode]);

  // Load payments when in view mode
  useEffect(() => {
    if ((viewMode === 'view' || isNestedRoute) && classIdParam && monthIdsParam) {
      setLoadingPayments(true);
      
      // For nested route, use single monthId endpoint
      if (isNestedRoute) {
        api
          .get(`/payments/class/${classIdParam}/month/${monthIdsParam}`)
          .then(r => {
            setPaymentOverview(r.data || null);
            setPayments([]);
          })
          .catch(() => {
            setPaymentOverview(null);
            setPayments([]);
          })
          .finally(() => setLoadingPayments(false));
      } else {
        // Standalone mode: keep original behavior
        const queryMonthIds = monthIdsParam;
        api
          .get(`/payments/class-months?classId=${classIdParam}&monthIds=${queryMonthIds}`)
          .then(r => {
            setPayments(r.data || []);
            setPaymentOverview(null);
          })
          .catch(() => {
            setPayments([]);
            setPaymentOverview(null);
          })
          .finally(() => setLoadingPayments(false));
      }

      // Get class name
      api
        .get(`/classes/${classIdParam}`)
        .then(r => setSelectedClassName(r.data?.name || 'Class'))
        .catch(() => setSelectedClassName('Class'));

      // Get month names
      api
        .get(`/classes/${classIdParam}/months`)
        .then(r => {
          if (isNestedRoute) {
            const month = (r.data || []).find((m: any) => m.id === monthIdsParam);
            setSelectedMonthNames(month ? [month.name] : []);
          } else {
            const ids = monthIdsParam.split(',');
            const names = ids
              .map(id => (r.data || []).find((m: any) => m.id === id)?.name)
              .filter(Boolean);
            setSelectedMonthNames(names);
          }
        })
        .catch(() => setSelectedMonthNames([]));
    }
  }, [viewMode, classIdParam, monthIdsParam, isNestedRoute]);

  const handleMonthToggle = (monthId: string) => {
    const newSet = new Set(selectedMonths);
    if (newSet.has(monthId)) {
      newSet.delete(monthId);
    } else {
      newSet.add(monthId);
    }
    setSelectedMonths(newSet);
  };

  const handleViewPayments = () => {
    if (!selectedClass || selectedMonths.size === 0) {
      alert('Please select a class and at least one month');
      return;
    }
    const monthIds = Array.from(selectedMonths).join(',');
    navigate(`${getInstitutePath(instituteId, '/class-payments')}?classId=${selectedClass}&monthIds=${monthIds}`);
  };

  const handleBackToSelect = () => {
    if (isNestedRoute) {
      // Go back to month detail page
      navigate(getInstitutePath(instituteId, `/classes/${classIdParam}/months/${monthIdsParam}`));
    } else {
      // Go back to selection mode
      navigate(getInstitutePath(instituteId, '/class-payments'));
    }
  };

  const setStudentPaymentStatus = async (userId: string, status: 'PAID' | 'LATE' | 'UNPAID') => {
    if (!isNestedRoute || !monthIdsParam) return;
    setPaymentUpdatingId(`${userId}:${status}`);
    try {
      await api.patch(`/payments/student/${userId}/month/${monthIdsParam}/status`, { status, adminNote: '' });
      const { data } = await api.get(`/payments/class/${classIdParam}/month/${monthIdsParam}`);
      setPaymentOverview(data || null);
      setVerifyModal(null);
    } catch {
      console.error('Failed to update payment status');
    } finally {
      setPaymentUpdatingId('');
    }
  };

  if (viewMode === 'select') {
    return (
      <div className="w-full space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.7}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Class Payments</h1>
              <p className="text-[hsl(var(--muted-foreground))] text-sm">Select class and months to view payments</p>
            </div>
          </div>
        </div>

        {/* Selection Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Class Selection */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Select Class</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Choose which class to view</p>
              </div>
            </div>

            {loadingClasses ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 skeleton rounded-lg" />
                ))}
              </div>
            ) : classes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[hsl(var(--muted-foreground))] text-sm">No classes available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {classes.map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => {
                      setSelectedClass(cls.id);
                      setSelectedMonths(new Set());
                    }}
                    className={`w-full px-4 py-3 rounded-lg border-2 font-semibold text-sm transition-all ${
                      selectedClass === cls.id
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary)/0.3)]'
                    }`}
                  >
                    {cls.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Month Selection */}
          <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Select Months</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Choose one or more months</p>
              </div>
            </div>

            {!selectedClass ? (
              <div className="text-center py-8">
                <p className="text-[hsl(var(--muted-foreground))] text-sm">Select a class first</p>
              </div>
            ) : months.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[hsl(var(--muted-foreground))] text-sm">No months available for this class</p>
              </div>
            ) : (
              <div className="space-y-2">
                {months.map(month => (
                  <button
                    key={month.id}
                    onClick={() => handleMonthToggle(month.id)}
                    className={`w-full px-4 py-3 rounded-lg border-2 font-semibold text-sm transition-all flex items-center gap-3 ${
                      selectedMonths.has(month.id)
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary)/0.3)]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        selectedMonths.has(month.id)
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
                          : 'border-[hsl(var(--border))]'
                      }`}
                    >
                      {selectedMonths.has(month.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    {month.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleViewPayments}
            disabled={!selectedClass || selectedMonths.size === 0}
            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 disabled:from-[hsl(var(--muted))] disabled:to-[hsl(var(--muted))] disabled:text-[hsl(var(--muted-foreground))] transition-all shadow-lg shadow-blue-500/25 disabled:shadow-none"
          >
            View Payments
          </button>
        </div>
      </div>
    );
  }

  // View mode
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
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Class Payments</h1>
            <p className="text-[hsl(var(--muted-foreground))] text-sm">View payments for selected class and months</p>
          </div>
        </div>
        <button
          onClick={handleBackToSelect}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-all text-sm font-semibold"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Change Selection
        </button>
      </div>

      {/* Selection Info Card */}
      <div className="bg-gradient-to-r from-[hsl(var(--primary)/0.1)] to-[hsl(var(--accent)/0.1)] rounded-2xl border border-[hsl(var(--primary)/0.2)] p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">Selected Class</p>
            <p className="text-lg font-bold text-[hsl(var(--foreground))]">{selectedClassName}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">Selected Months ({selectedMonthNames.length})</p>
            <div className="flex flex-wrap gap-2">
              {selectedMonthNames.map((name, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-[hsl(var(--primary))] text-white"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden shadow-sm">
        {loadingPayments ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 skeleton rounded-xl" />
            ))}
          </div>
        ) : isNestedRoute && paymentOverview ? (
          // Physical payments overview format
          paymentOverview.students.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-7 h-7 text-[hsl(var(--muted-foreground)/0.4)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <p className="text-[hsl(var(--foreground))] text-sm font-medium">No students found</p>
              <p className="text-[hsl(var(--muted-foreground))] text-xs mt-1">No payment records for this month</p>
            </div>
          ) : (
            <>
              {/* Summary Stats - Tab Style */}
              <div className="flex gap-0 bg-white border-b border-slate-200">
                <button
                  onClick={() => setPayFilter('all')}
                  className={`flex-1 py-3 px-4 text-center transition-all ${payFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <p className="text-xs font-semibold">TOTAL</p>
                  <p className="text-lg font-bold">{paymentOverview.summary.total}</p>
                </button>
                <button
                  onClick={() => setPayFilter('PAID')}
                  className={`flex-1 py-3 px-4 text-center transition-all ${payFilter === 'PAID' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <p className="text-xs font-semibold">PAID</p>
                  <p className="text-lg font-bold">{paymentOverview.summary.paid}</p>
                </button>
                <button
                  onClick={() => setPayFilter('LATE')}
                  className={`flex-1 py-3 px-4 text-center transition-all ${payFilter === 'LATE' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <p className="text-xs font-semibold">LATE</p>
                  <p className="text-lg font-bold">{paymentOverview.summary.late}</p>
                </button>
                <button
                  onClick={() => setPayFilter('PENDING')}
                  className={`flex-1 py-3 px-4 text-center transition-all ${payFilter === 'PENDING' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <p className="text-xs font-semibold">PENDING</p>
                  <p className="text-lg font-bold">{paymentOverview.summary.pending}</p>
                </button>
                <button
                  onClick={() => setPayFilter('UNPAID')}
                  className={`flex-1 py-3 px-4 text-center transition-all ${payFilter === 'UNPAID' ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <p className="text-xs font-semibold">UNPAID</p>
                  <p className="text-lg font-bold">{paymentOverview.summary.unpaid}</p>
                </button>
              </div>

              {/* Students Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse">
                  <thead>
                    <tr className="bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))] text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                      <th className="px-5 py-3 text-left">Student Name</th>
                      <th className="px-5 py-3 text-left">Email</th>
                      <th className="px-5 py-3 text-left">Status</th>
                      <th className="px-5 py-3 text-left">Slip Status</th>
                      <th className="px-5 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(var(--border))]">
                    {paymentOverview.students
                      .filter(student => payFilter === 'all' || student.paymentStatus === payFilter)
                      .map(student => {
                        const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
                          PAID: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
                          LATE: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
                          PENDING: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
                          UNPAID: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
                        };
                        const statusInfo = statusColors[student.paymentStatus] || statusColors.UNPAID;
                        const slipStatus = student.slip?.status || 'No slip';
                        const slipStatusColors: Record<string, { bg: string; text: string; dot: string }> = {
                          VERIFIED: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
                          PENDING: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
                          REJECTED: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
                        };
                        const slipInfo = slipStatusColors[slipStatus] || { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700', dot: 'bg-gray-500' };
                        
                        return (
                          <tr key={student.userId} className="hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                            <td className="px-5 py-4 text-sm font-medium text-[hsl(var(--foreground))]">
                              {student.profile?.fullName || 'Unknown'}
                            </td>
                            <td className="px-5 py-4 text-sm text-[hsl(var(--muted-foreground))]">
                              {student.email}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                                {student.paymentStatus}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${slipInfo.bg} ${slipInfo.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${slipInfo.dot}`} />
                                {slipStatus}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              {(student.paymentStatus === 'LATE' || student.paymentStatus === 'UNPAID') && (
                                <button
                                  onClick={() => setVerifyModal({
                                    userId: student.userId,
                                    studentName: student.profile?.fullName || student.email,
                                    status: student.paymentStatus as 'PAID' | 'LATE' | 'UNPAID',
                                  })}
                                  disabled={!!paymentUpdatingId}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-all"
                                >
                                  Verify
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : payments.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-7 h-7 text-[hsl(var(--muted-foreground)/0.4)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <p className="text-[hsl(var(--foreground))] text-sm font-medium">No payments found</p>
            <p className="text-[hsl(var(--muted-foreground))] text-xs mt-1">No payment records for selected class and months</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))] text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">Month</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {payments.map(payment => {
                  const statusInfo = STATUS_MAP[payment.status || ''] || {
                    bg: 'bg-gray-50 border-gray-200',
                    text: 'text-gray-700',
                    dot: 'bg-gray-500',
                  };
                  return (
                    <tr key={payment.id} className="hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-[hsl(var(--foreground))]">
                        {payment.month?.name || '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                          {payment.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-[hsl(var(--muted-foreground))]">
                        {payment.type || '—'}
                      </td>
                      <td className="px-5 py-4 text-sm text-[hsl(var(--muted-foreground))]">
                        {formatDate(payment.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Verify Modal */}
      {verifyModal && createPortal(
        <div
          className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setVerifyModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-800 text-lg">Verify Payment</h2>
                <p className="text-xs text-slate-400 mt-0.5">{verifyModal.studentName}</p>
              </div>
              <button
                onClick={() => setVerifyModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-600 block mb-2">Payment Status</label>
                <select
                  value={verifyModal.status}
                  onChange={(e) =>
                    setVerifyModal(prev =>
                      prev ? { ...prev, status: e.target.value as 'PAID' | 'LATE' | 'UNPAID' } : prev
                    )
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                >
                  <option value="PAID">Paid</option>
                  <option value="LATE">Late</option>
                  <option value="UNPAID">Unpaid</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setVerifyModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const current = verifyModal;
                  setStudentPaymentStatus(current.userId, current.status);
                }}
                disabled={!!paymentUpdatingId}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {paymentUpdatingId === verifyModal.userId ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
