import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import teacherImg from '../assets/teacher.png';
import logoImg from '../assets/logo.png';


export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const u = await login(identifier, password);
      const redirect = searchParams.get('redirect');
      if (u?.role === 'ADMIN') {
        const target = redirect && redirect.startsWith('/')
          ? `/admin/select-institute?redirect=${encodeURIComponent(redirect)}`
          : '/admin/select-institute';
        navigate(target);
      } else if (redirect && redirect.startsWith('/')) {
        navigate(redirect);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">

      {/* ═══════ LEFT: Brand panel ═══════ */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative overflow-hidden flex-col"
        style={{ background: 'linear-gradient(145deg, hsl(222,47%,11%) 0%, hsl(221,70%,25%) 50%, hsl(221,83%,38%) 100%)' }}>

        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/[0.04] pointer-events-none" />
        <div className="absolute top-1/2 -left-20 w-56 h-56 rounded-full bg-white/[0.04] pointer-events-none" />
        <div className="absolute bottom-32 right-8 w-40 h-40 rounded-full bg-white/[0.04] pointer-events-none" />
        <div className="absolute top-1/4 right-12 w-20 h-20 rounded-full bg-white/[0.06] pointer-events-none" />

        {/* Logo / brand at top */}
        <div className="relative z-10 flex items-center gap-3 p-10 pb-0">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center ring-1 ring-white/20 backdrop-blur-sm">
            <img src={logoImg} alt="logo" className="w-7 h-7 object-contain brightness-0 invert" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">Eazy English</p>
            <p className="text-white/45 text-[10px] font-semibold tracking-[0.2em] mt-0.5">LEARNING PORTAL</p>
          </div>
        </div>

        {/* Teacher photo — fills remaining space */}
        <div className="relative flex-1 flex items-end justify-center mt-6 overflow-hidden">
          {/* Radial glow behind teacher */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full bg-[hsl(217,91%,62%,0.18)] blur-[60px] pointer-events-none" />
          <img
            src={teacherImg}
            alt="Thilina Dhananjaya"
            className="relative z-10 h-[88%] max-h-[520px] w-auto object-contain object-bottom"
          />
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10 px-10 py-8 bg-gradient-to-t from-black/30 to-transparent">
          <p className="text-white text-xl font-bold leading-snug">Learn English<br />with Confidence</p>
          <p className="text-white/45 text-sm mt-1.5">Guided by Thilina Dhananjaya</p>
        </div>
      </div>

      {/* ═══════ RIGHT: Form panel ═══════ */}
      <div className="flex-1 flex items-center justify-center bg-[hsl(var(--background))] px-6 py-12 lg:px-14 xl:px-20">
        <div className={`w-full max-w-[400px] transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center">
              <img src={logoImg} alt="Eazy English" className="w-6 h-6 object-contain brightness-0 invert" />
            </div>
            <span className="font-bold text-lg text-[hsl(var(--foreground))]">Eazy English</span>
          </div>

          {/* Heading */}
          <h1 className="text-[1.75rem] font-bold text-[hsl(var(--foreground))] leading-tight tracking-tight">
            Sign in to your account
          </h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mt-2 mb-8">
            Enter your credentials to access your dashboard
          </p>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-3">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Identifier */}
            <div>
              <label className="block text-sm font-semibold text-[hsl(var(--foreground))] mb-1.5">
                Email / Phone / Student ID
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[hsl(var(--muted-foreground))]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                  placeholder="Enter your identifier"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.35)] focus:border-[hsl(var(--primary)/0.5)] transition text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-[hsl(var(--foreground))] mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[hsl(var(--muted-foreground))]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </span>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.35)] focus:border-[hsl(var(--primary)/0.5)] transition text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition rounded-lg hover:bg-[hsl(var(--muted))]"
                >
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    {showPw
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      : <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm tracking-wide active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[hsl(var(--primary)/0.25)]"
                style={{ background: 'linear-gradient(135deg, hsl(221,83%,53%), hsl(217,91%,62%))' }}
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[hsl(var(--border))]" />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">no self-registration</span>
            <div className="flex-1 h-px bg-[hsl(var(--border))]" />
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-[hsl(var(--muted-foreground))]">
            Don't have an account?{' '}
            <span className="font-semibold text-[hsl(var(--foreground))]">Contact your instructor</span>
          </div>

        </div>
      </div>
    </div>
  );
}
