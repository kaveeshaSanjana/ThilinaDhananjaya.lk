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
                සාම්ප්‍රදායික හා යල්පැනගිය ඉංග්‍රීසි ඉගැන්වීම් රටාව මුළුමනින්ම අතික්‍රමණය කරමින්, ශ්‍රී ලාංකේය දරු පරපුර තුළ ඉංග්‍රීසි භාෂාව කෙරෙහි ඇති බිය සහ පසුබෑම තුරන් කිරීමට තිළිණ ධනංජය ගුරුතුමා සමත් විය. උපකාරක පන්ති ක්ෂේත්‍රයට පිවිසි කෙටි කලක් තුළම දිවයිනේ අතිවිශාලතම සහ ජනප්‍රියතම ඉංග්‍රීසි පන්තියක් නිර්මාණය කිරීමට ඔහුට හැකි වන්නේ, හුදෙක් ව්‍යාකරණ කටපාඩම් කරවීමෙන් ඔබ්බට ගිය, අතිශය ප්‍රායෝගික මෙන්ම දරුවන්ට සමීප සරල (Easy English) ඉගැන්වීම් ක්‍රමවේදයන් සිය පන්තියේ වැඩපිළිවෙළට මුසු කර ඇති බැවිනි.
              </p>
              <p>
                පාසල් විභාග ජයග්‍රහණවලට පමණක් සීමා නොවී, දරුවන්ගේ අනාගත වෘත්තීය ජීවිතය සාර්ථක කරගැනීමට අවශ්‍ය ප්‍රායෝගික සන්නිවේදන හැකියාව ගොඩනැගීමේ ප්‍රමුඛතම නියමුවා වන්නේ ද ඔහුය. දිවයින පුරා දහස් ගණනක් වූ සිසු සිසුවියන් ඉංග්‍රීසි භාෂාවෙන් විශිෂ්ටයින් බවට පත් වන්නේ, නිවැරදි මඟපෙන්වීම, ඔහු සතු සහජ දේශන කුසලතාවය සහ කෙතරම් සංකීර්ණ භාෂා ගැටලුවක් වුවද ඕනෑම මට්ටමක සිටින දරුවෙකුගේ මනසට කා වැදෙන අයුරින් ඉතා සරලව පැහැදිලි කිරීමේ අපූර්ව හැකියාව හේතුවෙනි.
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
