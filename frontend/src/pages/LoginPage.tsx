import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import teacherImg from '../assets/teacher.png';
import classroomBg from '../assets/classroom-bg.png';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const u = await login(identifier, password);
      const redirect = searchParams.get('redirect');
      if (redirect && redirect.startsWith('/')) {
        navigate(redirect);
      } else {
        navigate(u?.role === 'ADMIN' ? '/admin' : '/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-[hsl(var(--background))]">
      {/* Left: Form Panel */}
      <div className="w-full lg:w-[44%] flex flex-col items-center justify-center px-6 py-10 lg:px-12 xl:px-16 relative">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        <div className="w-full max-w-[380px] relative z-10">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center shadow-lg shadow-[hsl(var(--primary)/0.3)] animate-gradient">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 11-6-11-6z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Eazy English</h1>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] font-medium tracking-wide">LEARNING MANAGEMENT SYSTEM</p>
            </div>
          </div>

          {/* Teacher card */}
          <div className="flex items-center gap-3 mb-8 p-3 rounded-2xl bg-[hsl(var(--muted))] border border-[hsl(var(--border))]">
            <img src={teacherImg} alt="Teacher" className="w-12 h-12 rounded-xl object-cover shadow-md" />
            <div>
              <p className="text-sm font-bold text-[hsl(var(--foreground))]">Thilina Dhananjaya</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">English Language Instructor</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">Welcome back 👋</h2>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mt-1 mb-6">Sign in to continue your learning journey</p>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-[hsl(var(--danger)/0.08)] border border-[hsl(var(--danger)/0.15)] text-sm text-[hsl(var(--danger))] flex items-center gap-2 animate-fade-in">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[hsl(var(--foreground))] mb-1.5">
                Email, Phone, ID or Birth Certificate
              </label>
              <input
                type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} required
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground)/0.5)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] focus:border-[hsl(var(--primary)/0.5)] transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[hsl(var(--foreground))] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground)/0.5)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] focus:border-[hsl(var(--primary)/0.5)] transition-all text-sm pr-12"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] rounded-lg transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    {showPw
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">Remember me</span>
              </label>
              <Link to="#" className="text-sm text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-glow))] font-semibold transition">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-glow))] text-white text-sm font-bold hover:shadow-lg hover:shadow-[hsl(var(--primary)/0.3)] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2">
              {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Registered by another one?{' '}
              <Link to="#" className="text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-glow))] font-semibold transition">Activate your account</Link>
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              New here?{' '}
              <Link to="/register" className="text-[hsl(var(--accent))] hover:text-[hsl(var(--accent))] font-semibold transition">Create Account</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right: Visual Panel with classroom background */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center">
        <img src={classroomBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,11%,0.85)] via-[hsl(217,91%,20%,0.7)] to-[hsl(32,95%,30%,0.5)]" />

        {/* Decorative elements */}
        <div className="absolute top-16 right-16 w-72 h-72 bg-[hsl(var(--primary)/0.15)] rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-20 left-20 w-56 h-56 bg-[hsl(var(--accent)/0.15)] rounded-full blur-[60px] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 text-center px-12 max-w-lg">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 mb-6">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))] animate-pulse" />
            <span className="text-white/80 text-xs font-medium tracking-wide">LIVE CLASSES AVAILABLE</span>
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Master English<br />
            <span className="text-gradient" style={{ WebkitTextFillColor: 'transparent', background: 'linear-gradient(135deg, hsl(32 95% 60%), hsl(32 95% 80%))', WebkitBackgroundClip: 'text' }}>
              with Confidence
            </span>
          </h2>
          <p className="text-white/60 text-base mt-4 leading-relaxed">
            Join hundreds of students learning English with expert guidance from Thilina Dhananjaya
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-8 mt-8">
            {[
              { num: '500+', label: 'Students' },
              { num: '50+', label: 'Lessons' },
              { num: '4.9', label: 'Rating' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-white">{s.num}</p>
                <p className="text-white/50 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
