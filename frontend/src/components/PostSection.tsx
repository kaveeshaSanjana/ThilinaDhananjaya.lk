import { motion } from "framer-motion";
import postLiveClass from "@/assets/post-live-class.jpg";
import postStudents from "@/assets/post-students.jpg";
import postResults from "@/assets/post-results.jpg";

const posts = [
  { image: postStudents, label: "LIVE CLASSES", rotate: -6 },
  { image: postLiveClass, label: "ONLINE SESSIONS", featured: true, rotate: 0 },
  { image: postResults, label: "EXAM RESULTS", rotate: 5 },
];

const PostSection = () => (
  <section className="relative py-20 md:py-32 overflow-hidden" style={{ background: "var(--hero-gradient)" }}>
    {/* Dot pattern */}
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: `radial-gradient(hsl(var(--primary)) 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
      }}
    />

    <div className="container mx-auto px-4 relative z-10 max-w-6xl">
      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: false, margin: "-50px" }}
        transition={{ duration: 0.5 }}
        className="flex justify-center mb-5 md:mb-6"
      >
        <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-[11px] md:text-xs font-bold uppercase tracking-[0.2em]">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Easy English
        </span>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, margin: "-50px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-center mb-3 md:mb-4"
      >
        <h2
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Be the Next Success Story
        </h2>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, margin: "-50px" }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-center text-muted-foreground text-sm md:text-base mb-12 md:mb-20 max-w-md mx-auto"
      >
        Join us today
      </motion.p>

      {/* MOBILE: Clean vertical stack */}
      <div className="flex flex-col items-center gap-8 md:hidden">
        {posts.map((post, i) => (
          <motion.div
            key={post.label}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-30px" }}
            transition={{ duration: 0.6, delay: 0.1 * i }}
            className="w-full max-w-[320px]"
          >
            <div className="relative overflow-hidden rounded-2xl shadow-xl aspect-[3/4]">
              <img
                src={post.image}
                alt={post.label}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <span
                  className="text-white/90 text-xs font-bold uppercase tracking-[0.15em]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {post.label}
                </span>
                <div className="mt-2 h-[2px] w-8 bg-primary rounded-full opacity-80" />
              </div>
              <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* DESKTOP: Balanced 3-card grid with tilt */}
      <div className="hidden md:grid grid-cols-3 gap-6 lg:gap-8 items-end">
        {posts.map((post, i) => (
          <motion.div
            key={post.label}
            initial={{ opacity: 0, y: 60, rotate: post.rotate * 1.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: post.rotate }}
            viewport={{ once: false, margin: "-50px" }}
            transition={{
              duration: 0.8,
              delay: 0.15 * i,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            whileHover={{
              rotate: 0,
              scale: 1.04,
              y: -12,
              zIndex: 30,
              transition: { duration: 0.3 },
            }}
            className="cursor-pointer group"
            style={{ zIndex: post.featured ? 20 : 10 }}
          >
            <div
              className={`relative overflow-hidden rounded-3xl shadow-2xl transition-shadow duration-300 group-hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)] ${
                post.featured ? "aspect-[3/4]" : "aspect-[3/4]"
              }`}
            >
              <img
                src={post.image}
                alt={post.label}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <span
                  className="text-white/90 text-sm font-bold uppercase tracking-[0.15em]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {post.label}
                </span>
                <div className="mt-2 h-[2px] w-8 bg-primary rounded-full opacity-80" />
              </div>
              <div className="absolute inset-0 rounded-3xl ring-2 ring-white/10 group-hover:ring-primary/40 transition-all duration-300" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default PostSection;
