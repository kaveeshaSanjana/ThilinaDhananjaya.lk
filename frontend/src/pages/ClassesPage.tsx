import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const statusConfig: Record<string, { label: string; class: string }> = {
  PUBLIC: { label: 'Public', class: 'badge-public' },
  PRIVATE: { label: 'Private', class: 'badge-private' },
  STUDENT_ONLY: { label: 'Students', class: 'badge-student' },
  PAID_STUDENT_ONLY: { label: 'Paid', class: 'badge-paid' },
  ACTIVE: { label: 'Active', class: 'badge-public' },
};

const gradients = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-purple-500 to-violet-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
];

export default function ClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    api.get('/classes').then(r => {
      const visible = (r.data || []).filter((c: any) => {
        if (user) return !['INACTIVE'].includes(c.status);
        return !['INACTIVE', 'PRIVATE'].includes(c.status);
      });
      setClasses(visible);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const filtered = classes.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || c.status === filter;
    return matchSearch && matchFilter;
  });

  const statuses = ['ALL', ...new Set(classes.map(c => c.status).filter(Boolean))];

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary-glow))] to-[hsl(var(--accent))] p-6 md:p-8 animate-gradient">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Explore Classes
          </h1>
          <p className="text-white/70 text-sm mt-1 max-w-md">
            {user ? `${classes.length} classes available for you` : `Browse our ${classes.length} available classes`}
          </p>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search classes..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground)/0.5)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] focus:border-[hsl(var(--primary)/0.5)] shadow-sm transition-all" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${filter === s
                ? 'bg-[hsl(var(--primary))] text-white shadow-md shadow-[hsl(var(--primary)/0.25)]'
                : 'bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.3)]'}`}>
              {s === 'ALL' ? 'All' : statusConfig[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3,4,5,6].map(i => <div key={i} className="rounded-2xl h-72 skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[hsl(var(--muted-foreground)/0.4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-[hsl(var(--muted-foreground))] text-sm font-medium">No classes found</p>
          {search && <p className="text-[hsl(var(--muted-foreground)/0.6)] text-xs mt-1">Try a different search term</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((cls: any, idx: number) => {
            const grad = gradients[idx % gradients.length];
            const badge = statusConfig[cls.status];
            return (
              <Link key={cls.id} to={`/classes/${cls.id}`}
                className="group bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden shadow-sm card-hover transition-colors duration-300">
                {/* Top visual */}
                <div className={`relative h-36 bg-gradient-to-br ${grad} overflow-hidden`}>
                  {cls.thumbnail ? (
                    <img src={cls.thumbnail} alt={cls.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white/30 text-7xl font-black">{cls.name?.[0]?.toUpperCase() || 'C'}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  {badge && (
                    <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${badge.class}`}>
                      {badge.label}
                    </span>
                  )}
                  {/* Play icon on hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-xl scale-75 group-hover:scale-100 transition-transform duration-300">
                      <svg className="w-5 h-5 text-[hsl(var(--primary))] ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-base font-bold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition truncate">
                    {cls.name}
                  </h3>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 line-clamp-2 leading-relaxed">
                    {cls.description || 'No description available'}
                  </p>
                  {cls.subject && (
                    <span className="inline-block mt-2 px-2.5 py-1 rounded-lg bg-[hsl(var(--primary)/0.08)] text-[10px] font-bold text-[hsl(var(--primary))] uppercase tracking-wider">
                      {cls.subject}
                    </span>
                  )}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-[hsl(var(--border))]">
                    {cls.monthlyFee != null ? (
                      <span className="text-sm font-bold text-[hsl(var(--accent))]">Rs. {Number(cls.monthlyFee).toLocaleString()}<span className="text-[10px] text-[hsl(var(--muted-foreground))] font-normal">/mo</span></span>
                    ) : (
                      <span className="text-xs font-semibold text-[hsl(var(--success))]">Free</span>
                    )}
                    <span className="text-xs font-semibold text-[hsl(var(--primary))] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      View
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
