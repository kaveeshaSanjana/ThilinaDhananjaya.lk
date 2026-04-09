import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import heroBg from '../assets/hero-bg.jpg';
import waveDecoration from '../assets/wave-decoration.jpg';
import teacherImg from '../assets/teacher.png';
import logoImg from '../assets/logo.png';
import studentCrowdImg from '../assets/students-classroom.jpg';
import gallery1 from '../assets/gallery-1.jpg';
import gallery2 from '../assets/gallery-2.jpg';
import gallery3 from '../assets/gallery-3.jpg';
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
      <div className="h-full bg-gradient-to-r from-[hsl(var(--accent))] via-[hsl(var(--primary))] to-[hsl(var(--accent))] transition-[width] duration-150" style={{ width: `${progress}%` }} />
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
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5, o: Math.random() * 0.4 + 0.1,
      });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.o})`; ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${0.03 * (1 - d / 100)})`; ctx.stroke();
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
    left: 'translateX(-60px)', right: 'translateX(60px)', scale: 'scale(0.85)',
  };
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : transforms[direction],
      transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      willChange: 'opacity, transform',
    }}>{children}</div>
  );
}

/* ───────── Glow card ───────── */
function GlowCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, pos } = useMouseGlow();
  return (
    <div ref={ref} className={`relative group overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[inherit]"
        style={{ background: `radial-gradient(400px circle at ${pos.x}px ${pos.y}px, hsl(var(--accent) / 0.12), transparent 60%)` }} />
      {children}
    </div>
  );
}

/* ───────── Marquee text ───────── */
function MarqueeText({ text, speed = 30 }: { text: string; speed?: number }) {
  return (
    <div className="overflow-hidden whitespace-nowrap">
      <div className="inline-flex animate-marquee" style={{ animationDuration: `${speed}s` }}>
        {[0, 1].map(i => (
          <span key={i} className="mx-4 text-6xl sm:text-8xl lg:text-[10rem] font-black uppercase tracking-[0.15em] select-none bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] bg-clip-text" style={{ fontFamily: "'Space Grotesk', sans-serif", WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text', WebkitTextStrokeWidth: '1px', WebkitTextStrokeColor: 'rgba(255,255,255,0.06)' }}>
            {text} &nbsp;✦&nbsp; {text} &nbsp;✦&nbsp; {text} &nbsp;✦&nbsp;
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────── FAQ Accordion ───────── */
function FAQItem({ q, a, open, toggle }: { q: string; a: string; open: boolean; toggle: () => void }) {
  return (
    <div className={`border border-white/[0.06] rounded-2xl overflow-hidden transition-all duration-500 ${open ? 'bg-white/[0.04] border-[hsl(var(--accent))/0.2]' : 'bg-white/[0.02] hover:bg-white/[0.03]'}`}>
      <button onClick={toggle} className="w-full flex items-center justify-between p-5 sm:p-6 text-left gap-4">
        <span className="text-sm sm:text-base font-semibold text-white/90">{q}</span>
        <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center transition-all duration-500 ${open ? 'bg-[hsl(var(--accent))] rotate-45' : 'bg-white/5'}`}>
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </button>
      <div className={`grid transition-all duration-500 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm text-white/40 leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

/* ───────── Tilt card on hover ───────── */
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState({});

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setStyle({
      transform: `perspective(600px) rotateX(${y * -8}deg) rotateY(${x * 8}deg) scale(1.02)`,
      transition: 'transform 0.1s ease',
    });
  }, []);

  const handleLeave = useCallback(() => {
    setStyle({ transform: 'perspective(600px) rotateX(0) rotateY(0) scale(1)', transition: 'transform 0.5s ease' });
  }, []);

  return (
    <div ref={ref} onMouseMove={handleMove} onMouseLeave={handleLeave} style={style} className={className}>
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
  { icon: '📹', title: 'HD Live Classes', desc: 'Crystal-clear live sessions with interactive whiteboard and screen sharing.', gradient: 'from-blue-500 to-indigo-600' },
  { icon: '📚', title: 'Unlimited Recordings', desc: 'Every lesson recorded in HD. Watch, rewind, and learn at your own pace.', gradient: 'from-emerald-500 to-teal-600' },
  { icon: '📊', title: 'Progress Analytics', desc: 'Real-time dashboards tracking attendance, watch history, and performance.', gradient: 'from-orange-500 to-amber-600' },
  { icon: '💳', title: 'Easy Payments', desc: 'Secure online payment with bank slip upload and instant verification.', gradient: 'from-purple-500 to-violet-600' },
  { icon: '🔔', title: 'Smart Notifications', desc: 'Never miss a class — get reminders for upcoming sessions and deadlines.', gradient: 'from-rose-500 to-pink-600' },
  { icon: '🛡️', title: 'Secure Platform', desc: 'Enterprise-grade security with encrypted data and role-based access.', gradient: 'from-cyan-500 to-sky-600' },
];

const testimonials = [
  { name: 'Kasun Perera', grade: 'Grade 11 Student', text: 'My English grades jumped from C to A+ in just one term. The live classes feel like a private tuition!', avatar: 'KP' },
  { name: 'Nethmi Silva', grade: 'A/L Student', text: 'Teacher Thilina explains grammar so clearly. The recordings saved me before my final exam.', avatar: 'NS' },
  { name: 'Dinesh Rajapaksa', grade: 'Grade 10 Student', text: 'Best English class in Sri Lanka! The platform is super easy to use and I can study anytime.', avatar: 'DR' },
  { name: 'Amaya Fernando', grade: 'O/L Student', text: 'I was struggling with essay writing. After joining Eazy English, I got the highest mark in my school!', avatar: 'AF' },
];

const faqs = [
  { q: 'How do I join a class?', a: 'Simply register on the platform, browse available classes, and enroll. You can attend live sessions immediately or watch recordings at your own pace.' },
  { q: 'Can I watch recordings after the live class?', a: 'Yes! All live sessions are recorded in HD quality. You can access them anytime from your dashboard — rewind, pause, and learn at your own speed.' },
  { q: 'What payment methods are supported?', a: 'We support bank slip uploads for payments. Upload your payment slip, and it will be verified within 24 hours by our team.' },
  { q: 'Is the platform mobile-friendly?', a: 'Absolutely! Eazy English works perfectly on phones, tablets, and desktops. Learn anywhere, anytime — all you need is an internet connection.' },
  { q: 'How do I track my progress?', a: 'Your dashboard shows attendance history, watch time, payment status, and more. Teachers can also view your engagement analytics.' },
];

const gradients = [
  'from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600', 'from-purple-500 to-violet-600',
  'from-rose-500 to-pink-600', 'from-cyan-500 to-sky-600',
];

const galleryImages = [
  { src: gallery1, alt: 'Live event with dramatic stage lighting' },
  { src: gallery2, alt: 'Students celebrating exam results' },
  { src: gallery3, alt: 'Modern classroom session' },
  { src: studentCrowdImg, alt: 'Student crowd at educational event' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const statsReveal = useScrollReveal(0.3);
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
              <img src={logoImg} alt="Eazy English" className="w-11 h-11 object-contain" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Eazy English</h1>
                <p className="text-[9px] font-semibold tracking-[0.2em] text-[hsl(var(--accent))] uppercase">Thilina Dhananjaya</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-1">
              {['Home', 'Process', 'Classes', 'Features', 'Gallery', 'About', 'FAQ'].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`} className="relative px-3.5 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-all duration-300 group">
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
                  <Link to="/login" className="hidden sm:inline-flex px-5 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-all duration-300">Sign In</Link>
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
              {['Home', 'Process', 'Classes', 'Features', 'Gallery', 'About', 'FAQ'].map((item, i) => (
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
        <ParticleField />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[hsl(var(--accent))/0.06] rounded-full blur-[150px] animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[hsl(var(--primary))/0.08] rounded-full blur-[120px] animate-float" style={{ animationDelay: '1.5s' }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 w-full">
          <div className="flex justify-center">
            <div className={`max-w-3xl text-center transition-all duration-1000 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 mb-8 hover:bg-white/8 transition-colors duration-300 cursor-default">
                <div className="relative w-2 h-2">
                  <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
                  <div className="relative w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <span className="text-white/70 text-xs font-semibold tracking-wider">ENROLLING NOW FOR 2026</span>
              </div>

              <h2 className="text-[2.75rem] sm:text-6xl lg:text-7xl xl:text-[5.25rem] font-extrabold leading-[1.05] tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <span className="block text-white">Master</span>
                <span className="block bg-gradient-to-r from-[hsl(var(--accent))] via-[hsl(32,95%,65%)] to-[hsl(var(--accent))] bg-clip-text animate-gradient bg-[length:200%_auto]" style={{ WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text' }}>
                  English
                </span>
                <span className="block text-white/90 text-[0.65em]">
                  with <span className="text-[hsl(var(--accent))]">{typewriterText}</span>
                  <span className="animate-pulse text-[hsl(var(--accent))]">|</span>
                </span>
              </h2>

              <p className="text-white/50 text-base sm:text-lg mt-6 max-w-xl mx-auto leading-relaxed">
                Sri Lanka's premier English learning platform by{' '}
                <span className="text-[hsl(var(--accent))] font-semibold">Thilina Dhananjaya</span>.
                Live classes, HD recordings, and smart progress tracking — all in one place.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mt-10 justify-center">
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

              <div className="flex items-center gap-6 mt-10 justify-center">
                {[
                  { label: '95% Pass Rate', icon: '🏅' },
                  { label: 'HD Quality', icon: '📹' },
                  { label: 'Live & Recorded', icon: '📡' },
                ].map(b => (
                  <div key={b.label} className="flex items-center gap-1.5 text-white/30 text-xs font-medium">
                    <span className="text-sm">{b.icon}</span>{b.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="flex flex-col items-center gap-2 animate-bounce-slow">
            <span className="text-white/20 text-[10px] tracking-widest font-medium">SCROLL</span>
            <div className="w-5 h-8 rounded-full border border-white/15 flex items-start justify-center p-1">
              <div className="w-1 h-2.5 rounded-full bg-[hsl(var(--accent))] animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ HIGHLIGHT BADGES ═══════════ */}
      <section className="relative py-8 bg-[hsl(222,47%,5%)]">
        <div className="max-w-5xl mx-auto px-4">
          <Reveal>
            <div className="grid grid-cols-3 gap-4 sm:gap-6">
              {[
                { icon: '🏆', title: 'Results', desc: 'Island-wide top results', color: 'from-amber-500 to-yellow-500' },
                { icon: '🎯', title: 'Live MCQ', desc: 'Interactive quiz battles', color: 'from-blue-500 to-indigo-600' },
                { icon: '📝', title: 'Exams', desc: 'Model & past papers', color: 'from-emerald-500 to-green-600' },
              ].map((badge) => (
                <TiltCard key={badge.title}>
                  <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 sm:p-6 text-center hover:bg-white/[0.06] hover:border-white/10 transition-all duration-500">
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gradient-to-br ${badge.color} flex items-center justify-center shadow-lg mb-3`}>
                      <span className="text-2xl sm:text-3xl">{badge.icon}</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{badge.title}</h3>
                    <p className="text-[11px] sm:text-xs text-white/40 mt-1">{badge.desc}</p>
                  </div>
                </TiltCard>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ STATS BAR ═══════════ */}
      <section ref={statsReveal.ref} className="relative">
        <div className="absolute inset-0">
          <img src={waveDecoration} alt="" className="w-full h-full object-cover opacity-30" loading="lazy" width={1920} height={512} />
          <div className="absolute inset-0 bg-[hsl(222,47%,5%)/0.85]" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-16">
          <div className="grid grid-cols-3 gap-6">
            {[
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

      {/* ═══════════ STUDENT CROWD BANNER ═══════════ */}
      <section className="relative h-[40vh] sm:h-[50vh] overflow-hidden">
        <img src={studentCrowdImg} alt="Students at Eazy English" className="w-full h-full object-cover" loading="lazy" width={1920} height={768} />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222,47%,5%)] via-[hsl(222,47%,5%)/0.4] to-[hsl(222,47%,5%)/0.6]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Reveal direction="scale">
            <div className="text-center px-4">
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Join Our <span className="text-[hsl(var(--accent))]">Students</span>
              </h2>
              <p className="text-white/50 text-sm sm:text-base mt-3 max-w-lg mx-auto">
                Be part of Sri Lanka's fastest-growing English learning community
              </p>
              <Link to="/register" className="mt-6 inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-[hsl(var(--accent))] text-white font-bold text-sm hover:scale-105 shadow-xl shadow-[hsl(var(--accent))/0.3] transition-all duration-300">
                Join Now <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ MARQUEE ═══════════ */}
      <div className="py-6 bg-[hsl(222,47%,5%)] overflow-hidden">
        <MarqueeText text="EAZY ENGLISH" speed={25} />
      </div>

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
            <p className="text-white/40 text-base sm:text-lg mt-4 max-w-2xl mx-auto">A proven 4-step process designed to take you from beginner to confident English speaker</p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {processSteps.map((step, i) => (
              <Reveal key={step.num} delay={i * 0.12} direction={i % 2 === 0 ? 'up' : 'down'}>
                <TiltCard>
                  <GlowCard className="relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-[hsl(var(--accent))/0.3] rounded-3xl p-8 transition-all duration-500 h-full">
                    {i < 3 && <div className="hidden lg:block absolute top-12 right-0 w-full h-px bg-gradient-to-r from-white/10 to-white/5 translate-x-1/2 z-0" />}
                    <div className="flex items-center gap-4 mb-5">
                      <span className="text-4xl group-hover:scale-125 group-hover:rotate-6 transition-all duration-500">{step.icon}</span>
                      <span className="text-[hsl(var(--accent))/0.2] text-5xl font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{step.num}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{step.title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
                  </GlowCard>
                </TiltCard>
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
            <p className="text-white/40 text-base mt-4 max-w-xl mx-auto">Expert-crafted classes for every level — pick the one that fits your goals</p>
          </Reveal>

          {loadingClasses ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="rounded-3xl h-56 skeleton border border-white/[0.06]" />)}
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
                  <TiltCard>
                    <GlowCard className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/15 rounded-3xl overflow-hidden transition-all duration-500 h-full">
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
                            <span className="text-lg font-black text-[hsl(var(--accent))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Rs. {Number(cls.monthlyFee).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </GlowCard>
                  </TiltCard>
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
            <p className="text-white/40 text-base mt-4 max-w-2xl mx-auto">A complete learning ecosystem powered by cutting-edge technology</p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08} direction={i < 3 ? 'left' : 'right'}>
                <TiltCard>
                  <GlowCard className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-[hsl(var(--accent))/0.2] rounded-3xl p-7 transition-all duration-500 h-full">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg`}>
                      <span className="text-2xl">{f.icon}</span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2 group-hover:text-[hsl(var(--accent))] transition-colors duration-300" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{f.title}</h3>
                    <p className="text-sm text-white/35 leading-relaxed">{f.desc}</p>
                  </GlowCard>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ GALLERY ═══════════ */}
      <section id="gallery" className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-[hsl(222,47%,5%)]" />
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[hsl(var(--accent))/0.03] rounded-full blur-[180px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/8 mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">📸 OUR GALLERY</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Moments at <span className="text-[hsl(var(--accent))]">Eazy English</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {galleryImages.map((img, i) => (
              <Reveal key={i} delay={i * 0.1} direction="scale">
                <div className="group relative rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer">
                  <img src={img.src} alt={img.alt} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" width={800} height={600} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                    <p className="text-white text-xs font-medium">{img.alt}</p>
                  </div>
                  <div className="absolute inset-0 border-2 border-white/0 group-hover:border-[hsl(var(--accent))/0.4] rounded-2xl transition-all duration-500" />
                </div>
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
            <Reveal direction="left" className="flex justify-center">
              <div className="relative group">
                <div className="absolute -inset-6 bg-gradient-to-br from-[hsl(var(--accent))/0.1] to-[hsl(var(--primary))/0.05] rounded-[3rem] blur-2xl group-hover:from-[hsl(var(--accent))/0.2] transition-all duration-700" />
                <TiltCard className="relative w-72 sm:w-80 rounded-[2rem] overflow-hidden border border-white/8 shadow-2xl shadow-black/30 group-hover:border-white/15 transition-all duration-500">
                  <img src={teacherImg} alt="Thilina Dhananjaya teaching" className="w-full aspect-square object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222,47%,5%)/0.8] via-transparent to-transparent" />
                </TiltCard>

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
                    { num: '95%', label: 'Pass Rate', icon: '📈' },
                    { num: '50+', label: 'Video Lessons', icon: '🎬' },
                    { num: '10+', label: 'Class Centers', icon: '🏫' },
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

      {/* ═══════════ STUDENT RANKS / ACHIEVEMENTS ═══════════ */}
      <section className="py-24 sm:py-32 relative">
        <div className="absolute inset-0 bg-[hsl(222,47%,5%)]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[hsl(var(--accent))/0.04] rounded-full blur-[200px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/8 mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">🏅 STUDENT RANKS</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Top <span className="text-[hsl(var(--accent))]">Achievers</span>
            </h2>
            <p className="text-white/40 text-base mt-4 max-w-xl mx-auto">Our students consistently achieve outstanding results across the island</p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { rank: '🥇', name: 'Sanduni Perera', score: 'A+', grade: '2025 O/L', gradient: 'from-amber-400 via-yellow-400 to-amber-500', shadow: 'shadow-amber-500/30' },
              { rank: '🥈', name: 'Kavindu Silva', score: 'A', grade: '2025 O/L', gradient: 'from-slate-300 via-gray-300 to-slate-400', shadow: 'shadow-gray-400/30' },
              { rank: '🥉', name: 'Nethmi Fernando', score: 'A', grade: '2025 A/L', gradient: 'from-orange-400 via-amber-500 to-orange-600', shadow: 'shadow-orange-500/30' },
              { rank: '⭐', name: 'Dilshan Kumara', score: 'A', grade: '2025 O/L', gradient: 'from-blue-400 via-indigo-400 to-blue-500', shadow: 'shadow-blue-500/30' },
            ].map((student, idx) => (
              <Reveal key={student.name} delay={idx * 0.12} direction="up">
                <TiltCard>
                  <div className={`relative rounded-3xl overflow-hidden border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-500`}>
                    <div className={`h-1.5 bg-gradient-to-r ${student.gradient}`} />
                    <div className="p-6 text-center">
                      <span className="text-4xl block mb-3">{student.rank}</span>
                      <div className={`inline-flex px-4 py-1.5 rounded-full bg-gradient-to-r ${student.gradient} shadow-lg ${student.shadow} mb-3`}>
                        <span className="text-white font-black text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{student.score}</span>
                      </div>
                      <p className="text-white font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{student.name}</p>
                      <p className="text-white/35 text-xs mt-1">{student.grade}</p>
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section className="py-24 sm:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(222,47%,5%)] via-[hsl(222,47%,7%)] to-[hsl(222,47%,5%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[hsl(var(--primary))/0.03] rounded-full blur-[150px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/8 mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">💬 STUDENT VOICES</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              What Students <span className="text-[hsl(var(--accent))]">Say</span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {testimonials.map((t, idx) => (
              <Reveal key={t.name} delay={idx * 0.1} direction="up">
                <TiltCard>
                  <GlowCard className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/10 rounded-3xl p-6 transition-all duration-500 flex flex-col h-full">
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
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section id="faq" className="py-24 sm:py-32 relative">
        <div className="absolute inset-0 bg-[hsl(222,47%,5%)]" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-[hsl(var(--primary))/0.03] rounded-full blur-[150px]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/8 mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">❓ FAQ</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Frequently Asked <span className="text-[hsl(var(--accent))]">Questions</span>
            </h2>
          </Reveal>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 0.08} direction="up">
                <FAQItem q={faq.q} a={faq.a} open={openFaq === i} toggle={() => setOpenFaq(openFaq === i ? null : i)} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SOCIAL / TELEGRAM ═══════════ */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(222,47%,5%)] to-[hsl(222,47%,6%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/8 mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">📱 CONNECT WITH US</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Join Our <span className="text-[hsl(var(--accent))]">Community</span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { platform: 'YouTube', icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', color: 'from-red-500 to-red-600', label: 'Lessons & Tips' },
              { platform: 'Facebook', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z', color: 'from-blue-500 to-blue-600', label: 'Updates & News' },
              { platform: 'WhatsApp', icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z', color: 'from-emerald-500 to-green-600', label: 'Direct Support' },
            ].map((social, i) => (
              <Reveal key={social.platform} delay={i * 0.1} direction="up">
                <a href="#" className="group block bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/15 rounded-2xl p-6 text-center transition-all duration-500 hover:-translate-y-1">
                  <div className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br ${social.color} flex items-center justify-center shadow-lg mb-4 group-hover:scale-110 transition-transform duration-500`}>
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d={social.icon} /></svg>
                  </div>
                  <p className="text-white font-bold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{social.platform}</p>
                  <p className="text-white/35 text-xs mt-1">{social.label}</p>
                </a>
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
            Ready to Start Your<br />English Journey?
          </h2>
          <p className="text-white/70 text-base sm:text-lg mt-5 max-w-xl mx-auto">
            Join hundreds of students already learning with Eazy English. Your first step towards fluency starts here.
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
                  <img src={logoImg} alt="Eazy English" className="w-10 h-10 object-contain" />
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
                  {['Home', 'Classes', 'Features', 'Gallery', 'About', 'FAQ'].map(l => (
                    <a key={l} href={`#${l.toLowerCase()}`} className="block text-white/30 text-sm hover:text-[hsl(var(--accent))] hover:translate-x-1 transition-all duration-300">{l}</a>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-white/70 font-semibold text-xs uppercase tracking-wider mb-5">Platform</h4>
                <div className="space-y-3">
                  {[{ label: 'Sign In', to: '/login' }, { label: 'Register', to: '/register' }, { label: 'Dashboard', to: '/dashboard' }].map(l => (
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
                    <a key={s.label} href="#" className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center hover:bg-[hsl(var(--accent))/0.15] hover:border-[hsl(var(--accent))/0.3] hover:scale-110 transition-all duration-300 group" aria-label={s.label}>
                      <svg className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d={s.icon} /></svg>
                    </a>
                  ))}
                </div>
                <p className="text-white/20 text-xs mt-5">Follow us for daily tips, updates, and free content</p>
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
