import { useState, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import PostSection from "@/components/PostSection";
import AboutSection from "@/components/AboutSection";
import CourseTypesSection from "@/components/CourseTypesSection";
import AboutTeacherSection from "@/components/AboutTeacherSection";
import LoadingPage from "@/components/LoadingPage";

// Lazy load non-critical components
const ImageGallerySection = lazy(() => import("@/components/ImageGallerySection"));

const InstitutesSection = lazy(() => import("@/components/InstitutesSection"));
const Footer = lazy(() => import("@/components/Footer"));
const WhatsAppButton = lazy(() => import("@/components/WhatsAppButton"));

// Loading fallback component
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

const Index = () => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      {/* Loading page */}
      <AnimatePresence>
        {isLoading && (
          <LoadingPage onLoadComplete={() => setIsLoading(false)} />
        )}
      </AnimatePresence>

      {/* Main content */}
      {!isLoading && (
        <motion.div
          className="min-h-screen scroll-smooth"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Navbar />
          <HeroSection />
          <PostSection />
          <AboutSection />
          <CourseTypesSection />

          {/* Lazy loaded sections */}
          <Suspense fallback={<SectionFallback />}>
            <InstitutesSection />
          </Suspense>

          <Suspense fallback={<SectionFallback />}>
            <ImageGallerySection />
          </Suspense>

          <AboutTeacherSection />

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
};

export default Index;
