import { motion } from "framer-motion";
import teacherAbout from "@/assets/teacher-about.png";

const AboutTeacherSection = () => {
  return (
    <section
      id="about-teacher"
      className="relative py-10 md:py-12 overflow-hidden bg-background lg:min-h-screen lg:flex lg:items-center"
    >
      <div className="container mx-auto px-4 max-w-6xl w-full">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
          {/* Left: Text - vertically centered */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            <span className="inline-block text-primary text-xs md:text-sm font-bold tracking-[0.2em] uppercase mb-2">
              About the Teacher
            </span>
            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3 leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              ගුරුවරයා පිළිබඳව
            </h2>
            <div className="w-16 h-1 bg-primary rounded-full mb-4 mx-auto lg:mx-0" />
            <div
              className="space-y-3 text-sm md:text-[0.95rem] max-w-xl mx-auto lg:mx-0"
              style={{ fontFamily: "var(--font-body)", lineHeight: 1.7, color: "hsl(215 28% 25%)" }}
            >
              <p>
                ගම්පහ බණ්ඩාරනායක විද්‍යාලයෙන් පාසල් අධ්‍යාපනය ද කටුනායක ඉංජිනේරු තාක්ෂණ ආයතනයෙන් සිවිල් ඉංජිනේරු විද්‍යාව පිළිබඳ උසස් අධ්‍යාපනය ද හැදෑරුවෙකි.
              </p>
              <p>
                ශ්‍රී ලංකාවේ පාසල් අධ්‍යාපනය සහ උසස් අධ්‍යාපනය යන දෙකම ඉංග්‍රීසි මාධ්‍යයෙන් ලද පළමු කණ්ඩායමේ සාමාජිකයෙකි. පාසල් ඉංග්‍රීසි විවාද කණ්ඩායම නියෝජනය කල සාමාජිකයෙකි.
              </p>
              <p>
                පුරා වසර 14ක් අති සාර්ථක ප්‍රථිඵල හා දරුවන්ගේ ආදරය දිනා ගත් ගුරුවරයෙකි. විභාග A සමාර්ථයට අමතරව ඉංග්‍රීසි කථන හැකියාව දියුණු කිරීමට ද දරුවන් පුහුණු කරවන ගුරුවරයෙකි.
              </p>
            </div>
          </motion.div>

          {/* Right: Image - anchored bottom */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="flex items-end justify-center lg:justify-end self-stretch -mb-10 md:-mb-12"
          >
            <img
              src={teacherAbout}
              alt="Thilina Dhananjaya - English Teacher"
              className="w-full max-w-xs sm:max-w-sm lg:max-w-md h-auto max-h-[75vh] object-contain object-bottom block"
              loading="lazy"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutTeacherSection;
