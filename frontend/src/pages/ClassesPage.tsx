import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInstitute } from '../context/InstituteContext';
import api from '../lib/api';
import { getInstitutePath } from '../lib/instituteRoutes';

const statusConfig: Record<string, { label: string; class: string }> = {
  PUBLIC:           { label: 'Public',        class: 'badge-public' },
  ANYONE:           { label: 'Public',        class: 'badge-public' },
  STUDENTS_ONLY:    { label: 'Students',      class: 'badge-student' },
  ENROLLED_ONLY:    { label: 'Enrolled Only', class: 'bg-amber-100 text-amber-700 border border-amber-300' },
  PAID_ONLY:        { label: 'Paid',          class: 'badge-paid' },
  PRIVATE:          { label: 'Private',       class: 'badge-private' },
  STUDENT_ONLY:     { label: 'Students',      class: 'badge-student' },
  PAID_STUDENT_ONLY:{ label: 'Paid',          class: 'badge-paid' },
  ACTIVE:           { label: 'Active',        class: 'badge-public' },
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
  const { selected } = useInstitute();
  const { instituteId: routeInstituteId } = useParams();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    api.get('/classes').then(r => {
      const visible = (r.data || []).filter((c: any) => {
        if (user) return !['INACTIVE', 'PRIVATE'].includes(c.status);
        return !['INACTIVE', 'PRIVATE', 'STUDENTS_ONLY', 'ENROLLED_ONLY', 'PAID_ONLY'].includes(c.status);
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
  const getClassLink = (cls: any) => getInstitutePath(routeInstituteId || selected?.id || cls.instituteId || cls.institute?.id || null, `/classes/${cls.id}`);

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
        <div className="grid [grid-template-columns:repeat(auto-fit,minmax(310px,370px))] justify-center sm:justify-start gap-5">
          {filtered.map((cls: any, idx: number) => {
            const grad = gradients[idx % gradients.length];
            const badge = statusConfig[cls.status];
            return (
              <div key={cls.id} className="relative w-full max-w-[370px] flex flex-col rounded-xl bg-white bg-clip-border text-gray-700 shadow-md border border-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg">
                <div className={`relative mx-3 mt-3 h-36 overflow-hidden rounded-xl bg-clip-border text-white shadow-lg shadow-blue-gray-500/30 bg-gradient-to-r ${grad}`}>
                  {cls.thumbnail ? (
                    <img src={cls.thumbnail} alt={cls.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white/30 text-7xl font-black">{cls.name?.[0]?.toUpperCase() || 'C'}</span>
                    </div>
                  )}
                  {badge && (
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${badge.class}`}>
                      {badge.label}
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <h5 className="mb-1.5 block text-lg font-semibold leading-snug tracking-normal text-slate-900 truncate">
                    {cls.name}
                  </h5>
                  <p className="block text-sm font-light leading-relaxed text-slate-600 line-clamp-2 min-h-[40px]">
                    {cls.description || 'No description available for this class yet.'}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    {cls.subject ? (
                      <span className="inline-block px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold uppercase tracking-wide truncate max-w-[58%]">
                        {cls.subject}
                      </span>
                    ) : <span className="text-slate-400">No subject</span>}
                    {cls.monthlyFee != null ? (
                      <span className="font-bold text-emerald-600">Rs. {Number(cls.monthlyFee).toLocaleString()} / mo</span>
                    ) : (
                      <span className="font-bold text-emerald-600">Free</span>
                    )}
                  </div>
                </div>

                <div className="p-4 pt-0 mt-auto">
                  <Link
                    to={getClassLink(cls)}
                    className="block w-full select-none rounded-lg bg-blue-500 py-2.5 px-4 text-center align-middle text-[11px] font-bold uppercase text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:shadow-blue-500/35 focus:opacity-[0.85] focus:shadow-none active:opacity-[0.85] active:shadow-none"
                  >
                    Select Class
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
