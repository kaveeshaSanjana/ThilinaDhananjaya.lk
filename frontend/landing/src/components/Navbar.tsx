import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo.png";
import { motion, useScroll, useSpring } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

const DEFAULT_MAIN_APP_URL = "http://localhost:8080";

const resolveMainAppUrl = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const fromQuery = searchParams.get("mainAppUrl")?.trim();
  if (fromQuery && /^https?:\/\//i.test(fromQuery)) {
    return fromQuery.replace(/\/$/, "");
  }

  try {
    const fromReferrer = new URL(document.referrer).origin;
    if (fromReferrer && /^https?:\/\//i.test(fromReferrer)) {
      return fromReferrer.replace(/\/$/, "");
    }
  } catch {
    // Ignore invalid or empty referrer.
  }

  const fromEnv = import.meta.env.VITE_MAIN_APP_URL?.trim();
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv.replace(/\/$/, "");
  }

  if (window.location.port === "8081") {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }

  return window.location.origin.replace(/\/$/, "") || DEFAULT_MAIN_APP_URL;
};

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });
  const mainAppUrl = resolveMainAppUrl();
  const getMainAppLink = (path: string) => `${mainAppUrl}${path}`;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Home", href: "#home" },
    { label: "Class Types", href: "#class-types" },
    { label: "Gallery", href: "#gallery" },
    { label: "About", href: "#about" },
  ];

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-card/90 backdrop-blur-xl shadow-lg border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4">
        <div
          className={`flex items-center justify-between transition-all duration-300 ${
            scrolled ? "h-16" : "h-20"
          }`}
        >
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <img
                src={logoImg}
                alt="Easy English Logo"
                className={`object-contain transition-all duration-300 ${
                  scrolled ? "w-10 h-10" : "w-12 h-12"
                }`}
              />
            </div>
            <div>
              <h2
                className="text-sm font-bold text-foreground leading-tight"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Easy English
              </h2>
              <p className="text-xs text-muted-foreground">
                with Thilina Dhananjaya
              </p>
            </div>
          </motion.div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center">
            <div className="flex items-center bg-muted/50 rounded-full px-2 py-1.5 gap-1">
              {links.map((item, i) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="text-sm font-medium text-muted-foreground hover:text-primary hover:bg-card px-4 py-1.5 rounded-full transition-all duration-200"
                >
                  {item.label}
                </motion.a>
              ))}
            </div>
          </div>

          {/* Desktop button */}
          <div className="hidden md:flex items-center gap-3">
            <Button asChild size="sm" className="rounded-full px-6">
              <a href={getMainAppLink("/login")} target="_top" rel="noreferrer">Student Login</a>
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 text-foreground"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Scroll progress bar */}
      <motion.div
        style={{ scaleX, transformOrigin: "0%" }}
        className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-accent to-primary"
      />

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="md:hidden bg-card/95 backdrop-blur-xl border-t border-border rounded-b-3xl shadow-xl mx-2 mb-2"
        >
          <div className="flex flex-col p-4 gap-1">
            {links.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted px-4 py-3 rounded-xl transition-colors"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-3 pt-3 border-t border-border">
              <Button asChild size="sm" className="w-full rounded-full">
                <a href={getMainAppLink("/login")} target="_top" rel="noreferrer">Student Login</a>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
};

export default Navbar;
