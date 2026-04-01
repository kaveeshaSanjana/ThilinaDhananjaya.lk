import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

const LINKS: { to: string; label: string }[] = [
  { to: '/admin/students', label: 'Students' },
  { to: '/admin/classes', label: 'Classes' },
  { to: '/admin/slips', label: 'Payment Slips' },
  { to: '/admin/attendance', label: 'Attendance' },
  { to: '/admin/recordings', label: 'Recordings' },
];

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/users/students').then(r => r.data?.length || 0).catch(() => 0),
      api.get('/classes').then(r => r.data?.length || 0).catch(() => 0),
      api.get('/payments/pending').then(r => r.data?.length || 0).catch(() => 0),
      api.get('/recordings').then(r => r.data?.length || 0).catch(() => 0),
    ]).then(([students, classes, payments, recordings]) => {
      setCounts({ students, classes, payments, recordings });
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Overview of your LMS platform</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: 'students', label: 'Students' },
          { key: 'classes', label: 'Classes' },
          { key: 'payments', label: 'Pending Slips' },
          { key: 'recordings', label: 'Recordings' },
        ].map(({ key, label }) => (
          <div key={key} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
            {loading ? (
              <div className="h-8 w-16 bg-slate-100 dark:bg-slate-700 rounded mt-1 animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{counts[key] ?? 0}</p>
            )}
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {LINKS.map(({ to, label }) => (
            <Link key={to} to={to}
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition text-center">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
