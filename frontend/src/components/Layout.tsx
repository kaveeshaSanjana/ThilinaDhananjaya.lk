import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

/* -------- Sidebar Nav Item -------- */
function NavItem({ to, icon, label, badge, onClick }: { to: string; icon: React.ReactNode; label: string; badge?: number; onClick?: () => void }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== '/' && to !== '/admin' && pathname.startsWith(to)) || (to === '/admin' && pathname === '/admin');
  return (
    <Link to={to} onClick={onClick}
      className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
        active
          ? 'bg-blue-50 dark:bg-white/15 text-blue-700 dark:text-white shadow-sm dark:shadow-lg dark:shadow-black/10 border border-blue-100 dark:border-transparent'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/8 hover:text-slate-900 dark:hover:text-white border border-transparent'
      }`}>
      <span className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${active ? 'scale-110 text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:scale-105'}`}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="px-1.5 py-0.5 rounded-md bg-red-500 text-[10px] font-bold text-white min-w-[18px] text-center">{badge}</span>
      )}
    </Link>
  );
}

/* -------- Section Label -------- */
function SectionLabel({ label }: { label: string }) {
  return <p className="px-4 pt-5 pb-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">{label}</p>;
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
  sun: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  moon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const initials = user?.profile?.fullName
    ? user.profile.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  const hour = time.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  /* -------- Sidebar Content -------- */
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-shadow">
            <span className="text-white text-sm font-black tracking-tight">TD</span>
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-800 dark:text-white leading-tight tracking-tight">ThilinaDhananjaya</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 font-medium">Learning Management</p>
          </div>
        </Link>
      </div>

      {/* User card */}
      {user && (
        <div className="mx-3 mb-2 p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center ring-2 ring-white/20">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{user.profile?.fullName || user.email}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user.role === 'ADMIN' ? 'Administrator' : 'Student'}</p>
            </div>
          </div>
          {user.profile?.instituteId && (
            <div className="mt-2 px-2 py-1 rounded-md bg-slate-100 dark:bg-white/8 text-center">
              <span className="text-[10px] text-slate-500 dark:text-slate-300 font-mono">{user.profile.instituteId}</span>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto sidebar-scroll">
        {user && <NavItem to="/dashboard" icon={icons.home} label="Dashboard" />}

        <SectionLabel label="Classes" />
        <NavItem to="/classes" icon={icons.classes} label="All Classes" />

        {user?.role === 'STUDENT' && (
          <>
            <SectionLabel label="Payments" />
            <NavItem to="/payments/submit" icon={icons.upload} label="Upload Slip" />
            <NavItem to="/payments/my" icon={icons.pay} label="My Payments" />

            <SectionLabel label="Activity" />
            <NavItem to="/watch-history" icon={icons.recordings} label="Watch History" />
          </>
        )}

        {user?.role === 'ADMIN' && (
          <>
            <SectionLabel label="Administration" />
            <NavItem to="/admin" icon={icons.admin} label="Overview" />
            <NavItem to="/admin/students" icon={icons.students} label="Students" />
            <NavItem to="/admin/classes" icon={icons.classes} label="Manage Classes" />
            <NavItem to="/admin/slips" icon={icons.slips} label="Payment Slips" />
            <NavItem to="/admin/attendance" icon={icons.attend} label="Attendance" />
            <NavItem to="/admin/recordings" icon={icons.recordings} label="Recordings" />
          </>
        )}

        {!user && (
          <>
            <SectionLabel label="Account" />
            <NavItem to="/login" icon={icons.login} label="Sign In" />
          </>
        )}
      </nav>

      {/* Bottom */}
      {user && (
        <div className="px-3 py-4 border-t border-slate-200 dark:border-white/10">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-all duration-200">
            <span className="w-5 h-5">{icons.logout}</span>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9] dark:bg-[#0b1120] transition-colors duration-300">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-white dark:bg-gradient-to-b dark:from-[#0f172a] dark:to-[#1e293b] flex-shrink-0 shadow-xl dark:shadow-2xl border-r border-slate-200 dark:border-transparent">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-[280px] bg-white dark:bg-gradient-to-b dark:from-[#0f172a] dark:to-[#1e293b] flex flex-col shadow-2xl animate-slide-in">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="bg-white dark:bg-[#0f172a] h-16 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 shadow-sm dark:shadow-black/20 z-10 border-b border-transparent dark:border-slate-800 transition-colors duration-300">
          {/* Left */}
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">
              <span className="w-5 h-5 block">{icons.menu}</span>
            </button>
            {user && (
              <div className="hidden sm:block">
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{greeting}, {user.profile?.fullName?.split(' ')[0] || 'User'}!</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">{time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              <span className="w-5 h-5 block">{theme === 'light' ? icons.moon : icons.sun}</span>
            </button>

            {!user ? (
              <div className="flex gap-2">
                <Link to="/login" className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">Login</Link>
                <Link to="/register" className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300">Register</Link>
              </div>
            ) : (
              <>
                <button className="relative p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">
                  <span className="w-5 h-5 block">{icons.bell}</span>
                </button>
                <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-200 dark:border-slate-700">
                  <div className="text-right">
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 leading-tight">{user.profile?.fullName || user.email}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{user.role === 'ADMIN' ? 'Administrator' : 'Student'}</p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-white dark:ring-slate-800 shadow-lg">
                    <span className="text-white text-xs font-bold">{initials}</span>
                  </div>
                </div>
              </>
            )}
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
