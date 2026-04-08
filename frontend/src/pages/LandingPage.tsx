import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import heroBg from '../assets/hero-bg.jpg';
import waveDecoration from '../assets/wave-decoration.jpg';
import teacherImg from '../assets/teacher.png';
import { useScrollReveal, useTypewriter, useMouseGlow, useParallax } from '../hooks/useScrollReveal';

/* ───────── Animated counter ───────── */
function useCounter(end: number, duration = 2000, trigger = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) { setVal(0); return; }
    let start = 0;
    const step = end / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(id); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [trigger, end, duration]);
  return val;
}

/* ───────── Scroll progress indicator ───────── */
function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const handler = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? (window.scrollY / h) * 100 : 0);
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px]">
      <div
        className="h-full bg-gradient-to-r from-[hsl(var(--accent))] via-[hsl(var(--primary))] to-[hsl(var(--accent))] transition-[width] duration-150"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/* ───────── Floating particles canvas ───────── */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 0.5,
        o: Math.random() * 0.4 + 0.1,
      });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.o})`;
        ctx.fill();
      });
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${0.04 * (1 - d / 120)})`;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ───────── Reveal wrapper ───────── */
function Reveal({ children, className = '', delay = 0, direction = 'up' }: {
  children: React.ReactNode; className?: string; delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale';
}) {
  const { ref, visible } = useScrollReveal(0.12);
  const transforms: Record<string, string> = {
    up: 'translateY(60px)', down: 'translateY(-60px)',
    left: 'translateX(-60px)', right: 'translateX(60px)',
    scale: 'scale(0.85)',
  };
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : transforms[direction],
        transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}

/* ───────── Glow card ───────── */
function GlowCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, pos } = useMouseGlow();
  return (
    <div ref={ref} className={`relative group overflow-hidden ${className}`}>
      <div
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[inherit]"
        style={{
          background: `radial-gradient(400px circle at ${pos.x}px ${pos.y}px, hsl(var(--accent) / 0.12), transparent 60%)`,
        }}
      />
      {children}
    </div>
  );
}

/* ───────── Data ───────── */
const processSteps = [
  { num: '01', title: 'Join a Class', desc: 'Register and pick the class that matches your level — from Grade 6 to A/L.', icon: '🎓', color: 'from-blue-500 to-indigo-600' },
  { num: '02', title: 'Attend Live Sessions', desc: 'Join real-time interactive lessons with Q&A, polls, and instant feedback.', icon: '📡', color: 'from-emerald-500 to-teal-600' },
  { num: '03', title: 'Watch Recordings', desc: 'Missed a class? Replay any lesson on-demand, anytime, anywhere.', icon: '▶️', color: 'from-orange-500 to-amber-600' },
  { num: '04', title: 'Track & Excel', desc: 'Monitor your progress with detailed analytics and achieve top results.', icon: '🏆', color: 'from-purple-500 to-violet-600' },
];

const features = [
  { icon: '📹', title: 'HD Live Classes', desc: 'Crystal-clear live sessions with interactive whiteboard and screen sharing.' },
  { icon: '📚', title: 'Unlimited Recordings', desc: 'Every lesson recorded in HD. Watch, rewind, and learn at your own pace.' },
  { icon: '📊', title: 'Progress Analytics', desc: 'Real-time dashboards tracking attendance, watch history, and performance.' },
  { icon: '💳', title: 'Easy Payments', desc: 'Secure online payment with bank slip upload and instant verification.' },
  { icon: '🔔', title: 'Smart Notifications', desc: 'Never miss a class — get reminders for upcoming sessions and deadlines.' },
  { icon: '🛡️', title: 'Secure Platform', desc: 'Enterprise-grade security with encrypted data and role-based access.' },
];

const testimonials = [
  { name: 'Kasun Perera', grade: 'Grade 11 Student', text: 'My English grades jumped from C to A+ in just one term. The live classes feel like a private tuition!', avatar: 'KP' },
  { name: 'Nethmi Silva', grade: 'A/L Student', text: 'Teacher Thilina explains grammar so clearly. The recordings saved me before my final exam.', avatar: 'NS' },
  { name: 'Dinesh Rajapaksa', grade: 'Grade 10 Student', text: 'Best English class in Sri Lanka! The platform is super easy to use and I can study anytime.', avatar: 'DR' },
  { name: 'Amaya Fernando', grade: 'O/L Student', text: 'I was struggling with essay writing. After joining Eazy English, I got the highest mark in my school!', avatar: 'AF' },
];

