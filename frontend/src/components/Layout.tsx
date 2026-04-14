import { useState, useEffect } from 'react';
import { Outlet, Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useInstitute } from '../context/InstituteContext';
import api from '../lib/api';
import { getInstituteAdminPath, getInstitutePath, replaceInstituteAdminPath } from '../lib/instituteRoutes';
import logoImg from '../assets/logo.png';
import LandingStyleLoading from './LandingStyleLoading';

/* -------- Sidebar Nav Item -------- */
function NavItem({ to, icon, label, badge, onClick, exact }: { to: string; icon: React.ReactNode; label: string; badge?: number; onClick?: () => void; exact?: boolean }) {
  const { pathname } = useLocation();
  const active = exact
    ? pathname === to
    : pathname === to || (to !== '/' && to !== '/admin' && pathname.startsWith(to)) || (to === '/admin' && pathname === '/admin');
  return (
    <Link to={to} onClick={onClick}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
        active
          ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]'
          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
      }`}>
      <span className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${active ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground)/0.6)] group-hover:text-[hsl(var(--foreground))]'}`}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="px-1.5 py-0.5 rounded-md bg-[hsl(var(--danger))] text-[10px] font-bold text-white min-w-[18px] text-center">{badge}</span>
      )}
    </Link>
  );
}

/* -------- Section Label -------- */
function SideSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1">
      <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold text-[hsl(var(--muted-foreground)/0.5)] uppercase tracking-[0.15em]">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/* -------- Icons -------- */
