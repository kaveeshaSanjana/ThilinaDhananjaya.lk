import { motion } from "framer-motion";
import { MapPin, Monitor, Users, Wifi } from "lucide-react";
import sriLankaMap from "../assets/sri-lanka-map.png";
import winsLogo from "../assets/wins-logo.png";
import sihasmaLogo from "../assets/sihasma-logo.png";

const locations = [
  { top: "58%", left: "38%" },
  { top: "48%", left: "52%" },
  { top: "78%", left: "42%" },
  { top: "8%", left: "48%" },
  { top: "40%", left: "44%" },
];

const institutes = [
  {
    logo: winsLogo,
    name: "WINS උසස් අධ්‍යාපන ආයතනය",
    sublabel: "සාලින්ද සුපර් අසල",
    location: "වේයංගොඩ",
    phone: ["077 873 7664", "076 688 2353"],
  },
  {
    logo: sihasmaLogo,
    name: "සිහස්මා උසස් අධ්‍යාපන ආයතනය",
    sublabel: null,
    location: "වැලිවේරිය",
    phone: ["077 365 5614", "071 766 9363"],
  },
];

const ZoomLogo = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
    <rect width="100" height="100" rx="20" fill="#2D8CFF" />
    <path d="M15 35C15 31.686 17.686 29 21 29H55C58.314 29 61 31.686 61 35V65C61 68.314 58.314 71 55 71H21C17.686 71 15 68.314 15 65V35Z" fill="white" />
    <path d="M63 44L82 33V67L63 56V44Z" fill="white" />
  </svg>
);

const YouTubeLogo = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
    <rect width="100" height="100" rx="20" fill="#FF0000" />
    <path d="M82 35.5C81.1 32.3 78.7 29.8 75.5 29C69.3 27.3 50 27.3 50 27.3C50 27.3 30.7 27.3 24.5 29.1C21.4 30 18.9 32.4 18 35.6C16.2 41.9 16.2 50 16.2 50C16.2 50 16.2 58.2 18 64.5C18.9 67.7 21.3 70.2 24.5 71C30.8 72.7 50 72.7 50 72.7C50 72.7 69.3 72.7 75.5 70.9C78.7 70 81.1 67.6 82 64.4C83.8 58.1 83.8 50 83.8 50C83.8 50 83.8 41.9 82 35.5Z" fill="white" />
    <path d="M43 60.5V39.5L63 50L43 60.5Z" fill="#FF0000" />
  </svg>
);

const stats = [
  { icon: <Users className="w-5 h-5" />, value: "2000+", label: "Students" },
  { icon: <Monitor className="w-5 h-5" />, value: "Live", label: "Classes" },
  { icon: <Wifi className="w-5 h-5" />, value: "මුලු ලන්කාවටම", label: "Reach" },
];

const InstitutesSection = () => (
  <section id="institutes" className="py-24 overflow-hidden bg-background">
    <div className="container mx-auto px-4 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-bold uppercase tracking-[0.2em] mb-5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Online & Island-wide
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
          ලන්කාවේ ඔනේම තැනක ඉදන්
          <span className="text-primary"> ආසාවෙන් ඉගෙනගන්න</span>
        </h2>
        <p className="text-muted-foreground mt-4 text-sm md:text-base max-w-xl mx-auto" style={{ fontFamily: "var(--font-body)" }}>
          Join live sessions online via Zoom & YouTube, or walk into one of our trusted partner institutes near you.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex justify-center"
        >
          <div className="relative w-[280px] sm:w-[340px] md:w-[400px] lg:w-full lg:max-w-[420px]">
            <div className="absolute inset-0 bg-primary/15 blur-[80px] rounded-full scale-110" />
            <img
              src={sriLankaMap}
              alt="Sri Lanka Map"
              className="relative w-full drop-shadow-2xl"
              style={{ filter: "drop-shadow(0 0 24px hsl(var(--primary)/0.35))" }}
            />
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
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
                  className="relative"
                >
                  <MapPin className="w-6 h-6 text-primary fill-primary/30 drop-shadow-[0_0_8px_rgba(59,130,246,0.7)]" />
                  <motion.span
                    className="absolute -inset-1 rounded-full border border-primary/40"
                    animate={{ scale: [1, 3], opacity: [0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: i * 0.3 }}
                  />
                </motion.div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex flex-col gap-8"
        >
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1" style={{ fontFamily: "var(--font-body)" }}>
              Online Platforms
            </p>
            {[
              { logo: <ZoomLogo />, name: "Zoom", desc: "Interactive live sessions with real-time Q&A", badge: "bg-blue-500" },
              { logo: <YouTubeLogo />, name: "YouTube", desc: "Watch recorded lessons anytime at your pace", badge: "bg-red-500" },
            ].map((p) => (
              <div key={p.name} className="flex items-center gap-4 p-4 rounded-2xl bg-muted/50 border border-border hover:shadow-md transition-shadow duration-300">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow">{p.logo}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-foreground text-sm" style={{ fontFamily: "var(--font-body)" }}>{p.name}</span>
                    <span className={`${p.badge} text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full`}>Live</span>
                  </div>
                  <p className="text-muted-foreground text-xs" style={{ fontFamily: "var(--font-body)" }}>{p.desc}</p>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-3 gap-3 mt-1">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1 py-4 rounded-xl bg-muted/50 border border-border text-center">
                  <div className="text-primary">{s.icon}</div>
                  <p className="font-bold text-foreground text-sm leading-none">{s.value}</p>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap" style={{ fontFamily: "var(--font-body)" }}>
              Physical Partner Institutes
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex flex-col gap-4">
            {institutes.map((inst, i) => (
              <motion.div
                key={inst.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="bg-card border border-border rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 p-5 flex gap-5 items-center"
              >
                <div className="w-24 h-16 flex-shrink-0 rounded-xl overflow-hidden border border-border bg-white flex items-center justify-center p-2">
                  {inst.logo ? (
                    <img src={inst.logo} alt={inst.name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="bg-red-600 text-white font-extrabold text-sm px-2 py-1 rounded text-center" style={{ fontFamily: "var(--font-heading)" }}>
                      සිහස්මා
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm leading-snug" style={{ fontFamily: "var(--font-body)" }}>{inst.name}</p>
                  {inst.sublabel && <p className="text-muted-foreground text-xs mt-0.5">{inst.sublabel}</p>}
                  <div className="flex items-center gap-1 mt-1 text-muted-foreground text-xs">
                    <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                    <span>{inst.location}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {inst.phone.map((p) => (
                      <a key={p} href={`tel:${p.replace(/\s/g, "")}`} className="text-primary font-semibold text-xs hover:underline">
                        {p}
                      </a>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}

            <p className="text-muted-foreground/50 text-xs text-center mt-1" style={{ fontFamily: "var(--font-body)" }}>
              More partner institutes coming soon across Sri Lanka
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default InstitutesSection;

