import { motion } from "framer-motion";
import { BookOpen, FileText, Mic } from "lucide-react";

const courseTypes = [
  {
    icon: BookOpen,
    titleEn: "Theory Class",
    titleSi: "සිද්ධාන්ත පන්තිය",
    featuresEn: [
      "Structured grammar concepts",
      "In-depth explanation of English rules",
      "Comprehensive theory coverage",
    ],
    featuresSi: [
      "ව්‍යුහගත ව්‍යාකරණ සංකල්පයන්",
      "ඉංග්‍රීසි නියම පිළිබඳ ගැඹුරු පැහැදිලි කිරීම",
      "සම්පූර්ණ සිද්ධාන්ත ආවරණය",
    ],
    color: "bg-primary/10 text-primary",
    borderColor: "border-primary/25",
  },
  {
    icon: Mic,
    titleEn: "Practice Class & Spoken English",
    titleSi: "පුහුණු පන්තිය සහ කතා කරන ඉංග්‍රීසි",
    featuresEn: [
      "Interactive conversation exercises",
      "Real-time pronunciation feedback",
      "Fluency building through practice",
      "Class recordings provided",
    ],
    featuresSi: [
      "ආකර්ශනීය සංවාද ව්‍යායාම",
      "උච්චාරණ වැරදි එවලේම නිවැරදි කිරීම",
      "පුහුණුවලින් ම කතිකත්වය ගොඩනැගීම",
      "පන්ති පටිගත කිරීම් සපයන ලැබේ",
    ],
    color: "bg-accent/10 text-accent",
    borderColor: "border-accent/25",
  },
  {
    icon: FileText,
    titleEn: "Paper Class",
    titleSi: "පත්‍ර පන්තිය",
    featuresEn: [
      "Exam paper solving strategies",
      "Question analysis and techniques",
      "Comprehensive paper guidance",
      "Dictation and structured exercises",
    ],
    featuresSi: [
      "පේපර් සදහා සුවිශේශී උපක්‍රමයන්",
      "ප්‍රශ්න විශ්ලේෂණ සහ ශිල්පක්‍රම",
      "සම්පූර්ණ පත්‍ර මාර්ගෝපදේශ",
      "ලිපිලිවීම සහ ව්‍යුහගත ව්‍යායාම",
    ],
    color: "bg-secondary text-secondary-foreground",
    borderColor: "border-border",
  },
];

const CourseTypesSection = () => (
  <section id="classes" className="relative py-20 md:py-32 bg-white scroll-mt-24">
    <div className="container mx-auto px-4 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, margin: "-50px" }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground leading-tight mb-2">
          Our Class Types
        </h2>
        <p className="text-primary text-lg md:text-xl font-semibold mb-4">අපගේ පන්ති වර්ගයන්</p>
        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
          Comprehensive learning through multiple class formats
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {courseTypes.map((course, index) => {
          const Icon = course.icon;
          return (
            <motion.div
              key={course.titleEn}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.6, delay: 0.15 * index }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="h-full"
            >
              <div
                className={`relative p-7 md:p-8 rounded-2xl border-2 ${course.borderColor} ${course.color} h-full flex flex-col transition-all duration-300 hover:shadow-lg`}
              >
                <div className="mb-5">
                  <Icon className="w-10 h-10" />
                </div>

                <h3 className="text-xl md:text-2xl font-bold mb-1 text-foreground">{course.titleEn}</h3>
                <h3 className="text-lg md:text-xl font-semibold mb-4 text-primary/80">{course.titleSi}</h3>

                <ul className="space-y-4 flex-grow">
                  {course.featuresEn.map((featureEn, i) => (
                    <li key={i} className="flex flex-col gap-1">
                      <div className="flex items-start gap-3 text-sm md:text-base text-foreground/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-current mt-2 flex-shrink-0" />
                        <span>{featureEn}</span>
                      </div>
                      <div className="flex items-start gap-3 text-xs md:text-sm text-foreground/60 ml-4">
                        <span className="w-1 h-1 rounded-full bg-current/50 mt-1.5 flex-shrink-0" />
                        <span>{course.featuresSi[i]}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

export default CourseTypesSection;

