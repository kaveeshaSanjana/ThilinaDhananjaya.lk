import { motion } from "framer-motion";
import { MapPin, Wifi, Users, Monitor } from "lucide-react";
import sriLankaMap from "@/assets/sri-lanka-map.png";

const locations = [
  { top: "58%", left: "38%" },
  { top: "48%", left: "52%" },
  { top: "78%", left: "42%" },
  { top: "8%",  left: "48%" },
  { top: "40%", left: "44%" },
];

// Zoom SVG logo
const ZoomLogo = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
    <rect width="100" height="100" rx="20" fill="#2D8CFF" />
    <path
      d="M15 35C15 31.686 17.686 29 21 29H55C58.314 29 61 31.686 61 35V65C61 68.314 58.314 71 55 71H21C17.686 71 15 68.314 15 65V35Z"
      fill="white"
    />
    <path
      d="M63 44L82 33V67L63 56V44Z"
      fill="white"
    />
  </svg>
);

// YouTube SVG logo
const YouTubeLogo = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
    <rect width="100" height="100" rx="20" fill="#FF0000" />
    <path
      d="M82 35.5C81.1 32.3 78.7 29.8 75.5 29C69.3 27.3 50 27.3 50 27.3C50 27.3 30.7 27.3 24.5 29.1C21.4 30 18.9 32.4 18 35.6C16.2 41.9 16.2 50 16.2 50C16.2 50 16.2 58.2 18 64.5C18.9 67.7 21.3 70.2 24.5 71C30.8 72.7 50 72.7 50 72.7C50 72.7 69.3 72.7 75.5 70.9C78.7 70 81.1 67.6 82 64.4C83.8 58.1 83.8 50 83.8 50C83.8 50 83.8 41.9 82 35.5Z"
      fill="white"
    />
    <path d="M43 60.5V39.5L63 50L43 60.5Z" fill="#FF0000" />
  </svg>
);

const platforms = [
  {
    icon: <ZoomLogo />,
    name: "Zoom",
    desc: "Interactive live sessions with screen sharing & breakout rooms",
    color: "from-blue-500/10 to-blue-600/5",
    border: "border-blue-400/30",
    badge: "bg-blue-500",
  },
  {
    icon: <YouTubeLogo />,
    name: "YouTube",
    desc: "Watch recorded lessons anytime, anywhere at your own pace",
    color: "from-red-500/10 to-red-600/5",
    border: "border-red-400/30",
    badge: "bg-red-500",
  },
];

const stats = [
  { icon: <Users className="w-5 h-5" />, value: "2000+", label: "Students" },
  { icon: <Monitor className="w-5 h-5" />, value: "Live", label: "Classes" },
  { icon: <Wifi className="w-5 h-5" />, value: "Island-wide", label: "Reach" },
];

const SriLankaSection = () => {
  return (
    <section
      id="sri-lanka"
      className="relative py-24 md:py-32 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a0000 0%, #3d0000 40%, #1a0005 100%)" }}
    >
      {/* Background glow blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-red-600/20 blur-[120px]" />
        <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full bg-red-800/20 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-red-700/10 blur-[150px]" />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "radial-gradient(white 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />
      </div>

      <div className="container mx-auto px-4 max-w-7xl relative z-10">

        {/* ── Heading ── */}
        <div className="text-center mb-16 md:mb-20">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-400/30 bg-red-500/10 text-red-300 text-xs font-bold uppercase tracking-[0.2em] mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Online & Island-wide
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Learn English
            <br />
            <span className="text-red-400">Anywhere in</span>
            <br />
            Sri Lanka
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-red-100/60 text-base md:text-lg max-w-xl mx-auto"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Join live sessions via Zoom or catch up on YouTube — no matter where you are on the island.
          </motion.p>
        </div>

        {/* ── Main Content: Map + Platforms ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Map */}
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex justify-center relative"
          >
            <div className="relative w-[280px] md:w-[360px] lg:w-[400px]">
              {/* Glow behind map */}
              <div className="absolute inset-0 bg-red-500/20 blur-[60px] rounded-full scale-110" />

              <img
                src={sriLankaMap}
                alt="Sri Lanka Map"
                className="relative w-full drop-shadow-2xl"
                style={{ filter: "brightness(0) invert(1) opacity(0.15)" }}
              />

              {/* Location pins */}
              {locations.map((loc, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{ top: loc.top, left: loc.left }}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.12, type: "spring", stiffness: 300 }}
                >
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
                    className="relative"
                  >
                    <MapPin className="w-5 h-5 md:w-6 md:h-6 text-red-400 fill-red-500/40 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                    {/* Ping ring */}
                    <motion.span
                      className="absolute -inset-1 rounded-full border border-red-400/50"
                      animate={{ scale: [1, 2.8], opacity: [0.6, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: i * 0.3 }}
                    />
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Platforms + Stats */}
          <div className="flex flex-col gap-6">

            {/* Platform cards */}
            {platforms.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, x: 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
                whileHover={{ scale: 1.02, y: -4 }}
                className={`relative flex items-start gap-5 p-5 md:p-6 rounded-2xl bg-gradient-to-br ${p.color} border ${p.border} backdrop-blur-sm cursor-default overflow-hidden`}
              >
                {/* Shine sweep on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

                {/* Logo */}
                <div className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl overflow-hidden shadow-lg">
                  {p.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-white font-bold text-lg" style={{ fontFamily: "var(--font-body)" }}>
                      {p.name}
                    </h3>
                    <span className={`${p.badge} text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full`}>
                      Live
                    </span>
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                    {p.desc}
                  </p>
                </div>
              </motion.div>
            ))}

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="grid grid-cols-3 gap-3 mt-2"
            >
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.1, type: "spring" }}
                  className="flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl bg-white/5 border border-white/10 text-center"
                >
                  <div className="text-red-400">{s.icon}</div>
                  <p className="text-white font-bold text-base md:text-lg leading-none">{s.value}</p>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider">{s.label}</p>
                </motion.div>
              ))}
            </motion.div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default SriLankaSection;
