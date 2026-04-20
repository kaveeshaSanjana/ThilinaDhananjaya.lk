import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import teacherImg from "../assets/teacher.png";

const HandDrawnUnderline = () => (
  <motion.svg
    viewBox="0 0 300 12"
    className="absolute -bottom-2 left-0 w-full h-3"
    initial={{ pathLength: 0, opacity: 0 }}
    animate={{ pathLength: 1, opacity: 1 }}
    transition={{ delay: 1.2, duration: 1, ease: "easeInOut" }}
  >
    <motion.path
      d="M2 8 C30 3, 60 10, 90 6 C120 2, 150 9, 180 5 C210 1, 240 8, 270 4 C280 3, 290 6, 298 5"
      fill="none"
      stroke="hsl(var(--destructive))"
      strokeWidth="3"
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ delay: 1.2, duration: 1, ease: "easeInOut" }}
    />
  </motion.svg>
);

const HeroSection = () => {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-end md:items-center overflow-visible pt-32 md:pt-0 pb-0"
      style={{ background: "var(--hero-gradient)" }}
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 right-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl"
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.05, 0.08, 0.05] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-10 left-10 w-96 h-96 rounded-full bg-accent/5 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/4 w-4 h-4 rounded-full bg-primary/20"
      />

      <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-0 lg:gap-8 items-center relative z-10 pb-0 mb-0">
        <div className="order-2 lg:order-1 text-center lg:text-left -mt-4 md:-mt-2 lg:mt-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3 md:mb-6"
          >
            <BookOpen className="w-4 h-4" />
            A/L & O/L English Excellence
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
            className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight mb-2 md:mb-4"
          >
            Easy English
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mb-2 md:mb-4"
          >
            <p className="text-lg md:text-2xl font-semibold text-foreground" style={{ fontFamily: "var(--font-body)" }}>
              with{" "}
              <span className="relative inline-block pb-1">
                <span className="relative z-10 text-foreground font-bold">Thilina Dhananjaya</span>
                <HandDrawnUnderline />
              </span>
            </p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="text-muted-foreground text-sm md:text-lg max-w-lg mx-auto lg:mx-0 leading-relaxed"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Master English with confidence. Proven methods, outstanding results, and a learning experience designed to take you beyond the exam.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.85, x: 60 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 18, delay: 0.4 }}
          className="order-1 lg:order-2 flex justify-center relative"
        >
          <div className="relative mt-16 md:mt-12 lg:mt-16 mb-0 pb-0">
            <img
              src={teacherImg}
              alt="Thilina Dhananjaya - English Teacher"
              className="relative z-10 w-[260px] md:w-[420px] lg:w-[480px] drop-shadow-2xl block"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;

