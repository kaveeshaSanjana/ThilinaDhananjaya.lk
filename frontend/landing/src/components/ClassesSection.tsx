import { motion } from "framer-motion";
import { Clock, Monitor, Users } from "lucide-react";
import groupPhoto from "@/assets/group-photo.jpeg";

const classes = [
  {
    level: "O/L English",
    schedule: "Saturday & Sunday",
    time: "8:00 AM - 10:00 AM",
    mode: "Online + Physical",
    color: "bg-primary/10 text-primary",
  },
  {
    level: "A/L General English",
    schedule: "Monday & Wednesday",
    time: "4:00 PM - 6:00 PM",
    mode: "Online Only",
    color: "bg-accent/10 text-accent",
  },
  {
    level: "Spoken English",
    schedule: "Friday",
    time: "6:00 PM - 7:30 PM",
    mode: "Online Only",
    color: "bg-destructive/10 text-destructive",
  },
];

const ClassesSection = () => (
  <section className="py-20" style={{ background: "var(--hero-gradient)" }} id="classes">
    <div className="container mx-auto px-4">

      {/* Group Photo Banner */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="relative mb-16 rounded-3xl overflow-hidden shadow-2xl max-w-5xl mx-auto"
      >
        <img
          src={groupPhoto}
          alt="Students group photo with Thilina Dhananjaya"
          className="w-full h-[320px] md:h-[420px] object-cover"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {/* Content on image */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="absolute bottom-0 left-0 right-0 p-6 md:p-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/90 backdrop-blur-sm rounded-full p-2">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-white/80 text-sm font-medium tracking-wide uppercase" style={{ fontFamily: "var(--font-body)" }}>
              Our Learning Family
            </span>
          </div>
          <h3 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
            Join <span className="text-primary">5,000+</span> Students Who Trust Us
          </h3>
          <p className="text-white/70 text-sm md:text-base mt-2 max-w-lg" style={{ fontFamily: "var(--font-body)" }}>
            Be part of Sri Lanka's fastest-growing English learning community
          </p>
        </motion.div>
      </motion.div>

      {/* Section Heading */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-14"
      >
        <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-body)' }}>Our Classes</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">Upcoming Class Schedule</h2>
      </motion.div>

      {/* Class Cards */}
      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {classes.map((c, i) => (
          <motion.div
            key={c.level}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15, duration: 0.5 }}
            className="bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-xl transition-shadow duration-300"
          >
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${c.color}`}>
              {c.level}
            </span>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 text-primary" />
                <span>{c.schedule} • {c.time}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Monitor className="w-4 h-4 text-primary" />
                <span>{c.mode}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default ClassesSection;
