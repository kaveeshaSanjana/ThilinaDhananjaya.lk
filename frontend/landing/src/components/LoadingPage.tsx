import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import logoImg from "@/assets/logo.png";
import teacherImg from "@/assets/teacher.png";
import post1Img from "@/assets/post-1.jpeg";
import post2Img from "@/assets/post-2.jpeg";
import post3Img from "@/assets/post-3.jpeg";

interface LoadingPageProps {
  onLoadComplete: () => void;
}

const LoadingPage = ({ onLoadComplete }: LoadingPageProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const preloadImages = [
      teacherImg,
      post1Img,
      post2Img,
      post3Img,
    ];

    let loadedCount = 0;
    let cancelled = false;

    const handleAssetDone = () => {
      loadedCount += 1;
      if (cancelled) return;

      setProgress((loadedCount / preloadImages.length) * 100);

      if (loadedCount === preloadImages.length) {
        setTimeout(() => {
          if (!cancelled) onLoadComplete();
        }, 500);
      }
    };

    preloadImages.forEach((src) => {
      const imgElement = new Image();
      imgElement.onload = handleAssetDone;
      imgElement.onerror = handleAssetDone;
      imgElement.src = src;
    });

    return () => {
      cancelled = true;
    };
  }, [onLoadComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-b from-background via-background to-primary/5"
    >
      {/* Ambient blobs */}
      <div className="absolute top-20 right-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-10 left-10 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />

      <div className="relative z-10 text-center">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex justify-center mb-8"
        >
          <img src={logoImg} alt="Easy English" className="w-20 h-20 object-contain" />
        </motion.div>

        {/* Brand name */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-4xl font-extrabold text-foreground mb-2"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Easy English
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-primary font-semibold mb-12"
        >
          with Thilina Dhananjaya
        </motion.p>

        {/* Loading bar */}
        <div className="w-64 h-1.5 bg-muted rounded-full overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
            className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full"
          />
        </div>

        {/* Progress text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="text-muted-foreground text-sm"
        >
          Loading materials... {Math.round(progress)}%
        </motion.p>

        {/* Animated dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="flex justify-center gap-2 mt-8"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{
                delay: i * 0.2,
                duration: 1.5,
                repeat: Infinity,
              }}
              className="w-2 h-2 rounded-full bg-primary"
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LoadingPage;
