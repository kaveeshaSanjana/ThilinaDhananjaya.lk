import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZoomIn, X, ChevronLeft, ChevronRight } from "lucide-react";
import g01 from "@/assets/gallery/g01.jpeg";
import g02 from "@/assets/gallery/g02.jpeg";
import g03 from "@/assets/gallery/g03.jpeg";
import g04 from "@/assets/gallery/g04.jpeg";
import g05 from "@/assets/gallery/g05.jpeg";
import g06 from "@/assets/gallery/g06.jpeg";
import g07 from "@/assets/gallery/g07.jpeg";
import g08 from "@/assets/gallery/g08.jpeg";

const images: { src: string; alt: string; title: string }[] = [
  { src: g01, alt: "Phonetics class on the whiteboard", title: "Phonetics Class" },
  { src: g02, alt: "Birthday celebration with students", title: "Birthday Celebration" },
  { src: g03, alt: "Engaged students in classroom", title: "Engaged Students" },
  { src: g04, alt: "One-on-one tutoring session", title: "One-on-One Tutoring" },
  { src: g05, alt: "Media interview", title: "Media Interview" },
  { src: g06, alt: "Lecture hall full of students", title: "Lecture Hall" },
  { src: g07, alt: "Free O/L batch session", title: "Free O/L Batch" },
  { src: g08, alt: "Vocabulary practice — kitchen items", title: "Vocabulary Practice" },
];

const ImageGallerySection = () => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const showPrev = useCallback(
    () => setLightboxIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length)),
    []
  );
  const showNext = useCallback(
    () => setLightboxIndex((i) => (i === null ? i : (i + 1) % images.length)),
    []
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxIndex, closeLightbox, showPrev, showNext]);

  return (
    <section className="py-20 bg-secondary/30" id="gallery">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p
            className="text-primary font-semibold text-sm uppercase tracking-wider mb-2"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Our Moments
          </p>
          <h2
            className="text-3xl md:text-4xl font-extrabold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Our Gallery
          </h2>
          <p
            className="text-muted-foreground mt-3 text-sm md:text-base max-w-lg mx-auto"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Moments from our classes, events and student achievements
          </p>
        </motion.div>

        {/* Uniform responsive grid — clean rectangular block */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
          {images.map((img, i) => {
            return (
              <motion.button
                key={i}
                type="button"
                onClick={() => setLightboxIndex(i)}
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: (i % 6) * 0.05 }}
                aria-label={`Open ${img.title}`}
                className="group relative overflow-hidden aspect-square rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                {/* Blue brand overlay */}
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/70 transition-colors duration-300 flex flex-col items-center justify-center text-center p-3">
                  <div className="opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0 transition-all duration-300 flex flex-col items-center gap-2">
                    <span className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm border border-white/40 flex items-center justify-center">
                      <ZoomIn className="w-5 h-5 text-white" />
                    </span>
                    <span
                      className="text-white font-bold text-sm md:text-base drop-shadow"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {img.title}
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            {/* Close */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeLightbox();
              }}
              aria-label="Close"
              className="absolute top-4 right-4 md:top-6 md:right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Prev */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showPrev();
              }}
              aria-label="Previous image"
              className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-primary border border-white/20 flex items-center justify-center text-white transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showNext();
              }}
              aria-label="Next image"
              className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-primary border border-white/20 flex items-center justify-center text-white transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Image */}
            <motion.div
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="relative max-w-5xl w-full max-h-[85vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={images[lightboxIndex].src}
                alt={images[lightboxIndex].alt}
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
              />
              <div className="mt-4 text-center">
                <p
                  className="text-white text-lg font-bold"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {images[lightboxIndex].title}
                </p>
                <p className="text-white/60 text-xs mt-1">
                  {lightboxIndex + 1} / {images.length}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default ImageGallerySection;
