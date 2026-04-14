import logoImg from "@/assets/logo.png";
import { Facebook, Instagram, Youtube } from "lucide-react";
import { motion } from "framer-motion";

const Footer = () => (
  <motion.footer
    className="bg-foreground py-12"
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
  >
    <div className="container mx-auto px-4">
      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="Eazy English Logo" className="w-14 h-14 object-contain" />
          <div>
            <h3 className="text-primary-foreground font-bold text-lg" style={{ fontFamily: 'var(--font-body)' }}>Eazy English</h3>
            <p className="text-primary-foreground/60 text-xs">with Thilina Dhananjaya</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-primary-foreground/80 text-sm mb-3 font-semibold" style={{ fontFamily: 'var(--font-body)' }}>Quick Links</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-primary-foreground/60">
            {["Home", "Classes", "Results", "About", "Contact"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="hover:text-primary-foreground transition-colors">{l}</a>
            ))}
          </div>
        </div>

        <div className="flex justify-center md:justify-end gap-4">
          {[Facebook, Instagram, Youtube].map((Icon, i) => (
            <a key={i} href="#" className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary/30 transition-colors">
              <Icon className="w-5 h-5 text-primary-foreground/70" />
            </a>
          ))}
        </div>
      </div>

      <div className="border-t border-primary-foreground/10 mt-8 pt-6 text-center">
        <p className="text-primary-foreground/40 text-xs">© 2026 Eazy English with Thilina Dhananjaya. All rights reserved.</p>
        <p className="text-primary-foreground/70 text-xs mt-2">
          Powered by{' '}
          <a href="https://suraksha.lk" target="_blank" rel="noreferrer" className="font-semibold hover:underline">
            Suraksha LMS Pvt Ltd
          </a>
        </p>
      </div>
    </div>
  </motion.footer>
);

export default Footer;
