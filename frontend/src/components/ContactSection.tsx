import { motion } from "framer-motion";
import { Phone, Mail, MapPin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const ContactSection = () => (
  <section className="py-20" style={{ background: "var(--hero-gradient)" }} id="contact">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-14"
      >
        <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-body)' }}>Get In Touch</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">Contact Us</h2>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-10 max-w-4xl mx-auto">
        {/* Contact info */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
            Have questions about our classes? Want to register? Reach out and we'll get back to you right away.
          </p>
          {[
            { icon: Phone, label: "+94 77 123 4567" },
            { icon: Mail, label: "info@eazyenglish.lk" },
            { icon: MapPin, label: "Colombo, Sri Lanka" },
          ].map((c) => (
            <div key={c.label} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <c.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-foreground font-medium text-sm" style={{ fontFamily: 'var(--font-body)' }}>{c.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Contact form */}
        <motion.form
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="text"
            placeholder="Your Name"
            className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
          />
          <input
            type="email"
            placeholder="Email Address"
            className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
          />
          <textarea
            rows={4}
            placeholder="Your Message"
            className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-muted-foreground"
          />
          <Button className="w-full gap-2" size="lg">
            <Send className="w-4 h-4" />
            Send Message
          </Button>
        </motion.form>
      </div>
    </div>
  </section>
);

export default ContactSection;
