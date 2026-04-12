import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import PostSection from "@/components/PostSection";
import AboutSection from "@/components/AboutSection";
import VideoGallerySection from "@/components/VideoGallerySection";
import ImageGallerySection from "@/components/ImageGallerySection";
import ReviewSection from "@/components/ReviewSection";
import SriLankaSection from "@/components/SriLankaSection";
import Footer from "@/components/Footer";
import InstitutesSection from "@/components/InstitutesSection";
import WhatsAppButton from "@/components/WhatsAppButton";
import { motion } from "framer-motion";

const Index = () => {
  return (
    <motion.div
      className="min-h-screen scroll-smooth"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <Navbar />
      <HeroSection />
      <PostSection />
      <AboutSection />
      <InstitutesSection />
      <VideoGallerySection />
      <ImageGallerySection />
      <ReviewSection />
      <Footer />
      <WhatsAppButton />
    </motion.div>
  );
};

export default Index;
