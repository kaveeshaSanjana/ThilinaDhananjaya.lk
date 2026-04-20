import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent } from "../ui/dialog";
import post1 from "../assets/post-1.jpeg";
import post2 from "../assets/post-2.jpeg";
import post3 from "../assets/post-3.jpeg";

const posts = [
  { image: post1, label: "Success Story 1", rotate: -6 },
  { image: post2, label: "Success Story 2", featured: true, rotate: 0 },
  { image: post3, label: "Success Story 3", rotate: 5 },
];

const PostSection = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
  <section id="results" className="relative py-20 md:py-32 overflow-hidden bg-white scroll-mt-24">
    {/* Dot pattern */}
    <div
      className="absolute inset-0 opacity-[0.02]"
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
        className="flex justify-center mb-5 md:mb-6 hidden"
      >
        <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-[11px] md:text-xs font-bold uppercase tracking-[0.2em]">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Thilina Dhananjaya
        </span>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, margin: "-50px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-center mb-3 md:mb-4 hidden"
      >
        <h2
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Our Success Stories
        </h2>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, margin: "-50px" }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-center text-muted-foreground text-sm md:text-base mb-12 md:mb-20 max-w-md mx-auto hidden"
      >
        Learn from our students who achieved their goals
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
              <div 
                className="relative overflow-hidden rounded-2xl shadow-xl aspect-[3/4] cursor-pointer"
                onClick={() => setSelectedImage(post.image)}
              >
                <img
                  src={post.image}
                  alt={post.label}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
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
                onClick={() => setSelectedImage(post.image)}
              >
                <img
                  src={post.image}
                  alt={post.label}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute inset-0 rounded-3xl ring-2 ring-white/10 group-hover:ring-primary/40 transition-all duration-300" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

    {/* Image Popup Dialog */}
    <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
      <DialogContent className="max-w-2xl border-0 bg-black/90 p-0">
        <div className="relative w-full h-auto">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Full view"
              className="w-full h-auto rounded-lg"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  </section>
  );
};

export default PostSection;

