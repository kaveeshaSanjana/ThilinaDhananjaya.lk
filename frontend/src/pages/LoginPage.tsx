import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import teacherImg from '../assets/teacher.png';
import classroomBg from '../assets/classroom-bg.png';

/* ── Floating particles on right panel ── */
function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    let raf: number;
    const particles: { x: number; y: number; r: number; dx: number; dy: number; o: number }[] = [];
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < 40; i++) {
      particles.push({ x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 2 + 1, dx: (Math.random() - 0.5) * 0.4, dy: (Math.random() - 0.5) * 0.4, o: Math.random() * 0.5 + 0.2 });
    }
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
        if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.o})`; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-[1]" />;
}

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
  const [focusedField, setFocusedField] = useState<string | null>(null);
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
    <div className="min-h-screen flex bg-[hsl(var(--background))]">
      {/* ═══════ LEFT: Form Panel ═══════ */}
      <div className="w-full lg:w-[48%] flex flex-col items-center justify-center px-6 py-8 lg:px-14 xl:px-20 relative overflow-hidden">
        {/* Animated gradient blobs */}
        <div className="absolute -top-32 -left-32 w-[400px] h-[400px] rounded-full bg-[hsl(var(--primary)/0.06)] blur-[100px] animate-float pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-[300px] h-[300px] rounded-full bg-[hsl(var(--accent)/0.06)] blur-[80px] pointer-events-none" style={{ animationDelay: '2s' }} />

        {/* Dot pattern */}
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '28px 28px' }} />

        <div className={`w-full max-w-[440px] relative z-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

          {/* ── Brand ── */}
          <div className="flex items-center gap-4 mb-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center shadow-xl shadow-[hsl(var(--primary)/0.25)] relative group">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" />
              <svg className="w-7 h-7 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 11-6-11-6z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[hsl(var(--foreground))] tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Eazy English</h1>
              <p className="text-xs text-[hsl(var(--muted-foreground))] font-semibold tracking-[0.2em] mt-0.5">LEARNING MANAGEMENT SYSTEM</p>
            </div>
          </div>

          {/* ── Teacher card ── */}
          <div className="flex items-center gap-4 mb-10 p-4 rounded-2xl bg-gradient-to-r from-[hsl(var(--muted))] to-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.3)] transition-all duration-300 group cursor-default">
            <div className="relative">
              <img src={teacherImg} alt="Thilina Dhananjaya" className="w-14 h-14 rounded-2xl object-cover shadow-lg ring-2 ring-[hsl(var(--primary)/0.2)] group-hover:ring-[hsl(var(--primary)/0.5)] transition-all" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[hsl(var(--success))] border-2 border-[hsl(var(--background))] animate-pulse" />
            </div>
            <div>
              <p className="text-base font-bold text-[hsl(var(--foreground))]">Thilina Dhananjaya</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">English Language Instructor</p>
            </div>
          </div>

          {/* ── Heading ── */}
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[hsl(var(--foreground))] leading-tight tracking-tight">
            Welcome back <span className="inline-block animate-bounce-slow">👋</span>
          </h2>
          <p className="text-[hsl(var(--muted-foreground))] text-base mt-2 mb-8">Sign in to continue your learning journey</p>

          {/* ── Error ── */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-[hsl(var(--danger)/0.08)] border border-[hsl(var(--danger)/0.2)] text-sm text-[hsl(var(--danger))] flex items-start gap-3 animate-fade-in backdrop-blur-sm">
              <div className="w-8 h-8 rounded-xl bg-[hsl(var(--danger)/0.15)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="font-semibold mb-0.5">Login Failed</p>
                <p className="opacity-80">{error}</p>
              </div>
            </div>
          )}

          {/* ═══════ FORM ═══════ */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identifier field */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-[hsl(var(--foreground))]">
                <svg className="w-4 h-4 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Your Identifier
              </label>
              <div className={`relative rounded-2xl transition-all duration-300 ${focusedField === 'id' ? 'ring-2 ring-[hsl(var(--primary)/0.4)] shadow-lg shadow-[hsl(var(--primary)/0.1)]' : ''}`}>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className={`w-5 h-5 transition-colors duration-200 ${focusedField === 'id' ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground)/0.4)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                </div>
                <input
                  type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} required
                  onFocus={() => setFocusedField('id')} onBlur={() => setFocusedField(null)}
                  placeholder="Email, Phone, ID or Birth Certificate"
                  className="w-full pl-12 pr-5 py-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground)/0.4)] focus:outline-none transition-all text-base"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-[hsl(var(--foreground))]">
                <svg className="w-4 h-4 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Password
              </label>
              <div className={`relative rounded-2xl transition-all duration-300 ${focusedField === 'pw' ? 'ring-2 ring-[hsl(var(--primary)/0.4)] shadow-lg shadow-[hsl(var(--primary)/0.1)]' : ''}`}>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className={`w-5 h-5 transition-colors duration-200 ${focusedField === 'pw' ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground)/0.4)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                </div>
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  onFocus={() => setFocusedField('pw')} onBlur={() => setFocusedField(null)}
                  placeholder="Enter your password"
                  className="w-full pl-12 pr-14 py-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground)/0.4)] focus:outline-none transition-all text-base"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded-xl transition-all duration-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    {showPw
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                  </svg>
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${rememberMe ? 'bg-[hsl(var(--primary))] border-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] group-hover:border-[hsl(var(--primary)/0.5)]'}`}>
                  {rememberMe && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="sr-only" />
                <span className="text-sm text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--foreground))] transition-colors">Remember me</span>
              </label>
              <Link to="#" className="text-sm text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-glow))] font-bold transition-colors hover:underline underline-offset-4">
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full py-4.5 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-glow))] text-white text-base font-extrabold tracking-wide hover:shadow-2xl hover:shadow-[hsl(var(--primary)/0.35)] active:scale-[0.97] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              {loading && <svg className="w-5 h-5 animate-spin relative z-10" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              <span className="relative z-10">{loading ? 'Signing in...' : 'Sign In →'}</span>
            </button>
          </form>

          {/* ── Divider ── */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[hsl(var(--border))] to-transparent" />
            <span className="text-xs font-semibold text-[hsl(var(--muted-foreground)/0.5)] tracking-widest uppercase">or</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[hsl(var(--border))] to-transparent" />
          </div>

          {/* ── Links ── */}
          <div className="space-y-3">
            <Link to="#" className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] text-sm font-semibold hover:bg-[hsl(var(--muted))] hover:border-[hsl(var(--primary)/0.3)] transition-all duration-200">
              <svg className="w-5 h-5 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
              Activate Your Account
            </Link>
            <Link to="/register" className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border-2 border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.05)] text-[hsl(var(--accent))] text-sm font-bold hover:bg-[hsl(var(--accent)/0.1)] hover:border-[hsl(var(--accent)/0.5)] transition-all duration-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
              Create New Account
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════ RIGHT: Visual Panel ═══════ */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center">
        <img src={classroomBg} alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,8%,0.92)] via-[hsl(217,91%,15%,0.8)] to-[hsl(32,95%,25%,0.6)]" />
        <FloatingParticles />

        {/* Glow orbs */}
        <div className="absolute top-16 right-16 w-80 h-80 bg-[hsl(var(--primary)/0.12)] rounded-full blur-[100px] pointer-events-none animate-float" />
        <div className="absolute bottom-20 left-20 w-64 h-64 bg-[hsl(var(--accent)/0.12)] rounded-full blur-[80px] pointer-events-none animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[hsl(var(--primary)/0.05)] rounded-full blur-[120px] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 text-center px-12 max-w-xl">
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 mb-8 shadow-lg">
            <div className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--success))] animate-pulse shadow-[0_0_8px_hsl(var(--success))]" />
            <span className="text-white/90 text-xs font-bold tracking-[0.15em]">LIVE CLASSES AVAILABLE</span>
          </div>

          <h2 className="text-5xl xl:text-6xl font-extrabold text-white leading-[1.1] tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Master English
            <br />
            <span style={{
              WebkitTextFillColor: 'transparent',
              background: 'linear-gradient(135deg, hsl(32 95% 55%), hsl(32 95% 75%), hsl(32 95% 55%))',
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text',
              animation: 'gradient-shift 3s ease infinite',
            }}>
              with Confidence
            </span>
          </h2>
          <p className="text-white/55 text-lg mt-6 leading-relaxed max-w-md mx-auto">
            Join hundreds of students learning English with expert guidance from Thilina Dhananjaya
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-6 mt-10">
            {[
              { num: '500+', label: 'Students', icon: '🎓' },
              { num: '50+', label: 'Lessons', icon: '📚' },
              { num: '4.9', label: 'Rating', icon: '⭐' },
            ].map(s => (
              <div key={s.label} className="text-center px-6 py-4 rounded-2xl bg-white/[0.07] backdrop-blur-sm border border-white/10 hover:bg-white/[0.12] hover:border-white/20 transition-all duration-300 group cursor-default">
                <p className="text-xs mb-1">{s.icon}</p>
                <p className="text-2xl font-extrabold text-white group-hover:scale-110 transition-transform">{s.num}</p>
                <p className="text-white/40 text-xs mt-1 font-medium tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="mt-10 p-5 rounded-2xl bg-white/[0.06] backdrop-blur-sm border border-white/10 text-left max-w-sm mx-auto">
            <div className="flex gap-1 mb-2">{[...Array(5)].map((_, i) => <span key={i} className="text-yellow-400 text-sm">★</span>)}</div>
            <p className="text-white/60 text-sm italic leading-relaxed">"This platform completely transformed how I learn English. Highly recommended!"</p>
            <p className="text-white/40 text-xs mt-3 font-semibold">— A Happy Student</p>
          </div>
        </div>
      </div>
    </div>
  );
}
