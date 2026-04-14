import { motion, type Variants } from "framer-motion";
import { BookOpen, GraduationCap, Video, FileText, Mic, Clock, User } from "lucide-react";
import { useState } from "react";

const features = [
  {
    icon: Video,
    titleEn: "Live Online Classes",
    titleSi: "සජීවී අන්තර්ජාල පන්තිය",
    descEn: "Interactive sessions with real-time Q&A and discussion.",
    descSi: "සිසුන්ට ප්‍රශ්න අහන්න සහ සාකච්ඡා කරන්න පුළුවන් අන්තර්ක්‍රියාකාරී සැසි.",
  },
  {
    icon: FileText,
    titleEn: "Structured Notes",
    titleSi: "ව්‍යුහගත සටහන්",
    descEn: "Comprehensive study materials crafted for A/L & O/L syllabi.",
    descSi: "A/L සහ O/L විෂය නිර්දේශයට ගැළපෙන සම්පූර්ණ අධ්‍යයන ද්‍රව්‍ය.",
  },
  {
    icon: Mic,
    titleEn: "Speaking Practice",
    titleSi: "කතා කිරීමේ පුහුණුව",
    descEn: "Build fluency through guided conversation exercises.",
    descSi: "මඟපෙන්වන සංවාද අභ්‍යාස හරහා කතා කිරීමේ දක්ෂතාවය සහ ස්වයංවිශ්වාසය වර්ධනය කරගන්න.",
  },
  {
    icon: GraduationCap,
    titleEn: "Exam Strategy",
    titleSi: "විභාග උපායමාර්ග",
    descEn: "Proven techniques to maximize marks in every paper.",
    descSi: "සෑම පත්‍රයකම ලකුණු උපරිම කිරීම",
  },
  {
    icon: BookOpen,
    titleEn: "Grammar Mastery",
    titleSi: "ව්‍යාකරණ දක්ෂතාව",
    descEn: "Clear, simplified approach to English grammar rules.",
    descSi: "ඉංග්‍රීසි ව්‍යාකරණ නියම පැහැදිලිව සහ සරලව ඉගෙනගන්න.",
  },
  {
    icon: Clock,
    titleEn: "Class Recordings",
    titleSi: "පන්ති පටිගත කිරීම්",
    descEn: "Students who miss classes get access to recorded sessions.",
    descSi: "පන්තිය මඟහැරුණු සිසුන්ට පටිගත කළ සැසි නැවත බැලීමට අවස්ථාව.",
  },
  {
    icon: FileText,
    titleEn: "Daily Homework Checking",
    titleSi: "දෛනික ගෙදර වැඩ පරීක්ෂාව",
    descEn: "Regular assignment review and feedback for each student.",
    descSi: "සෑම සිසුවෙකුටම නිරන්තර assignment review සහ feedback.",
  },
  {
    icon: User,
    titleEn: "Personalized Attention",
    titleSi: "පුද්ගලික අවධානය",
    descEn: "Individual focus and customized guidance for every student.",
    descSi: "සෑම සිසුවෙකුටම වෙන් වූ අවධානය සහ අභිරුචි මගපෙන්වීම.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.3 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
};

const centerVariants: Variants = {
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, type: "spring" as const, stiffness: 100, damping: 12 },
  },
};

const pulseRingVariants: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, delay: 0.2 + i * 0.15, ease: "easeOut" as const },
  }),
};

