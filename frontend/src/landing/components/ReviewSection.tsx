import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-2yuQgo-0SSFVFrQWqKrxoyOWXEk4oTs4lS8R0ix8O_52Jxn3CqwreJuieKEE6K4HrDUHxNAWh2KD/pub?gid=800599048&single=true&output=csv";

interface ReviewItem {
  name: string;
  review: string;
  rating: number;
  avatar: string;
}

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

function parseCsv(text: string): ReviewItem[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const nameIdx = headers.indexOf("name");
  const reviewIdx = headers.indexOf("review");
  const ratingIdx = headers.indexOf("rating");
  const avatarIdx = headers.indexOf("avatar");

  return lines
    .slice(1)
    .map((line) => {
      const cols = parseCsvLine(line);
      const rating = ratingIdx >= 0 ? parseInt(cols[ratingIdx] ?? "5", 10) : 5;
      return {
        name: nameIdx >= 0 ? (cols[nameIdx] ?? "Student") : "Student",
        review: reviewIdx >= 0 ? (cols[reviewIdx] ?? "") : "",
        rating: Number.isNaN(rating) ? 5 : Math.min(5, Math.max(1, rating)),
        avatar: avatarIdx >= 0 ? (cols[avatarIdx] ?? "") : "",
      };
    })
    .filter((r) => r.review.length > 0);
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3 h-3 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
      ))}
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return (
    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
      {initials.toUpperCase()}
    </div>
  );
}

const cardStyles = [
  "bg-card border-border",
  "bg-primary/5 border-primary/20",
  "bg-secondary/70 border-border",
  "bg-accent/10 border-accent/25",
  "bg-muted/70 border-border",
  "bg-destructive/10 border-destructive/20",
];

function ReviewCard({ review, i }: { review: ReviewItem; i: number }) {
  const style = cardStyles[i % cardStyles.length];
  return (
    <div className={`${style} border rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300`}>
      <Quote className="absolute -top-1 -right-1 w-10 h-10 text-foreground/[0.05] rotate-12" />
      <p className="text-foreground/80 text-xs md:text-sm leading-relaxed line-clamp-4" style={{ fontFamily: "var(--font-body)" }}>
        "{review.review}"
      </p>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-foreground/5">
        <div className="flex items-center gap-2 min-w-0">
          {review.avatar ? (
            <img src={review.avatar} alt={review.name} loading="lazy" className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-2 ring-background" />
          ) : (
            <Initials name={review.name} />
          )}
          <span className="text-foreground font-semibold text-xs truncate" style={{ fontFamily: "var(--font-body)" }}>
            {review.name}
          </span>
        </div>
        <StarRating rating={review.rating} />
      </div>
    </div>
  );
}

function splitIntoColumns(items: ReviewItem[], cols: number): ReviewItem[][] {
  const columns: ReviewItem[][] = Array.from({ length: cols }, () => []);
  items.forEach((item, i) => columns[i % cols].push(item));
  return columns;
}

function ScrollColumn({
  reviews,
  duration,
  delay,
  paused,
  direction,
}: {
  reviews: ReviewItem[];
  duration: number;
  delay: number;
  paused: boolean;
  direction: "up" | "down";
}) {
  const track = [...reviews, ...reviews];
  return (
    <div
      className="flex flex-col gap-3 w-max"
      style={{
        animation: `scroll-${direction} ${duration}s linear ${delay}s infinite`,
        animationPlayState: paused ? "paused" : "running",
      }}
    >
      {track.map((review, i) => (
        <div key={`${review.name}-${i}`} className="w-[220px] md:w-[260px] lg:w-[280px]">
          <ReviewCard review={review} i={i} />
        </div>
      ))}
    </div>
  );
}

const ReviewSection = () => {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    fetch(SHEET_CSV_URL, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.text();
      })
      .then((text) => {
        clearTimeout(timer);
        setReviews(parseCsv(text));
        setLoading(false);
      })
      .catch(() => {
        clearTimeout(timer);
        setError(true);
        setLoading(false);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const cols = 4;
  const columns = splitIntoColumns(reviews, cols);
  const baseDuration = Math.max(18, reviews.length * 3);

  return (
    <section className="py-20 bg-muted/30 overflow-hidden" id="reviews">
      <div className="container mx-auto px-4 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <p className="text-primary font-semibold text-sm uppercase tracking-[0.2em] mb-3" style={{ fontFamily: "var(--font-body)" }}>
            Student Reviews
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>
            දරුවො ඇත්තටම <span className="text-primary">අපි ගැන කියපු දේ</span>
          </h2>
          <p className="text-muted-foreground mt-3 text-sm md:text-base max-w-lg mx-auto" style={{ fontFamily: "var(--font-body)" }}>
            Real feedback from students who transformed their English with us
          </p>
        </motion.div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}
      {error && <p className="text-center text-muted-foreground py-12">Could not load reviews. Please check back later.</p>}
      {!loading && !error && reviews.length === 0 && <p className="text-center text-muted-foreground py-12">No reviews found.</p>}

      {!loading && !error && reviews.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative h-[600px] md:h-[680px] overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-20 z-10 bg-gradient-to-b from-muted/30 to-transparent" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 z-10 bg-gradient-to-t from-muted/30 to-transparent" />

          <div className="flex justify-center gap-3 h-full px-4">
            {columns.map((col, ci) =>
              col.length > 0 ? (
                <motion.div
                  key={ci}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.7, delay: ci * 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <ScrollColumn
                    reviews={col}
                    duration={baseDuration + ci * 4}
                    delay={-(ci * 3)}
                    paused={paused}
                    direction={ci % 2 === 0 ? "down" : "up"}
                  />
                </motion.div>
              ) : null,
            )}
          </div>
        </motion.div>
      )}
    </section>
  );
};

export default ReviewSection;

