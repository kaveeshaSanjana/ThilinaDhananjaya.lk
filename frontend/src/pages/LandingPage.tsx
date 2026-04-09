import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import heroBg from '../assets/hero-bg.jpg';
import teacherImg from '../assets/teacher.png';
import logoImg from '../assets/logo.png';
import studentCrowdImg from '../assets/students-classroom.jpg';
import gallery1 from '../assets/gallery-1.jpg';
import gallery2 from '../assets/gallery-2.jpg';
import gallery3 from '../assets/gallery-3.jpg';
import { useScrollReveal, useTypewriter, useMouseGlow, useParallax } from '../hooks/useScrollReveal';




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
        style={{ background: `radial-gradient(400px circle at ${pos.x}px ${pos.y}px, hsl(var(--primary) / 0.08), transparent 60%)` }} />
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
          <span key={i} className="mx-4 text-6xl sm:text-8xl lg:text-[10rem] font-black uppercase tracking-[0.15em] select-none bg-gradient-to-r from-[hsl(var(--primary)/0.06)] via-[hsl(var(--primary)/0.12)] to-[hsl(var(--primary)/0.06)] bg-clip-text" style={{ fontFamily: "'Space Grotesk', sans-serif", WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text', WebkitTextStrokeWidth: '1px', WebkitTextStrokeColor: 'hsl(var(--primary) / 0.1)' }}>
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
    <div className={`border rounded-2xl overflow-hidden transition-all duration-500 ${open ? 'bg-[hsl(var(--card))] border-[hsl(var(--primary)/0.2)] shadow-lg shadow-[hsl(var(--primary)/0.06)]' : 'bg-[hsl(var(--card)/0.8)] border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground)/0.3)] hover:shadow-sm'}`}>
      <button onClick={toggle} className="w-full flex items-center justify-between p-5 sm:p-6 text-left gap-4">
        <span className="text-sm sm:text-base font-semibold text-[hsl(var(--foreground))]">{q}</span>
        <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center transition-all duration-500 ${open ? 'bg-[hsl(var(--primary))] rotate-45' : 'bg-[hsl(var(--muted))]'}`}>
          <svg className={`w-4 h-4 ${open ? 'text-white' : 'text-[hsl(var(--muted-foreground))]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </button>
      <div className={`grid transition-all duration-500 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{a}</p>
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
    setStyle({ transform: `perspective(600px) rotateX(${y * -8}deg) rotateY(${x * 8}deg) scale(1.02)`, transition: 'transform 0.1s ease' });
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

/* ───────── Floating WhatsApp Button ───────── */
function WhatsAppFAB() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, []);
  if (!show) return null;
  return (
    <a href="https://wa.me/94770000000" target="_blank" rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 hover:scale-110 hover:shadow-emerald-500/50 transition-all duration-300 animate-bounce-slow group"
      aria-label="Chat on WhatsApp">
      <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
    </a>
  );
}

/* ───────── Announcement Bar ───────── */
function AnnouncementBar() {
  return (
    <div className="bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--primary-glow))] to-[hsl(var(--accent))] text-white py-2 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 0.5px, transparent 0)', backgroundSize: '20px 20px' }} />
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-6 text-xs sm:text-sm font-medium relative z-10">
        <div className="hidden sm:flex items-center gap-4">
          <a href="tel:+94770000000" className="flex items-center gap-1.5 hover:text-white/80 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            +94 77 000 0000
          </a>
          <span className="text-white/30">|</span>
          <a href="tel:+94710000000" className="flex items-center gap-1.5 hover:text-white/80 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            +94 71 000 0000
          </a>
        </div>
        <div className="sm:hidden">
          <span className="animate-pulse">🔴</span> Enrolling Now for 2026!
        </div>
        <div className="hidden sm:flex items-center gap-3 ml-auto">
          {[
            { icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z', label: 'Facebook' },
            { icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z', label: 'Instagram' },
            { icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', label: 'YouTube' },
            { icon: 'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .56.04.82.12V9.01a6.37 6.37 0 00-1-.08A6.29 6.29 0 003 15.21a6.29 6.29 0 006.34 6.29 6.29 6.29 0 006.28-6.29V9.4a8.16 8.16 0 004.78 1.54V7.5a4.85 4.85 0 01-.81-.81z', label: 'TikTok' },
          ].map(s => (
            <a key={s.label} href="#" className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/30 transition-all duration-300" aria-label={s.label}>
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d={s.icon} /></svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────── Data ───────── */
const processSteps = [
  { num: '01', title: 'Join a Class', desc: 'Register and pick the class that matches your level — from Grade 6 to A/L.', icon: '🎓', color: 'from-red-500 to-rose-600' },
  { num: '02', title: 'Attend Live Sessions', desc: 'Join real-time interactive lessons with Q&A, polls, and instant feedback.', icon: '📡', color: 'from-emerald-500 to-teal-600' },
  { num: '03', title: 'Watch Recordings', desc: 'Missed a class? Replay any lesson on-demand, anytime, anywhere.', icon: '▶️', color: 'from-amber-500 to-yellow-600' },
  { num: '04', title: 'Track & Excel', desc: 'Monitor your progress with detailed analytics and achieve top results.', icon: '🏆', color: 'from-purple-500 to-violet-600' },
];

const courseFeatures = [
  { icon: '📖', title: 'Learn Grammar', desc: 'Grammar is critical for expressing yourself professionally. Master sentence structures, tenses, and advanced grammar rules.', gradient: 'from-rose-500 to-pink-600' },
  { icon: '🗣️', title: 'Spoken English Activities', desc: 'We offer practical spoken activities to improve speaking ability. These activities are designed to be practiced independently.', gradient: 'from-amber-500 to-orange-600' },
  { icon: '🎯', title: 'Exam-Focused Approach', desc: 'Get access to FluentMe resources — past papers, model papers, structured study plans for O/L & A/L success.', gradient: 'from-red-500 to-rose-600' },
  { icon: '📹', title: 'Unlimited Class Recordings', desc: 'Never miss a lesson. Watch and re-watch HD class recordings anytime, anywhere, on any device.', gradient: 'from-emerald-500 to-teal-600' },
  { icon: '📝', title: 'Free Vocabulary Program', desc: 'Build your word power with our curated vocabulary course — completely free for all enrolled students.', gradient: 'from-purple-500 to-violet-600' },
  { icon: '👨‍🏫', title: 'Personal Instructors', desc: 'Get guidance from dedicated personal instructors who provide one-on-one support and personalized feedback.', gradient: 'from-cyan-500 to-sky-600' },
];

const platformFeatures = [
  { icon: '📹', title: 'HD Live Classes', desc: 'Crystal-clear live sessions with interactive whiteboard and screen sharing.', gradient: 'from-red-500 to-rose-600' },
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
  'from-red-500 to-rose-600', 'from-emerald-500 to-teal-600',
  'from-amber-500 to-yellow-600', 'from-purple-500 to-violet-600',
  'from-rose-500 to-pink-600', 'from-cyan-500 to-sky-600',
];

const galleryImages = [
  { src: gallery1, alt: 'Live event with dramatic stage lighting' },
  { src: gallery2, alt: 'Students celebrating exam results' },
  { src: gallery3, alt: 'Modern classroom session' },
  { src: studentCrowdImg, alt: 'Student crowd at educational event' },
];

/* ───────── Testimonial Carousel ───────── */
function TestimonialCarousel() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setActive(p => (p + 1) % testimonials.length), 5000);
    return () => clearInterval(timer);
  }, []);
  const t = testimonials[active];
  return (
    <div className="relative">
      <div className="flex items-center gap-8 lg:gap-12">
        {/* Left side - image */}
        <div className="hidden md:block w-72 lg:w-80 flex-shrink-0 relative">
          <div className="aspect-[4/5] rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl">
            <img src={studentCrowdImg} alt="Students" className="w-full h-full object-cover" loading="lazy" />
          </div>
          {/* Navigation arrows */}
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-3">
            <button onClick={() => setActive(p => (p - 1 + testimonials.length) % testimonials.length)}
              className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all text-white/70">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => setActive(p => (p + 1) % testimonials.length)}
              className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all text-white/70">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {/* Right side - testimonial card */}
        <div className="flex-1">
          <div className="bg-[hsl(var(--card))] rounded-3xl p-8 lg:p-10 relative shadow-2xl border border-[hsl(var(--border))]">
            {/* Star rating */}
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map(s => (
                <svg key={s} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              ))}
            </div>
            {/* Big quote mark */}
            <div className="absolute top-6 right-8 text-7xl font-serif text-[hsl(var(--primary)/0.15)] leading-none select-none">"</div>
            <p className="text-[hsl(var(--foreground))] text-lg lg:text-xl font-medium leading-relaxed mb-6 relative z-10 transition-all duration-500">
              {t.text}
            </p>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradients[active % gradients.length]} flex items-center justify-center shadow-lg`}>
                <span className="text-white text-sm font-bold">{t.avatar}</span>
              </div>
              <div>
                <p className="text-[hsl(var(--foreground))] font-bold">{t.name}</p>
                <p className="text-[hsl(var(--muted-foreground))] text-sm">{t.grade}</p>
              </div>
            </div>
          </div>

          {/* Dots */}
          <div className="flex gap-2 mt-6 md:hidden justify-center">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setActive(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === active ? 'bg-white w-8' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  

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
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] overflow-x-hidden">
      <ScrollProgress />
      <WhatsAppFAB />

      {/* ═══════════ ANNOUNCEMENT BAR ═══════════ */}
      <AnnouncementBar />

      {/* ═══════════ NAVBAR ═══════════ */}
      <nav className={`sticky top-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[hsl(var(--card)/0.95)] backdrop-blur-2xl shadow-lg shadow-[hsl(var(--foreground)/0.05)] border-b border-[hsl(var(--border))]' : 'bg-[hsl(var(--card)/0.6)] backdrop-blur-md'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="Eazy English" className="w-11 h-11 object-contain" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-[hsl(var(--foreground))] leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Eazy English</h1>
                <p className="text-[9px] font-semibold tracking-[0.2em] text-[hsl(var(--accent))] uppercase">Thilina Dhananjaya</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-1">
              {['Home', 'Courses', 'Classes', 'Features', 'Gallery', 'About', 'FAQ'].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`} className="relative px-3.5 py-2 rounded-xl text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-all duration-300 group">
                  {item}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-[hsl(var(--primary))] rounded-full group-hover:w-6 transition-all duration-300" />
                </a>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <Link to="/dashboard" className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-glow))] text-white text-sm font-bold shadow-lg shadow-[hsl(var(--primary)/0.25)] hover:shadow-xl hover:scale-105 transition-all duration-300">
                  Dashboard →
                </Link>
              ) : (
                <>
                  <Link to="/login" className="hidden sm:inline-flex px-5 py-2.5 rounded-xl text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-all duration-300">Sign In</Link>
                  <Link to="/register" className="relative px-6 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-glow))] text-white text-sm font-bold shadow-lg shadow-[hsl(var(--primary)/0.25)] hover:shadow-xl hover:scale-105 transition-all duration-300 overflow-hidden group">
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative">STUDENT LOGIN</span>
                  </Link>
                </>
              )}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-xl hover:bg-[hsl(var(--muted))] transition">
                <svg className="w-6 h-6 text-[hsl(var(--foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  {mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-[hsl(var(--card)/0.98)] backdrop-blur-xl border-t border-[hsl(var(--border))]">
            <div className="px-4 py-4 space-y-1">
              {['Home', 'Courses', 'Classes', 'Features', 'Gallery', 'About', 'FAQ'].map((item, i) => (
                <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-xl text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] text-sm font-medium transition"
                  style={{ animation: `fade-in 0.3s ease ${i * 0.05}s both` }}>{item}</a>
              ))}
              {!user && <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] text-sm font-semibold transition">Sign In</Link>}
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════ HERO — Split Layout ═══════════ */}
      <section id="home" className="relative min-h-[85vh] lg:min-h-screen flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0" ref={heroParallax.ref}>
          <img src={heroBg} alt="" className="w-full h-full object-cover" width={1920} height={1080}
            style={{ transform: `translateY(${heroParallax.offset}px)` }} />
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--background))] via-[hsl(var(--background)/0.85)] to-[hsl(var(--background)/0.4)]" />
        </div>
        {/* Decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[hsl(var(--primary)/0.06)] rounded-full blur-[150px] animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[hsl(var(--accent)/0.08)] rounded-full blur-[120px] animate-float" style={{ animationDelay: '1.5s' }} />
          {/* Sparkle decorations like reference */}
          <div className="absolute top-20 right-[20%] text-[hsl(var(--primary)/0.3)] text-3xl animate-pulse">✦</div>
          <div className="absolute bottom-32 right-[30%] text-[hsl(var(--accent)/0.3)] text-2xl animate-pulse" style={{ animationDelay: '1s' }}>✦</div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left — Text content */}
            <div className={`transition-all duration-1000 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[hsl(var(--accent)/0.1)] backdrop-blur-md border border-[hsl(var(--accent)/0.2)] mb-6">
                <span className="text-[hsl(var(--accent))] text-xs font-bold">✦ Beyond The Traditional Art Of Teaching</span>
              </div>

              <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.05] tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <span className="block text-[hsl(var(--foreground))]">Best and first</span>
                <span className="block text-[hsl(var(--foreground))]">online platform</span>
                <span className="block text-[hsl(var(--foreground))]">for <span className="bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--primary-glow))] to-[hsl(var(--accent))] bg-clip-text animate-gradient bg-[length:200%_auto]" style={{ WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text' }}>English</span></span>
                <span className="block text-[hsl(var(--foreground))] text-[0.6em]">
                  with <span className="text-[hsl(var(--primary))]">{typewriterText}</span>
                  <span className="animate-pulse text-[hsl(var(--primary))]">|</span>
                </span>
              </h2>

              <p className="text-[hsl(var(--muted-foreground))] text-base sm:text-lg mt-6 max-w-lg leading-relaxed">
                Sri Lanka's premier English learning platform by{' '}
                <span className="text-[hsl(var(--accent))] font-semibold">Thilina Dhananjaya</span>.
                Live classes, HD recordings, and smart progress tracking.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <Link to="/register" className="group relative px-8 py-4 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-glow))] text-white font-bold text-base shadow-2xl shadow-[hsl(var(--primary)/0.25)] hover:shadow-[hsl(var(--primary)/0.4)] hover:scale-[1.03] transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden">
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                  <span className="relative">Start Learning Free</span>
                  <svg className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </Link>
                <a href="https://wa.me/94770000000" target="_blank" rel="noopener noreferrer" className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-300 text-center flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  WhatsApp Now
                </a>
              </div>

              <div className="flex items-center gap-6 mt-8">
                {[
                  { label: '95% Pass Rate', icon: '🏅' },
                  { label: 'HD Quality', icon: '📹' },
                  { label: 'Live & Recorded', icon: '📡' },
                ].map(b => (
                  <div key={b.label} className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))] text-xs font-medium">
                    <span className="text-sm">{b.icon}</span>{b.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Teacher image */}
            <div className={`hidden lg:flex justify-center items-end relative transition-all duration-1000 delay-300 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
              <div className="relative">
                <img src={teacherImg} alt="Thilina Dhananjaya" className="w-[420px] xl:w-[480px] object-contain drop-shadow-2xl relative z-10" />
                {/* Decorative badge behind teacher */}
                <div className="absolute top-8 right-0 bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--primary))] rounded-3xl p-5 shadow-2xl text-white text-center z-0 rotate-6 animate-float">
                  <p className="text-xs font-bold opacity-80">පළමු වාරයට</p>
                  <p className="text-2xl font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>ලංකාවේ</p>
                  <p className="text-[10px] opacity-70 mt-1">First in Sri Lanka</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:block">
          <div className="flex flex-col items-center gap-2 animate-bounce-slow">
            <span className="text-[hsl(var(--muted-foreground))] text-[10px] tracking-widest font-medium">SCROLL</span>
            <div className="w-5 h-8 rounded-full border border-[hsl(var(--border))] flex items-start justify-center p-1">
              <div className="w-1 h-2.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats section removed */}

      {/* ═══════════ WHAT YOU GET — Course Features (Reference style) ═══════════ */}
      <section id="courses" className="py-24 sm:py-32 relative bg-[hsl(var(--background))]">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <p className="text-[hsl(var(--accent))] text-sm font-bold mb-3">⭐ මේක තමා ගමේ කොල්ලන්ගෙන් බැරිම ලැබෙන අත්දැකීම</p>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              What You Get From Our <span className="text-[hsl(var(--primary))]">Courses?</span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courseFeatures.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08} direction={i % 2 === 0 ? 'left' : 'right'}>
                <TiltCard>
                  <GlowCard className="bg-[hsl(var(--card))] hover:bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.2)] rounded-3xl p-7 transition-all duration-500 h-full shadow-sm hover:shadow-xl hover:shadow-[hsl(var(--primary)/0.05)]">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                      <span className="text-3xl">{f.icon}</span>
                    </div>
                    <h3 className="text-lg font-bold text-[hsl(var(--foreground))] mb-2 group-hover:text-[hsl(var(--primary))] transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{f.title}</h3>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{f.desc}</p>
                  </GlowCard>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ STUDENT CROWD BANNER ═══════════ */}
      <section className="relative h-[40vh] sm:h-[50vh] overflow-hidden">
        <img src={studentCrowdImg} alt="Students at Eazy English" className="w-full h-full object-cover" loading="lazy" width={1920} height={768} />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--background))] via-[hsl(var(--background)/0.4)] to-[hsl(var(--background)/0.5)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Reveal direction="scale">
            <div className="text-center px-4">
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Join Our <span className="text-[hsl(var(--primary))]">Students</span>
              </h2>
              <p className="text-[hsl(var(--muted-foreground))] text-sm sm:text-base mt-3 max-w-lg mx-auto">
                Be part of Sri Lanka's fastest-growing English learning community
              </p>
              <Link to="/register" className="mt-6 inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-glow))] text-white font-bold text-sm hover:scale-105 shadow-xl shadow-[hsl(var(--primary)/0.25)] transition-all duration-300">
                Join Now <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ MARQUEE ═══════════ */}
      <div className="py-6 bg-[hsl(var(--muted))] overflow-hidden">
        <MarqueeText text="EAZY ENGLISH" speed={25} />
      </div>

      {/* ═══════════ PROCESS SECTION ═══════════ */}
      <section id="process" className="py-24 sm:py-32 relative bg-[hsl(var(--card))]">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.1)] mb-5">
              <span className="text-[hsl(var(--primary))] text-xs font-bold tracking-wider">HOW IT WORKS</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Your Journey to <span className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] bg-clip-text" style={{ WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text' }}>Fluency</span>
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] text-base sm:text-lg mt-4 max-w-2xl mx-auto">A proven 4-step process designed to take you from beginner to confident English speaker</p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {processSteps.map((step, i) => (
              <Reveal key={step.num} delay={i * 0.12} direction={i % 2 === 0 ? 'up' : 'down'}>
                <TiltCard>
                  <GlowCard className="relative bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.2)] rounded-3xl p-8 transition-all duration-500 h-full shadow-sm hover:shadow-xl">
                    {i < 3 && <div className="hidden lg:block absolute top-12 right-0 w-full h-px bg-gradient-to-r from-[hsl(var(--border))] to-transparent translate-x-1/2 z-0" />}
                    <div className="flex items-center gap-4 mb-5">
                      <span className="text-4xl">{step.icon}</span>
                      <span className="text-[hsl(var(--primary)/0.12)] text-5xl font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{step.num}</span>
                    </div>
                    <h3 className="text-lg font-bold text-[hsl(var(--foreground))] mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{step.title}</h3>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{step.desc}</p>
                  </GlowCard>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CLASSES SECTION ═══════════ */}
      <section id="classes" className="py-24 sm:py-32 relative bg-[hsl(var(--muted))]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[hsl(var(--primary)/0.04)] rounded-full blur-[150px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.1)] mb-5">
              <span className="text-[hsl(var(--primary))] text-xs font-bold tracking-wider">OUR CLASSES</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Available <span className="text-[hsl(var(--primary))]">Classes</span>
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] text-base mt-4 max-w-xl mx-auto">Expert-crafted classes for every level — pick the one that fits your goals</p>
          </Reveal>

          {loadingClasses ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="rounded-3xl h-56 skeleton border border-[hsl(var(--border))]" />)}
            </div>
          ) : classes.length === 0 ? (
            <Reveal className="text-center py-20">
              <span className="text-5xl block mb-4">📚</span>
              <p className="text-[hsl(var(--muted-foreground))] text-lg">Classes coming soon — stay tuned!</p>
            </Reveal>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map((cls: any, i: number) => (
                <Reveal key={cls.id} delay={i * 0.1} direction="scale">
                  <TiltCard>
                    <GlowCard className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.2)] rounded-3xl overflow-hidden transition-all duration-500 h-full shadow-sm hover:shadow-xl">
                      <div className={`h-1.5 bg-gradient-to-r ${gradients[i % gradients.length]}`} />
                      <div className="p-6 sm:p-7">
                        <div className="flex items-center gap-4 mb-5">
                          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center shadow-lg`}>
                            <span className="text-white text-xl font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{cls.name?.[0]?.toUpperCase() || 'C'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[hsl(var(--foreground))] text-lg truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{cls.name}</p>
                            {cls.subject && <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">{cls.subject}</p>}
                          </div>
                        </div>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2 mb-5 leading-relaxed">{cls.description || 'English language class with expert instruction and interactive sessions'}</p>
                        {cls.monthlyFee != null && (
                          <div className="flex items-center justify-between pt-5 border-t border-[hsl(var(--border))]">
                            <span className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium">Monthly</span>
                            <span className="text-lg font-black text-[hsl(var(--primary))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Rs. {Number(cls.monthlyFee).toLocaleString()}</span>
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
            <Link to={user ? '/classes' : '/register'} className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-glow))] text-white font-bold text-sm shadow-2xl shadow-[hsl(var(--primary)/0.2)] hover:shadow-[hsl(var(--primary)/0.35)] hover:scale-105 transition-all duration-300 relative overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative">{user ? 'View All Classes' : 'Join & Explore All Classes'}</span>
              <svg className="relative w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ PLATFORM FEATURES ═══════════ */}
      <section id="features" className="py-24 sm:py-32 relative bg-[hsl(var(--card))]">
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[hsl(var(--accent)/0.04)] rounded-full blur-[120px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--accent)/0.08)] border border-[hsl(var(--accent)/0.12)] mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">PLATFORM FEATURES</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Everything to <span className="text-[hsl(var(--accent))]">Excel</span>
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] text-base mt-4 max-w-2xl mx-auto">A complete learning ecosystem powered by cutting-edge technology</p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {platformFeatures.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08} direction={i < 3 ? 'left' : 'right'}>
                <TiltCard>
                  <GlowCard className="bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.15)] rounded-3xl p-7 transition-all duration-500 h-full shadow-sm hover:shadow-xl">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                      <span className="text-2xl">{f.icon}</span>
                    </div>
                    <h3 className="text-base font-bold text-[hsl(var(--foreground))] mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{f.title}</h3>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{f.desc}</p>
                  </GlowCard>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ GALLERY ═══════════ */}
      <section id="gallery" className="py-24 sm:py-32 relative overflow-hidden bg-[hsl(var(--muted))]">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--accent)/0.08)] border border-[hsl(var(--accent)/0.12)] mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">📸 OUR GALLERY</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Moments at <span className="text-[hsl(var(--accent))]">Eazy English</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {galleryImages.map((img, i) => (
              <Reveal key={i} delay={i * 0.1} direction="scale">
                <div className="group relative rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-500">
                  <img src={img.src} alt={img.alt} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" width={800} height={600} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                    <p className="text-white text-xs font-medium">{img.alt}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ ABOUT / WHO WE ARE (Reference style) ═══════════ */}
      <section id="about" className="py-24 sm:py-32 relative overflow-hidden bg-[hsl(var(--card))]">
        <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-[hsl(var(--accent)/0.04)] rounded-full blur-[150px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal direction="left" className="flex justify-center">
              <div className="relative group">
                <div className="absolute -inset-6 bg-gradient-to-br from-[hsl(var(--primary)/0.08)] to-[hsl(var(--accent)/0.06)] rounded-[3rem] blur-2xl group-hover:from-[hsl(var(--primary)/0.15)] transition-all duration-700" />
                <TiltCard className="relative w-72 sm:w-80 rounded-[2rem] overflow-hidden border border-[hsl(var(--border))] shadow-2xl">
                  <img src={teacherImg} alt="Thilina Dhananjaya teaching" className="w-full aspect-square object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--background)/0.6)] via-transparent to-transparent" />
                </TiltCard>

                <div className="absolute -bottom-6 -right-4 sm:right-2 lg:-right-8 bg-[hsl(var(--card)/0.95)] backdrop-blur-xl rounded-2xl border border-[hsl(var(--border))] p-4 shadow-2xl animate-float">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                      <span className="text-white text-lg">🏆</span>
                    </div>
                    <div>
                      <p className="text-[hsl(var(--foreground))] text-lg font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>95%</p>
                      <p className="text-[hsl(var(--muted-foreground))] text-[10px] font-medium">Pass Rate</p>
                    </div>
                  </div>
                </div>

                {/* Verified badge */}
                <div className="absolute -bottom-4 -left-4 bg-[hsl(var(--card)/0.95)] backdrop-blur-xl rounded-xl border border-[hsl(var(--border))] px-3 py-2 shadow-xl animate-float" style={{ animationDelay: '1s' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </div>
                    <p className="text-[hsl(var(--foreground))] text-[10px] font-bold">Verified Expert</p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal direction="right">
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--accent)/0.08)] border border-[hsl(var(--accent)/0.12)] mb-5">
                  <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">⭐ Who We Are</span>
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  English By <span className="text-[hsl(var(--primary))]">Thilina Dhananjaya</span>
                </h2>
                <p className="text-[hsl(var(--muted-foreground))] text-base mt-5 leading-relaxed max-w-lg mx-auto lg:mx-0">
                  Welcome to the Learning Management System of Eazy English by Thilina Dhananjaya. This is the premier destination for students seeking to achieve fluency in English. With a passion for teaching, Thilina conducts classes using innovative and engaging teaching methods that captivate students' interest.
                </p>
                <p className="text-[hsl(var(--muted-foreground))] text-base mt-3 leading-relaxed max-w-lg mx-auto lg:mx-0">
                  At Eazy English, we revolutionize language education by connecting students with personal instructors who converse in a friendly and immersive manner, promoting confidence, proficiency, and real-world language skills.
                </p>

                <div className="grid grid-cols-2 gap-4 mt-10">
                  {[
                    { num: '5+', label: 'Years Teaching', icon: '📖' },
                    { num: '95%', label: 'Pass Rate', icon: '📈' },
                    { num: '50+', label: 'Video Lessons', icon: '🎬' },
                    { num: '10+', label: 'Class Centers', icon: '🏫' },
                  ].map((s, i) => (
                    <Reveal key={s.label} delay={i * 0.1} direction="scale">
                      <GlowCard className="bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-2xl p-5 text-center hover:bg-[hsl(var(--card))] hover:shadow-lg hover:border-[hsl(var(--primary)/0.2)] transition-all duration-300">
                        <span className="text-2xl block mb-2">{s.icon}</span>
                        <p className="text-xl font-black text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.num}</p>
                        <p className="text-[hsl(var(--muted-foreground))] text-xs mt-0.5 font-medium">{s.label}</p>
                      </GlowCard>
                    </Reveal>
                  ))}
                </div>

                {/* Contact info like reference */}
                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                  <a href="tel:+94770000000" className="flex items-center gap-3 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors">
                    <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Call Us Anytime</p>
                      <p className="text-sm font-bold text-[hsl(var(--foreground))]">+94770000000</p>
                    </div>
                  </a>
                  <a href="mailto:info@eazyenglish.lk" className="flex items-center gap-3 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors">
                    <div className="w-10 h-10 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Email Us Anytime</p>
                      <p className="text-sm font-bold text-[hsl(var(--foreground))]">info@eazyenglish.lk</p>
                    </div>
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════ STUDENT RANKS / ACHIEVEMENTS ═══════════ */}
      <section className="py-24 sm:py-32 relative bg-[hsl(var(--muted))]">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--accent)/0.08)] border border-[hsl(var(--accent)/0.12)] mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">🏅 STUDENT RANKS</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Top <span className="text-[hsl(var(--accent))]">Achievers</span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { rank: '🥇', name: 'Sanduni Perera', score: 'A+', grade: '2025 O/L', gradient: 'from-amber-400 via-yellow-400 to-amber-500' },
              { rank: '🥈', name: 'Kavindu Silva', score: 'A', grade: '2025 O/L', gradient: 'from-slate-300 via-gray-300 to-slate-400' },
              { rank: '🥉', name: 'Nethmi Fernando', score: 'A', grade: '2025 A/L', gradient: 'from-orange-400 via-amber-500 to-orange-600' },
              { rank: '⭐', name: 'Dilshan Kumara', score: 'A', grade: '2025 O/L', gradient: 'from-blue-400 via-indigo-400 to-blue-500' },
            ].map((student, idx) => (
              <Reveal key={student.name} delay={idx * 0.12} direction="up">
                <TiltCard>
                  <div className="relative rounded-3xl overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:shadow-xl transition-all duration-500">
                    <div className={`h-1.5 bg-gradient-to-r ${student.gradient}`} />
                    <div className="p-6 text-center">
                      <span className="text-4xl block mb-3">{student.rank}</span>
                      <div className={`inline-flex px-4 py-1.5 rounded-full bg-gradient-to-r ${student.gradient} shadow-lg mb-3`}>
                        <span className="text-white font-black text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{student.score}</span>
                      </div>
                      <p className="text-[hsl(var(--foreground))] font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{student.name}</p>
                      <p className="text-[hsl(var(--muted-foreground))] text-xs mt-1">{student.grade}</p>
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS — Dark section like reference ═══════════ */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-14">
            <div className="lg:flex lg:items-end lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-5">
                  <span className="text-amber-400 text-xs font-bold tracking-wider">⭐ Voices Of Our Learners</span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  What Our Students<br />Are <span className="text-[hsl(var(--accent))]">Saying?</span>
                </h2>
              </div>
            </div>
          </Reveal>

          <Reveal direction="up" delay={0.2}>
            <TestimonialCarousel />
          </Reveal>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section id="faq" className="py-24 sm:py-32 relative bg-[hsl(var(--muted))]">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.1)] mb-5">
              <span className="text-[hsl(var(--primary))] text-xs font-bold tracking-wider">❓ FAQ</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Frequently Asked <span className="text-[hsl(var(--primary))]">Questions</span>
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

      {/* ═══════════ SOCIAL / CONNECT ═══════════ */}
      <section className="py-20 relative bg-[hsl(var(--card))]">
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--accent)/0.08)] border border-[hsl(var(--accent)/0.12)] mb-5">
              <span className="text-[hsl(var(--accent))] text-xs font-bold tracking-wider">📱 CONNECT WITH US</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Join Our <span className="text-[hsl(var(--accent))]">Community</span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { platform: 'YouTube', icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', color: 'from-red-500 to-red-600', label: 'Lessons & Tips' },
              { platform: 'Facebook', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z', color: 'from-blue-600 to-blue-700', label: 'Updates & News' },
              { platform: 'WhatsApp', icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z', color: 'from-emerald-500 to-green-600', label: 'Direct Support' },
            ].map((social, i) => (
              <Reveal key={social.platform} delay={i * 0.1} direction="up">
                <a href="#" className="group block bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.2)] rounded-2xl p-6 text-center transition-all duration-500 hover:-translate-y-1 shadow-sm hover:shadow-xl">
                  <div className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br ${social.color} flex items-center justify-center shadow-lg mb-4 group-hover:scale-110 transition-transform duration-500`}>
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d={social.icon} /></svg>
                  </div>
                  <p className="text-[hsl(var(--foreground))] font-bold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{social.platform}</p>
                  <p className="text-[hsl(var(--muted-foreground))] text-xs mt-1">{social.label}</p>
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

        <Reveal className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center" direction="scale">
          <span className="text-6xl block mb-6">🚀</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Ready to Start Your<br />English Journey?
          </h2>
          <p className="text-white/80 text-base sm:text-lg mt-5 max-w-xl mx-auto">
            Join hundreds of students already learning with Eazy English. Your first step towards fluency starts here.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-10 justify-center">
            <Link to="/register" className="group px-10 py-4 rounded-2xl bg-white text-[hsl(var(--primary))] font-bold text-base shadow-2xl shadow-black/20 hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(var(--accent)/0.1)] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
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
      <footer className="bg-slate-900 py-14 border-t border-slate-800 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-[hsl(var(--primary)/0.3)] to-transparent" />
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
                <p className="text-white/40 text-sm leading-relaxed max-w-xs">
                  Empowering students with premium English education through modern technology and expert guidance.
                </p>
              </div>
              <div>
                <h4 className="text-white/70 font-semibold text-xs uppercase tracking-wider mb-5">Quick Links</h4>
                <div className="space-y-3">
                  {['Home', 'Courses', 'Classes', 'Features', 'Gallery', 'About', 'FAQ'].map(l => (
                    <a key={l} href={`#${l.toLowerCase()}`} className="block text-white/40 text-sm hover:text-[hsl(var(--accent))] hover:translate-x-1 transition-all duration-300">{l}</a>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-white/70 font-semibold text-xs uppercase tracking-wider mb-5">Platform</h4>
                <div className="space-y-3">
                  {[{ label: 'Sign In', to: '/login' }, { label: 'Register', to: '/register' }, { label: 'Dashboard', to: '/dashboard' }].map(l => (
                    <Link key={l.label} to={l.to} className="block text-white/40 text-sm hover:text-[hsl(var(--accent))] hover:translate-x-1 transition-all duration-300">{l.label}</Link>
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
                    <a key={s.label} href="#" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[hsl(var(--primary)/0.15)] hover:border-[hsl(var(--primary)/0.3)] hover:scale-110 transition-all duration-300 group" aria-label={s.label}>
                      <svg className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d={s.icon} /></svg>
                    </a>
                  ))}
                </div>
                <p className="text-white/25 text-xs mt-5">Follow us for daily tips, updates, and free content</p>
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-white/25 text-xs">© {new Date().getFullYear()} Eazy English by Thilina Dhananjaya. All rights reserved.</p>
              <p className="text-white/15 text-xs">Designed & Developed by <span className="text-white/30">SurakshaLMS</span></p>
            </div>
          </Reveal>
        </div>
      </footer>
    </div>
  );
}
