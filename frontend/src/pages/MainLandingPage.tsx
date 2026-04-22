import { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import PostSection from '../components/landing/PostSection';
import CourseTypesSection from '../components/landing/CourseTypesSection';
import InstitutesSection from '../components/landing/InstitutesSection';
import LoadingPage from '../components/landing/LoadingPage';
import ReviewSection from '../components/landing/ReviewSection';

const Footer = lazy(() => import('../components/landing/Footer'));

function SectionFallback() {
  return (
    <div className="min-h-[30vh] flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export default function MainLandingPage() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      <AnimatePresence>
        {isLoading && <LoadingPage onLoadComplete={() => setIsLoading(false)} />}
      </AnimatePresence>

      {!isLoading && (
        <motion.div
          className="min-h-screen scroll-smooth"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <Navbar />

          <section id="home">
            <HeroSection />
          </section>

          <section id="results">
            <PostSection />
          </section>

          <section id="classes">
            <CourseTypesSection />
          </section>

          <section id="about">
            <InstitutesSection />
          </section>

          <ReviewSection />

          <section id="contact">
            <Suspense fallback={<SectionFallback />}>
              <Footer />
            </Suspense>
          </section>
        </motion.div>
      )}
    </>
  );
}
