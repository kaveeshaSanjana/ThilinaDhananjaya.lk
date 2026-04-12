import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// SAME spreadsheet as videos, but a SEPARATE sheet tab for the image gallery.
// Sheet tab columns: url | alt
//
// How to get the gid:
//   1. Open the spreadsheet → click the "Gallery" tab at the bottom
//   2. Look at the browser URL bar → copy the number after "gid="
//   3. Replace the value below.
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-2yuQgo-0SSFVFrQWqKrxoyOWXEk4oTs4lS8R0ix8O_52Jxn3CqwreJuieKEE6K4HrDUHxNAWh2KD/pub?gid=321259135&single=true&output=csv";
// ─────────────────────────────────────────────────────────────────────────────

interface GalleryImage {
  url: string;
  alt: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim()); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): GalleryImage[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const urlIdx = headers.indexOf("url");
  const altIdx = headers.indexOf("alt");
  return lines
    .slice(1)
    .map((line) => {
      const cols = parseCsvLine(line);
      return {
        url: urlIdx >= 0 ? cols[urlIdx] ?? "" : "",
        alt: altIdx >= 0 ? cols[altIdx] ?? "Gallery image" : "Gallery image",
      };
    })
    .filter((img) => img.url.startsWith("http"));
}

const ImageGallerySection = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    fetch(SHEET_CSV_URL, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.text();
      })
      .then((text) => {
        clearTimeout(timer);
        setImages(parseCsv(text));
        setLoading(false);
      })
      .catch(() => {
        clearTimeout(timer);
        setError(true);
        setLoading(false);
      });

    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  const closeLightbox = useCallback(() => setLightbox(null), []);
  const prevImage = useCallback(() =>
    setLightbox((i) => (i !== null ? (i - 1 + images.length) % images.length : null)), [images.length]);
  const nextImage = useCallback(() =>
    setLightbox((i) => (i !== null ? (i + 1) % images.length : null)), [images.length]);

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowRight") nextImage();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, closeLightbox, prevImage, nextImage]);

  return (
    <section className="py-20 bg-background" id="gallery">
      <div className="container mx-auto px-4 max-w-7xl">
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

        {/* States */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        )}
        {error && (
          <p className="text-center text-muted-foreground py-16">
            Could not load gallery. Please check back later.
          </p>
        )}
        {!loading && !error && images.length === 0 && (
          <p className="text-center text-muted-foreground py-16">
            No images found. Add rows to your Google Sheet and refresh.
          </p>
        )}

        {/* Dynamic grid */}
        {!loading && !error && images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 auto-rows-[180px] sm:auto-rows-[200px] md:auto-rows-[220px]"
          >
            {images.map((img, i) => {
              // Create varying sizes: every 5th image is large (2x2), every 3rd is tall (1x2)
              const isLarge = i % 7 === 0;
              const isTall = i % 5 === 2;
              const isWide = i % 6 === 3;

              return (
                <motion.div
                  key={`${img.url}-${i}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.5) }}
                  className={`cursor-pointer overflow-hidden rounded-lg group relative ${
                    isLarge
                      ? "col-span-2 row-span-2"
                      : isTall
                      ? "row-span-2"
                      : isWide
                      ? "col-span-2"
                      : ""
                  }`}
                  onClick={() => setLightbox(i)}
                >
                  <img
                    src={img.url}
                    alt={img.alt}
                    loading="lazy"
                    className="w-full h-full object-cover block transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 rounded-lg" />
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && images[lightbox] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            onClick={closeLightbox}
          >
            {/* Close */}
            <button
              className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10"
              onClick={closeLightbox}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Prev */}
            {images.length > 1 && (
              <button
                className="absolute left-4 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                aria-label="Previous"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Image */}
            <motion.img
              key={lightbox}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              src={images[lightbox].url}
              alt={images[lightbox].alt}
              className="max-w-[90vw] max-h-[88vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Next */}
            {images.length > 1 && (
              <button
                className="absolute right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                aria-label="Next"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Counter */}
            <p className="absolute bottom-4 text-white/60 text-sm">
              {lightbox + 1} / {images.length}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default ImageGallerySection;
