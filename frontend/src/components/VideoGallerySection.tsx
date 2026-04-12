import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Your Google Spreadsheet — first sheet (name it "Videos" as per the template)
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1hlT8eo643lur8Ac1JzX313dm1Pj4MP65Q4eoPPN1lLM/export?format=csv";
// ─────────────────────────────────────────────────────────────────────────────

interface VideoItem {
  title: string;
  url: string;
  description: string;
  thumbnail: string;
}

/** Robust CSV line parser — handles quoted fields that include commas */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/** Parse the full CSV text into VideoItem array */
function parseCsv(text: string): VideoItem[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const titleIdx = headers.indexOf("title");
  const urlIdx = headers.indexOf("url");
  const descIdx = headers.indexOf("description");
  const thumbIdx = headers.indexOf("thumbnail");

  return lines
    .slice(1)
    .map((line) => {
      const cols = parseCsvLine(line);
      return {
        title: titleIdx >= 0 ? cols[titleIdx] ?? "" : "",
        url: urlIdx >= 0 ? cols[urlIdx] ?? "" : "",
        description: descIdx >= 0 ? cols[descIdx] ?? "" : "",
        thumbnail: thumbIdx >= 0 ? cols[thumbIdx] ?? "" : "",
      };
    })
    .filter((v) => v.url.startsWith("http"));
}

// Facebook brand colour
const FB_BLUE = "#1877F2";

// Static YouTube videos always shown
const STATIC_VIDEOS: VideoItem[] = [
  {
    title: "English Class Session",
    url: "https://www.youtube.com/watch?v=DhY4k16yexA",
    description: "",
    thumbnail: "https://img.youtube.com/vi/DhY4k16yexA/hqdefault.jpg",
  },
  {
    title: "English Class Session",
    url: "https://www.youtube.com/watch?v=9M_s7tehp2I",
    description: "",
    thumbnail: "https://img.youtube.com/vi/9M_s7tehp2I/hqdefault.jpg",
  },
];

const isYouTube = (url: string) =>
  url.includes("youtube.com") || url.includes("youtu.be");

// ─── COMPONENT ────────────────────────────────────────────────────────────────
const VideoGallerySection = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);

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
        setVideos(parseCsv(text));
        setLoading(false);
      })
      .catch(() => {
        clearTimeout(timer);
        setError(true);
        setLoading(false);
      });

    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  // Merge static YouTube videos with sheet videos
  const allVideos = [...STATIC_VIDEOS, ...videos];

  // Repeat enough copies so the track always overflows the viewport
  const minItems = 12;
  const copies = allVideos.length > 0 ? Math.ceil(minItems / allVideos.length) + 1 : 0;
  const baseTrack = allVideos.length > 0 ? Array.from({ length: copies }, () => allVideos).flat() : [];
  const track = [...baseTrack, ...allVideos];
  const animPct = allVideos.length > 0 ? (100 / (copies + 1)).toFixed(4) : "50";
  const durationSec = Math.max(20, allVideos.length * 8);

  return (
    <section className="py-20 overflow-hidden bg-background" id="videos">
      {/* ── Heading ── */}
      <div className="container mx-auto px-4 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <p
            className="text-primary font-semibold text-sm uppercase tracking-wider mb-2"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Video Gallery
          </p>
          <h2
            className="text-3xl md:text-4xl font-extrabold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Our Latest Sessions
          </h2>
          <p
            className="text-muted-foreground mt-3 text-sm md:text-base max-w-lg mx-auto"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Watch highlights from our live classes, student achievements and spoken English sessions
          </p>
        </motion.div>
      </div>

      {/* ── States ── */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <p className="text-center text-muted-foreground py-12">
          Could not load videos. Please check back later.
        </p>
      )}

      {!loading && !error && allVideos.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No videos found. Add rows to your Google Sheet and refresh.
        </p>
      )}

      {/* ── RTL Scroll Gallery ── */}
      {allVideos.length > 0 && (
        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          {/* Fade edges */}
          <div className="pointer-events-none absolute left-0 top-0 h-full w-16 z-10 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-16 z-10 bg-gradient-to-l from-background to-transparent" />

          {/* Scrolling track */}
          <div
            className="flex gap-5 w-max px-4"
            style={{
              animation: `scroll-rtl-custom ${durationSec}s linear infinite`,
              animationPlayState: paused ? "paused" : "running",
              ["--scroll-pct" as string]: `-${animPct}%`,
            }}
          >
            {track.map((video, i) => (
              <a
                key={`${video.url}-${i}`}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 w-[280px] md:w-[340px] rounded-2xl overflow-hidden border border-border bg-card shadow-md transition-all hover:shadow-xl hover:-translate-y-1 group"
              >
                {/* Thumbnail / preview area */}
                <div
                  className="relative w-full flex items-center justify-center overflow-hidden"
                  style={{
                    aspectRatio: "16/9",
                    background: isYouTube(video.url)
                      ? "linear-gradient(135deg, #1a1a1a 0%, #282828 100%)"
                      : "linear-gradient(135deg, #1877F2 0%, #0d5fcc 100%)",
                  }}
                >
                  {/* Custom thumbnail if provided, else branded placeholder */}
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <>
                      {/* Facebook logo watermark */}
                      <svg
                        className="absolute top-3 left-3 w-7 h-7 opacity-90"
                        viewBox="0 0 24 24"
                        fill="white"
                      >
                        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.791-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                      </svg>
                      {/* Subtle grid pattern */}
                      <div
                        className="absolute inset-0 opacity-10"
                        style={{
                          backgroundImage:
                            "radial-gradient(white 1px, transparent 1px)",
                          backgroundSize: "20px 20px",
                        }}
                      />
                    </>
                  )}

                  {/* Play button overlay */}
                  <div className="relative z-10 w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Play className="w-6 h-6 text-white fill-white translate-x-0.5" />
                  </div>

                  {/* Platform badge */}
                  {isYouTube(video.url) ? (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-white text-[10px] font-semibold bg-[#FF0000]">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="white">
                        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
                      </svg>
                      Watch on YouTube
                    </div>
                  ) : (
                    <div
                      className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-white text-[10px] font-semibold"
                      style={{ background: FB_BLUE }}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="white">
                        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.791-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                      </svg>
                      Watch on Facebook
                    </div>
                  )}
                </div>

                {/* Card footer */}
                <div className="p-4">
                  {video.title && (
                    <p
                      className="font-semibold text-foreground text-sm truncate"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {video.title}
                    </p>
                  )}
                  {video.description && (
                    <p
                      className="text-muted-foreground text-xs mt-1 line-clamp-2"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {video.description}
                    </p>
                  )}
                  {!video.title && !video.description && (
                    <p
                      className="text-muted-foreground text-xs"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {isYouTube(video.url) ? "Click to watch on YouTube" : "Click to watch on Facebook"}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default VideoGallerySection;

