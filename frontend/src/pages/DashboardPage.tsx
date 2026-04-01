import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function DashboardPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data.slice(0, 6))).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const name = user?.profile?.fullName?.split(' ')[0] || 'Student';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const initials = user?.profile?.fullName
    ? user.profile.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Welcome Hero */}
      <div className="relative bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-2xl p-6 md:p-8 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-blue-300 text-sm font-medium flex items-center gap-2">
              <span className="text-lg">&#9728;&#65039;</span> {greeting},
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">{name}!</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-md">Welcome back to your learning dashboard. Continue where you left off.</p>
            {user?.profile?.instituteId && (
              <div className="inline-flex mt-3 px-3 py-1.5 rounded-lg bg-white/10 border border-white/10">
                <span className="text-xs text-blue-300 font-mono tracking-wide">ID: {user.profile.instituteId}</span>
              </div>
            )}
          </div>
          <div className="hidden md:flex w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400/30 to-purple-500/30 items-center justify-center flex-shrink-0 border border-white/10 animate-float">
            <span className="text-white text-3xl font-black">{initials}</span>
          </div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'MY CLASSES', desc: 'View enrolled', to: '/classes', gradient: 'from-amber-400 to-orange-500', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
          { label: 'UPLOAD SLIP', desc: 'Submit receipt', to: '/payments/submit', gradient: 'from-rose-400 to-red-500', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
          { label: 'PAYMENTS', desc: 'Track history', to: '/payments/my', gradient: 'from-blue-400 to-blue-600', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
          { label: 'STUDENT ID', desc: user?.profile?.instituteId || 'Not assigned', to: '/dashboard', gradient: 'from-emerald-400 to-green-600', icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2' },
        ].map(({ label, desc, to, gradient, icon }) => (
          <Link key={label} to={to}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 sm:p-5 flex flex-col items-center text-center card-hover group shadow-sm transition-colors duration-300">
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg mb-3 group-hover:scale-110 transition-transform duration-300`}>
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
            </div>
            <p className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm tracking-wide">{label}</p>
            <p className="text-slate-400 dark:text-slate-500 text-[10px] sm:text-xs mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Available Classes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Available Classes</h2>
          <Link to="/classes" className="text-sm text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition flex items-center gap-1">
            View all
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 h-32 skeleton" />)}
          </div>
        ) : classes.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">No classes available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls: any) => (
              <Link key={cls.id} to={`/classes/${cls.id}`}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 card-hover group shadow-sm transition-colors duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                    <span className="text-white text-sm font-bold">{cls.name?.[0]?.toUpperCase() || 'C'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition text-sm truncate">{cls.name}</p>
                    {cls.subject && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{cls.subject}</p>}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{cls.description || 'No description'}</p>
                {cls.monthlyFee != null && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs text-slate-400 dark:text-slate-500">Monthly fee</span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Rs. {Number(cls.monthlyFee).toLocaleString()}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
