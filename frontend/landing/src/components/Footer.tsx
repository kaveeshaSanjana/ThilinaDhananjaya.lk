import logoImg from "@/assets/logo.png";
import { Facebook, Instagram, Youtube } from "lucide-react";
import { motion } from "framer-motion";

const Footer = () => {
  const quickLinks = [
    { label: "Home", href: "#" },
    { label: "Reviews", href: "#reviews" },
    { label: "About", href: "#about" },
    { label: "Videos", href: "#videos" },
    { label: "Gallery", href: "#gallery" },
  ];

  return (
  <motion.footer
    id="contact"
    className="bg-foreground pt-12 pb-24 sm:pb-12"
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
  >
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
        <div className="flex items-center justify-center sm:justify-start gap-3 text-center sm:text-left">
          <img src={logoImg} alt="Eazy English Logo" className="w-14 h-14 object-contain" />
          <div>
            <h3 className="text-primary-foreground font-bold text-lg" style={{ fontFamily: 'var(--font-body)' }}>Eazy English</h3>
            <p className="text-primary-foreground/60 text-xs">with Thilina Dhananjaya</p>
          </div>
        </div>

        <div className="text-center sm:text-left lg:text-center">
          <p className="text-primary-foreground/80 text-sm mb-3 font-semibold" style={{ fontFamily: 'var(--font-body)' }}>Quick Links</p>
          <div className="flex flex-wrap justify-center sm:justify-start lg:justify-center gap-2 text-sm text-primary-foreground/70">
            {quickLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-2.5 py-1 rounded-full hover:bg-primary-foreground/10 hover:text-primary-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="flex justify-center sm:justify-end lg:justify-end gap-3">
          {[Facebook, Instagram, Youtube].map((Icon, i) => (
            <a key={i} href="#" className="w-11 h-11 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary/30 transition-colors">
              <Icon className="w-5 h-5 text-primary-foreground/70" />
            </a>
          ))}
        </div>
      </div>

      <div className="border-t border-primary-foreground/10 mt-8 pt-6 text-center">
        <p className="text-primary-foreground/40 text-xs">
          © 2026 Eazy English with Thilina Dhananjaya. All rights reserved.{' '}
          <a href="https://suraksha.lk" target="_blank" rel="noreferrer" className="font-semibold hover:underline">
            Powered by Suraksha LMS
          </a>
        </p>
      </div>
    </div>
  </motion.footer>
  );
};

export default Footer;
