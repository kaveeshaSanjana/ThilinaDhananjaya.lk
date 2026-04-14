import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

const WhatsAppButton = () => (
  <motion.a
    href="https://wa.me/94771234567?text=Hi%2C%20I%27m%20interested%20in%20your%20English%20classes"
    target="_blank"
    rel="noopener noreferrer"
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ delay: 2, type: "spring", stiffness: 150, damping: 12 }}
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
    className="fixed bottom-8 right-6 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#1fba59] text-white px-5 py-3 rounded-full shadow-lg shadow-[#25D366]/30 transition-colors duration-200"
    style={{ fontFamily: "var(--font-body)" }}
  >
    <MessageCircle className="w-5 h-5" />
    <span className="text-sm font-semibold hidden sm:inline">Join New Class</span>
  </motion.a>
);

export default WhatsAppButton;


