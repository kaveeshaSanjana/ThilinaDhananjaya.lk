import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

const QUICK_LINKS = [
  { to: '/admin/students', label: 'Students', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', gradient: 'from-blue-500 to-blue-600' },
  { to: '/admin/classes', label: 'Classes', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', gradient: 'from-indigo-500 to-indigo-600' },
  { to: '/admin/slips', label: 'Payment Slips', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', gradient: 'from-amber-500 to-orange-500' },
  { to: '/admin/attendance', label: 'Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', gradient: 'from-emerald-500 to-green-600' },
  { to: '/admin/recordings', label: 'Recordings', icon: 'M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', gradient: 'from-purple-500 to-purple-600' },
];

const STAT_CARDS = [
  { key: 'students', label: 'Total Students', gradient: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/25', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { key: 'classes', label: 'Classes', gradient: 'from-indigo-500 to-indigo-600', shadow: 'shadow-indigo-500/25', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { key: 'payments', label: 'Pending Slips', gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/25', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
  { key: 'recordings', label: 'Recordings', gradient: 'from-purple-500 to-purple-600', shadow: 'shadow-purple-500/25', icon: 'M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
];

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [classList, setClassList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/users/students').then(r => r.data?.length || 0).catch(() => 0),
      api.get('/classes').then(r => r.data || []).catch(() => []),
      api.get('/payments/pending').then(r => r.data?.length || 0).catch(() => 0),
      api.get('/recordings').then(r => r.data?.length || 0).catch(() => 0),
    ]).then(([students, classes, payments, recordings]) => {
      setClassList(classes);
      setCounts({ students, classes: classes.length, payments, recordings });
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Hero Banner */}
      <div className="relative bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-2xl p-6 md:p-8 overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-blue-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative z-10">
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-1">Admin Panel</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white">LMS Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1.5 max-w-md">Monitor your platform � students, classes, payments, and recordings at a glance.</p>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {QUICK_LINKS.map(({ to, label, icon, gradient }) => (
            <Link key={to} to={to}
              className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-2.5 shadow-md group-hover:scale-110 transition-transform`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-600 transition">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ key, label, gradient, shadow, icon }) => (
          <div key={key} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-lg ${shadow}`}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
            </div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
            {loading ? (
              <div className="h-8 w-16 bg-slate-100 rounded-lg mt-1.5 animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-slate-800 mt-1">{counts[key] ?? 0}</p>
            )}
          </div>
        ))}
      </div>

      {/* Available Classes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Available Classes</h2>
          <Link to="/admin/classes" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition">View all</Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : classList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <p className="text-sm text-slate-500">No classes available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {classList.slice(0, 6).map((cls: any) => (
              <Link
                key={cls.id}
                to={`/admin/classes/${cls.id}`}
                className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition">{cls.name}</p>
                <p className="text-xs text-slate-500 mt-1 truncate">{cls.subject || 'No subject'}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


