import { motion } from "framer-motion";
import logoImg from "../../assets/landing/logo.png";

const socialLinks = [
  {
    label: "Facebook",
    iconPath:
      "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  {
    label: "Instagram",
    iconPath:
      "M12 2.163c3.204 0 3.584.012 4.85.07 1.206.056 1.96.24 2.417.402a4.92 4.92 0 011.772 1.153 4.92 4.92 0 011.153 1.772c.163.457.347 1.211.402 2.417.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.056 1.206-.24 1.96-.402 2.417a5.06 5.06 0 01-2.925 2.925c-.457.163-1.211.347-2.417.402-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.206-.056-1.96-.24-2.417-.402a5.06 5.06 0 01-2.925-2.925c-.163-.457-.347-1.211-.402-2.417-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.056-1.206.24-1.96.402-2.417a4.92 4.92 0 011.153-1.772 4.92 4.92 0 011.772-1.153c.457-.163 1.211-.347 2.417-.402 1.266-.058 1.646-.07 4.85-.07zm0 1.838c-3.157 0-3.528.012-4.769.068-1.149.053-1.772.244-2.186.404a3.09 3.09 0 00-1.118.727 3.09 3.09 0 00-.727 1.118c-.16.414-.351 1.037-.404 2.186-.056 1.241-.068 1.612-.068 4.769s.012 3.528.068 4.769c.053 1.149.244 1.772.404 2.186.17.441.4.816.727 1.118.302.327.677.557 1.118.727.414.16 1.037.351 2.186.404 1.241.056 1.612.068 4.769.068s3.528-.012 4.769-.068c1.149-.053 1.772-.244 2.186-.404a3.23 3.23 0 001.118-.727 3.23 3.23 0 00.727-1.118c.16-.414.351-1.037.404-2.186.056-1.241.068-1.612.068-4.769s-.012-3.528-.068-4.769c-.053-1.149-.244-1.772-.404-2.186a3.09 3.09 0 00-.727-1.118 3.09 3.09 0 00-1.118-.727c-.414-.16-1.037-.351-2.186-.404-1.241-.056-1.612-.068-4.769-.068zm0 3.135a4.864 4.864 0 110 9.728 4.864 4.864 0 010-9.728zm0 1.838a3.026 3.026 0 100 6.052 3.026 3.026 0 000-6.052zm6.23-2.066a1.136 1.136 0 110 2.272 1.136 1.136 0 010-2.272z",
  },
  {
    label: "YouTube",
    iconPath:
      "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
];

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
          <img src={logoImg} alt="Easy English Logo" className="w-14 h-14 object-contain" />
          <div>
            <h3 className="text-primary-foreground font-bold text-lg" style={{ fontFamily: "var(--font-body)" }}>
              Easy English
            </h3>
            <p className="text-primary-foreground/60 text-xs">with Thilina Dhananjaya</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-primary-foreground/80 text-sm mb-3 font-semibold" style={{ fontFamily: "var(--font-body)" }}>
            Quick Links
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-primary-foreground/60">
            {["Home", "Classes", "Results", "About", "Contact"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="hover:text-primary-foreground transition-colors">
                {l}
              </a>
            ))}
          </div>
        </div>

        <div className="flex justify-center md:justify-end gap-4">
          {socialLinks.map((social) => (
            <a
              key={social.label}
              href="#"
              className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary/30 transition-colors"
              aria-label={social.label}
            >
              <svg className="w-5 h-5 text-primary-foreground/70" fill="currentColor" viewBox="0 0 24 24">
                <path d={social.iconPath} />
              </svg>
            </a>
          ))}
        </div>
      </div>

      <div className="border-t border-primary-foreground/10 mt-8 pt-6 text-center">
        <p className="text-primary-foreground/40 text-xs">© 2026 Easy English with Thilina Dhananjaya. All rights reserved.</p>
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