const FeatureCard = ({ feature, index }: { feature: typeof features[0]; index: number }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={cardVariants}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30 hover:-translate-y-1">
        {/* Background glow on hover */}
        <motion.div
          animate={{ opacity: hovered ? 0.08 : 0, scale: hovered ? 1.2 : 0.8 }}
          transition={{ duration: 0.5 }}
          className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-primary blur-3xl pointer-events-none"
        />

        {/* Step number */}
        <div className="absolute top-4 right-4">
          <span className="text-5xl font-extrabold text-foreground/[0.04] select-none" style={{ fontFamily: "var(--font-heading)" }}>
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        {/* Icon */}
        <motion.div
          animate={{ rotate: hovered ? 8 : 0, scale: hovered ? 1.1 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="relative z-10 w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 border border-primary/20 group-hover:bg-primary group-hover:border-primary transition-colors duration-500"
        >
          <feature.icon className="w-7 h-7 text-primary group-hover:text-primary-foreground transition-colors duration-500" />
        </motion.div>

        {/* Content */}
        <div className="relative z-10">
          <h3
            className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors duration-300"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {feature.titleEn}
          </h3>
          <h3
            className="text-sm font-semibold text-primary/80 mb-3"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {feature.titleSi}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            {feature.descEn}
          </p>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            {feature.descSi}
          </p>
        </div>

        {/* Bottom accent line */}
        <motion.div
          animate={{ scaleX: hovered ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary to-accent origin-left"
        />
      </div>
    </motion.div>
  );
};

const AboutSection = () => (
  <section className="relative py-24 md:py-32 overflow-hidden scroll-mt-24" id="about">
    {/* Backgrounds */}
    <div className="absolute inset-0 bg-background" />
    <div
      className="absolute inset-0 opacity-[0.015]"
      style={{
        backgroundImage: `radial-gradient(hsl(var(--primary)) 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
      }}
    />

    {/* Ambient blobs */}
    <motion.div
      animate={{ y: [0, -40, 0], x: [0, 30, 0], scale: [1, 1.1, 1] }}
      transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-10 left-[-10%] w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px]"
    />
    <motion.div
      animate={{ y: [0, 30, 0], x: [0, -20, 0], scale: [1, 1.15, 1] }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      className="absolute bottom-10 right-[-10%] w-[350px] h-[350px] rounded-full bg-accent/5 blur-[100px]"
    />

    <div className="container mx-auto px-4 relative z-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-20"
      >
        <h2
          className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          What Makes Us{" "}
          <span className="relative inline-block">
            <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary to-accent">
              Different
            </span>
            <motion.span
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.6, ease: "easeOut" }}
              className="absolute -bottom-2 left-0 right-0 h-3 bg-primary/10 rounded-full origin-left"
            />
          </span>
        </h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-muted-foreground mt-4 max-w-lg mx-auto text-sm md:text-base"
        >
          We combine innovative teaching methods with personalized attention to deliver exceptional results
        </motion.p>
      </motion.div>

      {/* Desktop: 3-column grid with center circle */}
      <div className="hidden lg:block">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="relative max-w-6xl mx-auto"
        >
          {/* Grid with center piece */}
          <div className="grid grid-cols-3 gap-6 items-start">
            {/* Left column */}
            <div className="space-y-6 pt-8">
              {features.slice(0, 2).map((f, i) => (
                <FeatureCard key={f.titleEn} feature={f} index={i} />
              ))}
            </div>

            {/* Center column - circle + 1 card below */}
            <div className="flex flex-col items-center gap-8">
              {/* Center circle */}
              <motion.div variants={centerVariants} className="relative">
                {/* Pulse rings */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    variants={pulseRingVariants}
                    custom={i}
                    className="absolute inset-0 rounded-full border border-primary/10"
                    style={{
                      transform: `scale(${1.3 + i * 0.25})`,
                    }}
                  />
                ))}

                {/* Rotating dashed ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-6 rounded-full border-2 border-dashed border-primary/15"
                />

                {/* Main circle */}
                <div className="relative w-48 h-48 rounded-full bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/30">
                  {/* Inner shimmer */}
                  <motion.div
                    animate={{ rotate: [-10, 10, -10] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-2 rounded-full bg-gradient-to-tr from-white/20 to-transparent"
                  />
                  <div className="text-center text-primary-foreground relative z-10">
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 1, duration: 0.5 }}
                      className="text-5xl font-extrabold leading-none"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      6+
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 0.9 }}
                      viewport={{ once: true }}
                      transition={{ delay: 1.2, duration: 0.5 }}
                      className="text-[10px] font-bold mt-1.5 uppercase tracking-[0.2em]"
                    >
                      Key Features
                    </motion.p>
                  </div>
                </div>
              </motion.div>

              {/* Cards under center */}
              {features.slice(2, 4).map((f, i) => (
                <FeatureCard key={f.titleEn} feature={f} index={i + 2} />
              ))}
            </div>

            {/* Right column */}
            <div className="space-y-6 pt-8">
              {features.slice(4, 6).map((f, i) => (
                <FeatureCard key={f.titleEn} feature={f} index={i + 4} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tablet: 2 columns */}
      <div className="hidden md:block lg:hidden">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-2 gap-5 max-w-3xl mx-auto"
        >
          {features.map((f, i) => (
            <FeatureCard key={f.titleEn} feature={f} index={i} />
          ))}
        </motion.div>
      </div>

      {/* Mobile: single column */}
      <div className="md:hidden">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-4 max-w-sm mx-auto"
        >
          {/* Mobile center badge */}
          <motion.div variants={centerVariants} className="flex justify-center mb-6">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl shadow-primary/20">
              <div className="text-center text-primary-foreground">
                <p className="text-3xl font-extrabold leading-none" style={{ fontFamily: "var(--font-heading)" }}>6+</p>
                <p className="text-[8px] font-bold mt-1 uppercase tracking-widest opacity-90">Features</p>
              </div>
            </div>
          </motion.div>

          {features.map((f, i) => (
            <FeatureCard key={f.titleEn} feature={f} index={i} />
          ))}
        </motion.div>
      </div>
    </div>
  </section>
);

export default AboutSection;


