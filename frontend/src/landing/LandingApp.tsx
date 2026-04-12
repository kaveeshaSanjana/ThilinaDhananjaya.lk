import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AboutSection from "./components/AboutSection";
import CourseTypesSection from "./components/CourseTypesSection";
import HeroSection from "./components/HeroSection";
import LoadingPage from "./components/LoadingPage";
import Navbar from "./components/Navbar";
import PostSection from "./components/PostSection";

const VideoGallerySection = lazy(() => import("./components/VideoGallerySection"));
const ImageGallerySection = lazy(() => import("./components/ImageGallerySection"));
const ReviewSection = lazy(() => import("./components/ReviewSection"));
const InstitutesSection = lazy(() => import("./components/InstitutesSection"));
const Footer = lazy(() => import("./components/Footer"));
const WhatsAppButton = lazy(() => import("./components/WhatsAppButton"));

const SectionFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="inline-block">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  </div>
);

export default function LandingPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");

    // Keep landing visual style fixed to its original light design.
    root.classList.remove("dark");

    return () => {
      if (hadDark) {
        root.classList.add("dark");
      }
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {isLoading && <LoadingPage onLoadComplete={() => setIsLoading(false)} />}
      </AnimatePresence>

      {!isLoading && (
        <motion.div
          className="landing-shell min-h-screen scroll-smooth"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <Navbar />
          <HeroSection />
          <PostSection />
          <AboutSection />
          <CourseTypesSection />

          <Suspense fallback={<SectionFallback />}>
            <InstitutesSection />
          </Suspense>

          <Suspense fallback={<SectionFallback />}>
            <VideoGallerySection />
          </Suspense>

          <Suspense fallback={<SectionFallback />}>
            <ImageGallerySection />
          </Suspense>

          <Suspense fallback={<SectionFallback />}>
            <ReviewSection />
          </Suspense>

          <Suspense fallback={null}>
            <Footer />
          </Suspense>

          <Suspense fallback={null}>
            <WhatsAppButton />
          </Suspense>
        </motion.div>
      )}
    </>
  );
}