const gradients = [
  'from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600', 'from-purple-500 to-violet-600',
  'from-rose-500 to-pink-600', 'from-cyan-500 to-sky-600',
];

export default function LandingPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);

  const statsReveal = useScrollReveal(0.3);
  const students = useCounter(500, 2000, statsReveal.visible);
  const lessons = useCounter(50, 1500, statsReveal.visible);
  const passRate = useCounter(95, 1800, statsReveal.visible);
  const centers = useCounter(10, 1200, statsReveal.visible);

  const typewriterText = useTypewriter(['Confidence', 'Fluency', 'Excellence', 'Success'], 120, 80, 2500);

  const heroParallax = useParallax(0.15);

  useEffect(() => {
    api.get('/classes').then(r => {
      const visible = (r.data || []).filter((c: any) => !['INACTIVE', 'PRIVATE'].includes(c.status));
      setClasses(visible.slice(0, 6));
    }).catch(() => {}).finally(() => setLoadingClasses(false));
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => { setTimeout(() => setHeroLoaded(true), 100); }, []);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,5%)] text-white overflow-x-hidden">
      <ScrollProgress />

      {/* ═══════════ NAVBAR ═══════════ */}
      <nav className={`fixed top-[3px] left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[hsl(222,47%,7%)/0.92] backdrop-blur-2xl shadow-2xl shadow-black/30 border-b border-white/5' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(32,95%,40%)] flex items-center justify-center shadow-lg shadow-[hsl(var(--accent))/0.3] group hover:scale-110 transition-transform duration-300">
                <span className="text-white font-black text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>E</span>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[hsl(222,47%,7%)]" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Eazy English
                </h1>
                <p className="text-[9px] font-semibold tracking-[0.2em] text-[hsl(var(--accent))] uppercase">Thilina Dhananjaya</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-1">
              {['Home', 'Process', 'Classes', 'Features', 'About'].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`} className="relative px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-all duration-300 group">
                  {item}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-[hsl(var(--accent))] rounded-full group-hover:w-6 transition-all duration-300" />
                </a>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <Link to="/dashboard" className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(32,95%,42%)] text-white text-sm font-bold shadow-lg shadow-[hsl(var(--accent))/0.3] hover:shadow-xl hover:scale-105 transition-all duration-300">
                  Dashboard →
                </Link>
              ) : (
                <>
                  <Link to="/login" className="hidden sm:inline-flex px-5 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-all duration-300">
                    Sign In
                  </Link>
                  <Link to="/register" className="relative px-6 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(32,95%,42%)] text-white text-sm font-bold shadow-lg shadow-[hsl(var(--accent))/0.3] hover:shadow-xl hover:scale-105 transition-all duration-300 overflow-hidden group">
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative">Get Started</span>
                  </Link>
                </>
              )}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-xl hover:bg-white/5 transition">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  {mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-[hsl(222,47%,8%)/0.98] backdrop-blur-xl border-t border-white/5">
            <div className="px-4 py-4 space-y-1">
              {['Home', 'Process', 'Classes', 'Features', 'About'].map((item, i) => (
                <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-xl text-white/70 hover:text-white hover:bg-white/5 text-sm font-medium transition"
                  style={{ animation: `fade-in 0.3s ease ${i * 0.05}s both` }}>{item}</a>
              ))}
              {!user && <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-[hsl(var(--accent))] hover:bg-white/5 text-sm font-semibold transition">Sign In</Link>}
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section id="home" className="relative min-h-screen flex items-center">
        <div className="absolute inset-0" ref={heroParallax.ref}>
          <img src={heroBg} alt="" className="w-full h-full object-cover" width={1920} height={1080}
            style={{ transform: `translateY(${heroParallax.offset}px)` }} />
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(222,47%,5%)/0.7] via-[hsl(222,47%,5%)/0.5] to-[hsl(222,47%,5%)]" />
        </div>

        {/* Particle canvas */}
        <ParticleField />

        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[hsl(var(--accent))/0.06] rounded-full blur-[150px] animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[hsl(var(--primary))/0.08] rounded-full blur-[120px] animate-float" style={{ animationDelay: '1.5s' }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 w-full">
          <div className="grid lg:grid-cols-5 gap-12 lg:gap-8 items-center">
            {/* Left content */}
            <div className={`lg:col-span-3 text-center lg:text-left transition-all duration-1000 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 mb-8 hover:bg-white/8 transition-colors duration-300 cursor-default">
                <div className="relative w-2 h-2">
                  <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
                  <div className="relative w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <span className="text-white/70 text-xs font-semibold tracking-wider">ENROLLING NOW FOR 2026</span>
              </div>

              <h1 className="text-[2.75rem] sm:text-6xl lg:text-7xl xl:text-[5.25rem] font-extrabold leading-[1.05] tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <span className="block text-white">Master</span>
                <span className="block bg-gradient-to-r from-[hsl(var(--accent))] via-[hsl(32,95%,65%)] to-[hsl(var(--accent))] bg-clip-text animate-gradient bg-[length:200%_auto]" style={{ WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text' }}>
                  English
                </span>
                <span className="block text-white/90 text-[0.65em]">
                  with <span className="text-[hsl(var(--accent))]">{typewriterText}</span>
                  <span className="animate-pulse text-[hsl(var(--accent))]">|</span>
                </span>
              </h1>

              <p className="text-white/50 text-base sm:text-lg mt-6 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Sri Lanka's premier English learning platform by{' '}
                <span className="text-[hsl(var(--accent))] font-semibold">Thilina Dhananjaya</span>.
                Live classes, HD recordings, and smart progress tracking — all in one place.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mt-10 justify-center lg:justify-start">
                <Link to="/register" className="group relative px-8 py-4 rounded-2xl bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(32,95%,42%)] text-white font-bold text-base shadow-2xl shadow-[hsl(var(--accent))/0.25] hover:shadow-[hsl(var(--accent))/0.5] hover:scale-[1.03] transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden">
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                  <span className="relative">Start Learning Free</span>
                  <svg className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </Link>
                <a href="#classes" className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-semibold text-base hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-center backdrop-blur-sm group flex items-center justify-center gap-2">
                  Browse Classes
                  <svg className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </a>
              </div>

              {/* Trust badges */}
              <div className="flex items-center gap-6 mt-10 justify-center lg:justify-start">
                {[
                  { label: '500+ Students', icon: '👨‍🎓' },
                  { label: '95% Pass Rate', icon: '🏅' },
                  { label: 'HD Quality', icon: '📹' },
                ].map(b => (
                  <div key={b.label} className="flex items-center gap-1.5 text-white/30 text-xs font-medium">
                    <span className="text-sm">{b.icon}</span>
                    {b.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Teacher */}
            <div className={`lg:col-span-2 hidden lg:flex justify-center transition-all duration-1000 delay-300 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
              <div className="relative group">
                <div className="absolute -inset-8 bg-gradient-to-br from-[hsl(var(--accent))/0.15] to-[hsl(var(--primary))/0.1] rounded-[3rem] blur-3xl group-hover:from-[hsl(var(--accent))/0.25] transition-all duration-700" />
                <div className="relative w-72 xl:w-80 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl shadow-black/40 bg-[hsl(222,47%,10%)] group-hover:border-white/20 transition-all duration-500 group-hover:scale-[1.02]">
                  <img src={teacherImg} alt="Thilina Dhananjaya" className="w-full aspect-[3/4] object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222,47%,5%)] via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm">
                        <span className="text-emerald-400 text-[10px] font-bold">VERIFIED</span>
                      </div>
                    </div>
                    <p className="text-white font-bold text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Thilina Dhananjaya</p>
                    <p className="text-[hsl(var(--accent))] text-sm font-medium mt-0.5">English Language Specialist</p>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-4 -right-6 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(32,95%,45%)] text-white text-xs font-bold shadow-xl shadow-[hsl(var(--accent))/0.3] animate-bounce-slow">
                  🔥 Top Rated
                </div>

                {/* Floating stat */}
                <div className="absolute top-1/2 -left-12 bg-[hsl(222,47%,10%)/0.9] backdrop-blur-xl rounded-2xl border border-white/10 p-3.5 shadow-2xl shadow-black/30 animate-float" style={{ animationDelay: '1s' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                      <span className="text-sm">⭐</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">4.9/5</p>
                      <p className="text-white/40 text-[10px]">Student Rating</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="flex flex-col items-center gap-2 animate-bounce-slow">
            <span className="text-white/20 text-[10px] tracking-widest font-medium">SCROLL</span>
            <div className="w-5 h-8 rounded-full border border-white/15 flex items-start justify-center p-1">
              <div className="w-1 h-2.5 rounded-full bg-[hsl(var(--accent))] animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ STATS BAR ═══════════ */}
      <section ref={statsReveal.ref} className="relative -mt-1">
        <div className="absolute inset-0">
          <img src={waveDecoration} alt="" className="w-full h-full object-cover opacity-30" loading="lazy" width={1920} height={512} />
          <div className="absolute inset-0 bg-[hsl(222,47%,5%)/0.85]" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: students, suffix: '+', label: 'Active Students', icon: '👨‍🎓' },
              { value: lessons, suffix: '+', label: 'Video Lessons', icon: '📹' },
              { value: passRate, suffix: '%', label: 'Pass Rate', icon: '🏅' },
              { value: centers, suffix: '+', label: 'Class Centers', icon: '🏫' },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 0.1} direction="up" className="text-center group">
                <span className="text-3xl mb-2 block group-hover:scale-125 transition-transform duration-500">{s.icon}</span>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {s.value}{s.suffix}
                </p>
                <p className="text-white/35 text-xs sm:text-sm mt-1 font-medium">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PROCESS SECTION ═══════════ */}
      <section id="process" className="py-24 sm:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(222,47%,5%)] via-[hsl(222,47%,7%)] to-[hsl(222,47%,5%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/8 mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">HOW IT WORKS</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Your Journey to <span className="bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(32,95%,65%)] bg-clip-text" style={{ WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text' }}>Fluency</span>
            </h2>
            <p className="text-white/40 text-base sm:text-lg mt-4 max-w-2xl mx-auto">
              A proven 4-step process designed to take you from beginner to confident English speaker
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {processSteps.map((step, i) => (
              <Reveal key={step.num} delay={i * 0.12} direction={i % 2 === 0 ? 'up' : 'down'}>
                <GlowCard className="relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-[hsl(var(--accent))/0.3] rounded-3xl p-8 transition-all duration-500 group-hover:-translate-y-3 h-full">
                  {/* Connector line */}
                  {i < 3 && <div className="hidden lg:block absolute top-12 right-0 w-full h-px bg-gradient-to-r from-white/10 to-white/5 translate-x-1/2 z-0" />}
                  <div className="flex items-center gap-4 mb-5">
                    <span className="text-4xl group-hover:scale-125 group-hover:rotate-6 transition-all duration-500">{step.icon}</span>
                    <span className="text-[hsl(var(--accent))/0.2] text-5xl font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{step.num}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{step.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CLASSES SECTION ═══════════ */}
      <section id="classes" className="py-24 sm:py-32 relative">
        <div className="absolute inset-0 bg-[hsl(222,47%,6%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[hsl(var(--primary))/0.04] rounded-full blur-[150px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/8 mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">OUR CLASSES</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Available <span className="text-[hsl(var(--primary))]">Classes</span>
            </h2>
            <p className="text-white/40 text-base mt-4 max-w-xl mx-auto">
              Expert-crafted classes for every level — pick the one that fits your goals
            </p>
          </Reveal>

          {loadingClasses ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-3xl h-56 skeleton border border-white/[0.06]" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <Reveal className="text-center py-20">
              <span className="text-5xl block mb-4">📚</span>
              <p className="text-white/40 text-lg">Classes coming soon — stay tuned!</p>
            </Reveal>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map((cls: any, i: number) => (
                <Reveal key={cls.id} delay={i * 0.1} direction="scale">
                  <GlowCard className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/15 rounded-3xl overflow-hidden transition-all duration-500 group-hover:-translate-y-3 h-full">
                    <div className={`h-1.5 bg-gradient-to-r ${gradients[i % gradients.length]}`} />
                    <div className="p-6 sm:p-7">
                      <div className="flex items-center gap-4 mb-5">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center shadow-lg shadow-black/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                          <span className="text-white text-xl font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{cls.name?.[0]?.toUpperCase() || 'C'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-lg group-hover:text-[hsl(var(--accent))] transition-colors truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{cls.name}</p>
                          {cls.subject && <p className="text-xs text-white/35 truncate mt-0.5">{cls.subject}</p>}
                        </div>
                      </div>
                      <p className="text-sm text-white/40 line-clamp-2 mb-5 leading-relaxed">{cls.description || 'English language class with expert instruction and interactive sessions'}</p>
                      {cls.monthlyFee != null && (
                        <div className="flex items-center justify-between pt-5 border-t border-white/[0.06]">
                          <span className="text-xs text-white/30 uppercase tracking-wider font-medium">Monthly</span>
                          <span className="text-lg font-black text-[hsl(var(--accent))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            Rs. {Number(cls.monthlyFee).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </GlowCard>
                </Reveal>
              ))}
            </div>
          )}

          <Reveal delay={0.3} className="text-center mt-12">
            <Link to={user ? '/classes' : '/register'} className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-glow))] text-white font-bold text-sm shadow-2xl shadow-[hsl(var(--primary))/0.2] hover:shadow-[hsl(var(--primary))/0.4] hover:scale-105 transition-all duration-300 relative overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative">{user ? 'View All Classes' : 'Join & Explore All Classes'}</span>
              <svg className="relative w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ FEATURES GRID ═══════════ */}
      <section id="features" className="py-24 sm:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(222,47%,6%)] via-[hsl(222,47%,5%)] to-[hsl(222,47%,6%)]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[hsl(var(--accent))/0.03] rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-0 w-72 h-72 bg-[hsl(var(--primary))/0.04] rounded-full blur-[100px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/8 mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">PLATFORM FEATURES</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Everything to <span className="text-[hsl(var(--accent))]">Excel</span>
            </h2>
            <p className="text-white/40 text-base mt-4 max-w-2xl mx-auto">
              A complete learning ecosystem powered by cutting-edge technology
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08} direction={i < 3 ? 'left' : 'right'}>
                <GlowCard className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-[hsl(var(--accent))/0.2] rounded-3xl p-7 transition-all duration-500 group-hover:-translate-y-2 h-full">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--accent))/0.15] to-[hsl(var(--primary))/0.1] flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                    <span className="text-2xl">{f.icon}</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 group-hover:text-[hsl(var(--accent))] transition-colors duration-300" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{f.title}</h3>
                  <p className="text-sm text-white/35 leading-relaxed">{f.desc}</p>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ ABOUT / TEACHER ═══════════ */}
      <section id="about" className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,8%)] to-[hsl(222,47%,5%)]" />
        <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-[hsl(var(--accent))/0.04] rounded-full blur-[150px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image side */}
            <Reveal direction="left" className="flex justify-center">
              <div className="relative group">
                <div className="absolute -inset-6 bg-gradient-to-br from-[hsl(var(--accent))/0.1] to-[hsl(var(--primary))/0.05] rounded-[3rem] blur-2xl group-hover:from-[hsl(var(--accent))/0.2] transition-all duration-700" />
                <div className="relative w-72 sm:w-80 rounded-[2rem] overflow-hidden border border-white/8 shadow-2xl shadow-black/30 group-hover:border-white/15 group-hover:scale-[1.02] transition-all duration-500">
                  <img src={teacherImg} alt="Thilina Dhananjaya teaching" className="w-full aspect-square object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222,47%,5%)/0.8] via-transparent to-transparent" />
                </div>

                <div className="absolute -bottom-6 -right-4 sm:right-2 lg:-right-8 bg-[hsl(222,47%,10%)/0.9] backdrop-blur-xl rounded-2xl border border-white/8 p-4 shadow-2xl shadow-black/30 animate-float">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                      <span className="text-white text-lg">🏆</span>
                    </div>
                    <div>
                      <p className="text-white text-lg font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>95%</p>
                      <p className="text-white/40 text-[10px] font-medium">Pass Rate</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Text side */}
            <Reveal direction="right">
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/8 mb-5">
                  <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">MEET YOUR TEACHER</span>
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Learn from the <span className="text-[hsl(var(--accent))]">Best</span>
                </h2>
                <p className="text-white/45 text-base mt-5 leading-relaxed max-w-lg mx-auto lg:mx-0">
                  <strong className="text-white/70">Thilina Dhananjaya</strong> is a passionate English language educator with years of experience helping students achieve outstanding results. His proven methodology combines interactive live lessons, comprehensive study materials, and personalized guidance.
                </p>

                <div className="grid grid-cols-2 gap-4 mt-10">
                  {[
                    { num: '5+', label: 'Years Teaching', icon: '📖' },
                    { num: '500+', label: 'Students Taught', icon: '👥' },
                    { num: '95%', label: 'Pass Rate', icon: '📈' },
                    { num: '50+', label: 'Video Lessons', icon: '🎬' },
                  ].map((s, i) => (
                    <Reveal key={s.label} delay={i * 0.1} direction="scale">
                      <GlowCard className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300 group-hover:scale-105">
                        <span className="text-2xl block mb-2">{s.icon}</span>
                        <p className="text-xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.num}</p>
                        <p className="text-white/35 text-xs mt-0.5 font-medium">{s.label}</p>
                      </GlowCard>
                    </Reveal>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section className="py-24 sm:py-32 relative">
        <div className="absolute inset-0 bg-[hsl(222,47%,5%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[hsl(var(--primary))/0.03] rounded-full blur-[150px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/8 mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">STUDENT VOICES</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              What Students <span className="text-[hsl(var(--accent))]">Say</span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {testimonials.map((t, idx) => (
              <Reveal key={t.name} delay={idx * 0.1} direction="up">
                <GlowCard className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/10 rounded-3xl p-6 transition-all duration-500 group-hover:-translate-y-2 flex flex-col h-full">
                  <div className="flex gap-0.5 mb-4">
                    {[1, 2, 3, 4, 5].map(s => (
                      <svg key={s} className="w-4 h-4 text-[hsl(var(--accent))]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    ))}
                  </div>
                  <p className="text-sm text-white/55 leading-relaxed flex-1 mb-5 italic">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradients[idx % gradients.length]} flex items-center justify-center shadow-lg shadow-black/20`}>
                      <span className="text-white text-xs font-bold">{t.avatar}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{t.name}</p>
                      <p className="text-[11px] text-white/35">{t.grade}</p>
                    </div>
                  </div>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CTA SECTION ═══════════ */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary-glow))] to-[hsl(var(--accent))] animate-gradient bg-[length:200%_200%]" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-black/10 rounded-full blur-[80px]" />

        <Reveal className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center" direction="scale">
          <span className="text-6xl block mb-6">🚀</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Ready to Start Your
            <br />English Journey?
          </h2>
          <p className="text-white/70 text-base sm:text-lg mt-5 max-w-xl mx-auto">
            Join hundreds of students already learning with Eazy English.
            Your first step towards fluency starts here.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-10 justify-center">
            <Link to="/register" className="group px-10 py-4 rounded-2xl bg-white text-[hsl(var(--primary))] font-bold text-base shadow-2xl shadow-black/20 hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(var(--accent))/0.1] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative">Create Free Account</span>
              <svg className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <Link to="/login" className="px-10 py-4 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 text-white font-semibold text-base hover:bg-white/25 transition-all duration-300">
              Sign In
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="bg-[hsl(222,47%,4%)] py-14 border-t border-white/5 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-[hsl(var(--accent))/0.3] to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
              <div className="sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(32,95%,40%)] flex items-center justify-center">
                    <span className="text-white font-black text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>E</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Eazy English</p>
                    <p className="text-white/25 text-[9px] tracking-[0.2em] uppercase font-medium">Thilina Dhananjaya</p>
                  </div>
                </div>
                <p className="text-white/30 text-sm leading-relaxed max-w-xs">
                  Empowering students with premium English education through modern technology and expert guidance.
                </p>
              </div>
              <div>
                <h4 className="text-white/70 font-semibold text-xs uppercase tracking-wider mb-5">Quick Links</h4>
                <div className="space-y-3">
                  {['Home', 'Classes', 'Features', 'About'].map(l => (
                    <a key={l} href={`#${l.toLowerCase()}`} className="block text-white/30 text-sm hover:text-[hsl(var(--accent))] hover:translate-x-1 transition-all duration-300">{l}</a>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-white/70 font-semibold text-xs uppercase tracking-wider mb-5">Platform</h4>
                <div className="space-y-3">
                  {[{ label: 'Sign In', to: '/login' }, { label: 'Register', to: '/register' }].map(l => (
                    <Link key={l.label} to={l.to} className="block text-white/30 text-sm hover:text-[hsl(var(--accent))] hover:translate-x-1 transition-all duration-300">{l.label}</Link>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-white/70 font-semibold text-xs uppercase tracking-wider mb-5">Connect</h4>
                <div className="flex gap-3">
                  {[
                    { icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z', label: 'Facebook' },
                    { icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', label: 'YouTube' },
                    { icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z', label: 'Instagram' },
                  ].map(s => (
                    <a key={s.label} href="#" className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center hover:bg-[hsl(var(--accent))/0.15] hover:border-[hsl(var(--accent))/0.3] hover:scale-110 transition-all duration-300" aria-label={s.label}>
                      <svg className="w-4 h-4 text-white/40 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24"><path d={s.icon} /></svg>
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-white/20 text-xs">© {new Date().getFullYear()} Eazy English by Thilina Dhananjaya. All rights reserved.</p>
              <p className="text-white/15 text-xs">Powered by SurakshaLMS</p>
            </div>
          </Reveal>
        </div>
      </footer>
    </div>
  );
}