const icons = {
  home: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  classes: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  pay: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  upload: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
  admin: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" /></svg>,
  students: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  attend: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  slips: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>,
  recordings: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  logout: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  bell: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  menu: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>,
  login: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>,
  lock: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V7.5a4.5 4.5 0 10-9 0v3m-1.5 0h12a1.5 1.5 0 011.5 1.5v7.5A1.5 1.5 0 0118 21H6a1.5 1.5 0 01-1.5-1.5V12A1.5 1.5 0 016 10.5z" /></svg>,
  sun: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  moon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
  materials: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  physAttend: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  qrAttend: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5h6v6h-6v-6zm9 0h6v6h-6v-6zm-9 9h6v6h-6v-6zm12 0h3m-3 3h3m-7 3h6" /></svg>,
  live: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><circle cx="9" cy="5" r="1.5" fill="currentColor" stroke="none" /><circle cx="9" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth={1.2} /></svg>,
  folder: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { institutes, selected, select, loading: instituteLoading } = useInstitute();
  const { instituteId: routeInstituteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedMonthName, setSelectedMonthName] = useState('');

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (user?.role === 'ADMIN' && routeInstituteId && selected?.id !== routeInstituteId) {
      select(routeInstituteId);
    }
  }, [routeInstituteId, selected?.id, select, user?.role]);

  useEffect(() => {
    if (routeInstituteId && localStorage.getItem('selectedInstituteId') !== routeInstituteId) {
      localStorage.setItem('selectedInstituteId', routeInstituteId);
    }
  }, [routeInstituteId]);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const initials = user?.profile?.fullName
    ? user.profile.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  const hour = time.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const scopedPathname = location.pathname.replace(/^\/institute\/[^/]+/, '');

  // Detect class+month detail: [/institute/:instituteId]/classes/:classId/months/:monthId[/...]
  const classMonthMatch = scopedPathname.match(/^\/classes\/([^/]+)\/months\/([^/]+)/);
  const isMonthDetail = !!classMonthMatch;
  const monthDetailClassId = classMonthMatch?.[1] ?? null;
  const monthDetailMonthId = classMonthMatch?.[2] ?? null;
  const isInstituteSelectPage = location.pathname === '/admin/select-institute';
  const adminInstituteId = routeInstituteId || selected?.id || null;
  const adminBasePath = getInstituteAdminPath(adminInstituteId);
  const scopedInstituteId = routeInstituteId || selected?.id || null;
  const selectedInstitute = selected as (typeof selected & {
    shortName?: string;
    code?: string;
    logo?: string;
    image?: string;
    imgUrl?: string;
  }) | null;

  const selectedInstituteImage =
    selectedInstitute?.logoUrl ||
    selectedInstitute?.logo ||
    selectedInstitute?.image ||
    selectedInstitute?.imgUrl ||
    '';

  const isClassDetail = !isMonthDetail && /^\/classes\/[^/]+(\/class-recordings)?$/.test(scopedPathname);
  const classId = isClassDetail ? scopedPathname.split('/')[2] : (isMonthDetail ? monthDetailClassId : null);

  useEffect(() => {
    if (!classId) { setSelectedClassName(''); return; }
    api.get(`/classes/${classId}`)
      .then((res) => setSelectedClassName(res.data?.name || 'Selected Class'))
      .catch(() => setSelectedClassName('Selected Class'));
  }, [classId]);

  useEffect(() => {
    if (!monthDetailClassId || !monthDetailMonthId) { setSelectedMonthName(''); return; }
    api.get(`/classes/${monthDetailClassId}/months`)
      .then((res) => {
        const month = (res.data || []).find((m: any) => m.id === monthDetailMonthId);
        setSelectedMonthName(month?.name || 'Selected Month');
      })
      .catch(() => setSelectedMonthName('Selected Month'));
  }, [monthDetailClassId, monthDetailMonthId]);

  // ---------- PUBLIC LAYOUT (no sidebar) ----------
  if (!user) {
    const isLandingPage = location.pathname === '/' || location.pathname === '/landing';
    if (isLandingPage) {
      return <Outlet />;
    }
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] transition-colors duration-300">
        {/* Top navbar for public */}
        <header className="sticky top-0 z-30 bg-[hsl(var(--card)/0.85)] backdrop-blur-xl border-b border-[hsl(var(--border))] transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            {/* Brand */}
            <Link to="/landing" className="flex items-center gap-2.5">
              <img src={logoImg} alt="Eazy English" className="h-10 w-10 object-contain" />
              <span className="text-base font-bold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Eazy English</span>
            </Link>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme}
                className="p-2 rounded-xl text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-all duration-200">
                <span className="w-5 h-5 block">{theme === 'light' ? icons.moon : icons.sun}</span>
              </button>
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] rounded-xl hover:bg-[hsl(var(--muted))] transition">
                Login
              </Link>
              <Link to="/register" className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-glow))] rounded-xl hover:shadow-lg hover:shadow-[hsl(var(--primary)/0.25)] transition-all duration-300">
                Register
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </main>
      </div>
    );
  }

  if (user.role === 'ADMIN' && instituteLoading) {
    return <LandingStyleLoading />;
  }

  if (
    user.role === 'ADMIN' &&
    institutes.length > 0 &&
    !selected &&
    location.pathname !== '/admin/select-institute'
  ) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/admin/select-institute?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  // ---------- AUTHENTICATED LAYOUT (with sidebar) ----------
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[hsl(var(--border))]">
        <Link to={user.role === 'ADMIN' ? adminBasePath : getInstitutePath(scopedInstituteId, '/dashboard')} className="flex items-center gap-2.5">
          <img src={logoImg} alt="Eazy English" className="h-8 w-8 object-contain" />
          <span className="text-[13px] font-bold text-[hsl(var(--foreground))] leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Eazy English</span>
        </Link>
        <div className="flex items-center gap-0.5">
          <button onClick={toggleTheme} className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition" title="Toggle theme">
            <span className="w-4 h-4 block">{theme === 'light' ? icons.moon : icons.sun}</span>
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-3 overflow-y-auto sidebar-scroll">
        {isInstituteSelectPage ? (
          <SideSection label="Setup">
            <NavItem to="/admin/select-institute" icon={icons.admin} label="Select Institute" exact />
          </SideSection>
        ) : (
          <>
        {/* Institute selector card */}
        {user?.role === 'ADMIN' && institutes.length > 0 && !isClassDetail && !isMonthDetail && (
          <div className="mt-3 space-y-3">
            {selectedInstitute && (
              <div className="mx-2 rounded-2xl p-[1px] bg-gradient-to-br from-[hsl(var(--primary)/0.35)] via-[hsl(var(--primary-glow)/0.28)] to-[hsl(var(--border))] shadow-[0_10px_28px_hsl(var(--primary)/0.15)]">
                <div className="rounded-[15px] p-4 bg-[linear-gradient(145deg,hsl(var(--card))_0%,hsl(var(--card)/0.94)_68%,hsl(var(--primary)/0.06)_100%)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {selectedInstituteImage ? (
                        <img
                          src={selectedInstituteImage}
                          alt={selectedInstitute.name}
                          className="w-12 h-12 rounded-xl object-cover ring-1 ring-[hsl(var(--border))] shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary)/0.2)] to-[hsl(var(--primary)/0.08)] flex items-center justify-center shrink-0 ring-1 ring-[hsl(var(--primary)/0.25)]">
                          <svg className="h-6 w-6 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h2 className="text-[15px] font-extrabold text-[hsl(var(--foreground))] truncate leading-tight">{selectedInstitute.name}</h2>
                        {selectedInstitute.shortName && (
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{selectedInstitute.shortName}</p>
                        )}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] border border-[hsl(var(--primary)/0.2)]">
                      Active
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {selectedInstitute.code && (
                      <span className="text-[10px] text-[hsl(var(--foreground))] bg-[hsl(var(--background)/0.7)] border border-[hsl(var(--border))] px-2 py-0.5 rounded-full font-mono">
                        {selectedInstitute.code}
                      </span>
                    )}
                    {selectedInstitute.slug && (
                      <span className="text-[10px] text-[hsl(var(--foreground))] bg-[hsl(var(--background)/0.7)] border border-[hsl(var(--border))] px-2 py-0.5 rounded-full font-mono truncate max-w-[130px]">
                        {selectedInstitute.slug}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {institutes.length > 1 && (
              <div className="mx-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.88)] backdrop-blur-sm p-3 shadow-[0_6px_20px_hsl(var(--foreground)/0.05)]">
                <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1.5">Switch Institute</p>
                <select
                  value={selected?.id || ''}
                  onChange={e => {
                    const nextInstituteId = e.target.value;
                    select(nextInstituteId);
                    navigate(adminInstituteId ? replaceInstituteAdminPath(location.pathname, nextInstituteId) : getInstituteAdminPath(nextInstituteId));
                  }}
                  className="w-full text-[12px] font-semibold bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl px-2.5 py-2 text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] outline-none transition"
                >
                  {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Class/month selector card */}
        {(isClassDetail || isMonthDetail) && (
          <div className="mt-3 space-y-3">
            <div className="mx-2 rounded-2xl p-[1px] bg-gradient-to-br from-[hsl(var(--primary)/0.28)] to-[hsl(var(--border))] shadow-[0_8px_24px_hsl(var(--primary)/0.12)]">
              <div className="rounded-[15px] p-4 bg-[linear-gradient(145deg,hsl(var(--card))_0%,hsl(var(--card)/0.95)_100%)]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary)/0.2)] to-[hsl(var(--primary)/0.06)] flex items-center justify-center shrink-0 ring-1 ring-[hsl(var(--primary)/0.2)]">
                    <span className="w-6 h-6 text-[hsl(var(--primary))]">{icons.classes}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-[15px] font-extrabold text-[hsl(var(--foreground))] truncate">{selectedClassName || 'Selected Class'}</h2>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Class</span>
                      {isMonthDetail && (
                        <span className="text-[10px] text-[hsl(var(--foreground))] bg-[hsl(var(--background)/0.72)] border border-[hsl(var(--border))] px-2 py-0.5 rounded-full font-medium">{selectedMonthName || 'Selected Month'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-2 flex items-center gap-2 flex-wrap">
              <Link
                to={getInstitutePath(scopedInstituteId, '/classes')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                All Classes
              </Link>

              {isMonthDetail && (
                <Link
                  to={getInstitutePath(scopedInstituteId, `/classes/${monthDetailClassId}`)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  Back To Months
                </Link>
              )}
            </div>
          </div>
        )}

        {isMonthDetail ? (
          <>
          <SideSection label="Content">
            <NavItem to={getInstitutePath(scopedInstituteId, `/classes/${monthDetailClassId}/months/${monthDetailMonthId}`)} icon={icons.recordings} label="Recordings" exact />
            <NavItem to={getInstitutePath(scopedInstituteId, `/classes/${monthDetailClassId}/months/${monthDetailMonthId}/live-lessons`)} icon={icons.live} label="Live Lessons" exact />
            <NavItem to={getInstitutePath(scopedInstituteId, `/classes/${monthDetailClassId}/months/${monthDetailMonthId}/media`)} icon={icons.folder} label="Materials" exact />
          </SideSection>
          <SideSection label="Attendance">
            {user?.role === 'ADMIN' && (
              <NavItem to={getInstitutePath(scopedInstituteId, `/classes/${monthDetailClassId}/months/${monthDetailMonthId}/rec-attendance`)} icon={icons.attend} label="Recording Attendance" exact />
            )}
            {user?.role === 'STUDENT' && (
              <NavItem to={getInstitutePath(scopedInstituteId, `/classes/${monthDetailClassId}/months/${monthDetailMonthId}/my-attendance`)} icon={icons.attend} label="My Rec Attendance" exact />
            )}
          </SideSection>
          <SideSection label="Payments">
            {user?.role === 'STUDENT' && (
              <>
                <NavItem to={getInstitutePath(scopedInstituteId, '/payments/submit')} icon={icons.upload} label="Upload Slip" />
                <NavItem to={getInstitutePath(scopedInstituteId, '/payments/my')} icon={icons.pay} label="My Payments" />
              </>
            )}
            {user?.role === 'ADMIN' && (
              <NavItem to={`${getInstituteAdminPath(adminInstituteId, '/slips')}?tab=physical&classId=${monthDetailClassId}&monthId=${monthDetailMonthId}`} icon={icons.slips} label="Class Payments" />
            )}
          </SideSection>
          </>
        ) : isClassDetail ? (
          <SideSection label="Class">
            <NavItem to={getInstitutePath(scopedInstituteId, `/classes/${classId}`)} icon={icons.classes} label="Months" exact />
          </SideSection>
        ) : (
          <>
            <SideSection label="Main">
              <NavItem to={user.role === 'ADMIN' ? adminBasePath : getInstitutePath(scopedInstituteId, '/dashboard')} icon={icons.home} label="Dashboard" exact={user.role === 'ADMIN'} />
            </SideSection>

            <SideSection label="Classes">
              <NavItem to={getInstitutePath(scopedInstituteId, '/classes')} icon={icons.classes} label="All Classes" />
            </SideSection>

            {user.role === 'STUDENT' && (
              <>
                <SideSection label="Payments">
                  <NavItem to={getInstitutePath(scopedInstituteId, '/payments/submit')} icon={icons.upload} label="Upload Slip" />
                  <NavItem to={getInstitutePath(scopedInstituteId, '/payments/my')} icon={icons.pay} label="My Payments" />
                </SideSection>
                <SideSection label="Activity">
                  <NavItem to={getInstitutePath(scopedInstituteId, '/watch-history')} icon={icons.recordings} label="Watch History" />
                  <NavItem to={getInstitutePath(scopedInstituteId, '/my-class-attendance')} icon={icons.attend} label="My Attendance" />
                </SideSection>
              </>
            )}

            {user.role === 'ADMIN' && (
              <SideSection label="Administration">
                <NavItem to={getInstituteAdminPath(adminInstituteId, '/students')} icon={icons.students} label="Students" />
                <NavItem to={getInstituteAdminPath(adminInstituteId, '/classes')} icon={icons.classes} label="Manage Classes" />
                <NavItem to={getInstituteAdminPath(adminInstituteId, '/slips')} icon={icons.slips} label="Payment" />
                <NavItem to={getInstituteAdminPath(adminInstituteId, '/attendance')} icon={icons.attend} label="Recording Attendance" />
                <NavItem to={getInstituteAdminPath(adminInstituteId, '/mark-attendance')} icon={icons.qrAttend} label="Mark Attendance" />
                <NavItem to={getInstituteAdminPath(adminInstituteId, '/mark-attendance/external-device')} icon={icons.physAttend} label="Mark Attendance - External Device" />
                <NavItem to={getInstituteAdminPath(adminInstituteId, '/class-attendance')} icon={icons.attend} label="View Physical Attendance" />
                <NavItem to={getInstituteAdminPath(adminInstituteId, '/recordings')} icon={icons.recordings} label="Recordings" />
                <NavItem to={getInstituteAdminPath(adminInstituteId, '/id-cards')} icon={icons.students} label="ID Cards" />
                <NavItem to={getInstituteAdminPath(adminInstituteId, '/institute')} icon={icons.admin} label="Institute Settings" />
              </SideSection>
            )}

            <SideSection label="Account">
              <NavItem to={getInstitutePath(scopedInstituteId, '/change-password')} icon={icons.lock} label="Change Password" />
            </SideSection>
          </>
        )}
          </>
        )}
      </nav>

      {/* Bottom: User profile + Logout */}
      <div className="px-4 py-4 border-t border-[hsl(var(--border))]">
        <Link to={user.role === 'ADMIN' ? adminBasePath : getInstitutePath(scopedInstituteId, '/dashboard')} className="flex items-center gap-3 mb-3 rounded-xl px-2 py-2 -mx-2 hover:bg-[hsl(var(--muted))] transition-all duration-200 cursor-pointer group">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center flex-shrink-0 ring-2 ring-[hsl(var(--card))] shadow-md">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-[hsl(var(--foreground))] truncate uppercase tracking-wide leading-tight group-hover:text-[hsl(var(--primary))] transition-colors">
              {user.profile?.fullName || user.email}
            </p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate mt-0.5">
              {user.role === 'ADMIN' ? 'Administrator' : 'Student'}
            </p>
          </div>
        </Link>
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[hsl(var(--border))] text-[13px] font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--danger)/0.08)] hover:text-[hsl(var(--danger))] hover:border-[hsl(var(--danger)/0.2)] transition-all duration-200 bg-[hsl(var(--card))]">
          <span className="w-4 h-4 flex-shrink-0">{icons.logout}</span>
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))] transition-colors duration-300">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[255px] xl:w-[270px] bg-[hsl(var(--card))] flex-shrink-0 shadow-lg border-r border-[hsl(var(--border))]">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-[85vw] max-w-[300px] bg-[hsl(var(--card))] flex flex-col shadow-2xl animate-slide-in">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="bg-[hsl(var(--card)/0.85)] backdrop-blur-xl min-h-14 flex items-center justify-between px-3 sm:px-6 py-2 flex-shrink-0 shadow-sm z-10 border-b border-[hsl(var(--border))] transition-colors duration-300">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded-xl transition">
              <span className="w-5 h-5 block">{icons.menu}</span>
            </button>
            <button onClick={() => navigate(-1)}
              className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded-xl transition"
              aria-label="Go back" title="Go back">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="hidden sm:block min-w-0">
              <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">{greeting}, {user.profile?.fullName?.split(' ')[0] || 'User'}!</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button className="relative p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded-xl transition lg:hidden">
              <span className="w-5 h-5 block">{icons.bell}</span>
            </button>
            <Link to={user.role === 'ADMIN' ? adminBasePath : getInstitutePath(scopedInstituteId, '/dashboard')}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center ring-2 ring-[hsl(var(--card))] shadow hover:ring-[hsl(var(--primary)/0.3)] transition-all cursor-pointer">
              <span className="text-white text-xs font-bold">{initials}</span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
