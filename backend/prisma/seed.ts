import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const db = prisma as any;

function ago(minutes: number): Date {
  return new Date(Date.now() - minutes * 60000);
}

function fromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60000);
}

async function main() {
  console.log('Clearing all existing data...');

  // Disable FK checks for clean truncation (MySQL)
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;
  await prisma.watchSession.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.classAttendance.deleteMany();
  await prisma.paymentSlip.deleteMany();
  await prisma.enrollment.deleteMany();
  await db.monthMedia.deleteMany();
  await db.lecture.deleteMany();
  await prisma.recording.deleteMany();
  await prisma.month.deleteMany();
  await prisma.class.deleteMany();
  await prisma.refreshToken.deleteMany();
  await db.adminInstitute.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await db.institute.deleteMany();
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
  console.log('All data cleared.');

  console.log('Seeding database...');

  // â”€â”€â”€ Institute â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const institute = await db.institute.create({
    data: {
      id: 'inst-td-001',
      name: 'Thilina Dhananjaya Academy',
      slug: 'thilina-dhananjaya',
      address: 'No. 45, Galle Road, Colombo 03',
      phone: '0112345678',
      description: 'Premier A/L Science & Mathematics Institute in Sri Lanka',
      themeColor: '#6d28d9',
    },
  });
  console.log(`Institute created: ${institute.name}`);

  // â”€â”€â”€ Admin user: admin@td.lk â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@td.lk',
      password: adminPassword,
      role: 'ADMIN',
      orgId: institute.id,
      profile: {
        create: {
          instituteId: 'TD-ADMIN-0001',
          fullName: 'Thilina Dhananjaya',
          phone: '0112345678',
          status: 'ACTIVE',
          gender: 'MALE',
        },
      },
    },
  });
  await db.adminInstitute.create({
    data: { adminId: admin.id, instituteId: institute.id, isOwner: true },
  });
  console.log(`Admin created: ${admin.email}`);

  // â”€â”€â”€ Primary student: student@td.lk â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const studentPassword = await bcrypt.hash('student123', 12);
  const primaryStudent = await prisma.user.create({
    data: {
      email: 'student@td.lk',
      password: studentPassword,
      role: 'STUDENT',
      orgId: institute.id,
      profile: {
        create: {
          instituteId: 'TD-2026-S001',
          fullName: 'Kavya Perera',
          phone: '0771122334',
          whatsappPhone: '0771122334',
          school: 'Vishaka Vidyalaya',
          address: 'No. 12, Temple Road, Nugegoda',
          gender: 'FEMALE',
          dateOfBirth: new Date('2007-03-15'),
          guardianName: 'Saman Perera',
          guardianPhone: '0779988776',
          relationship: 'Father',
          status: 'ACTIVE',
        },
      },
    },
  });
  console.log(`Primary student created: ${primaryStudent.email}`);

  // â”€â”€â”€ Additional students â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const extraStudentsData = [
    { email: 'kavindu@gmail.com',  iid: 'TD-2026-S002', name: 'Kavindu Perera',       phone: '0771234567', school: 'Royal College',      gender: 'MALE',   status: 'ACTIVE'   },
    { email: 'nethmi@gmail.com',   iid: 'TD-2026-S003', name: 'Nethmi Fernando',       phone: '0712345678', school: 'Visakha Vidyalaya',  gender: 'FEMALE', status: 'ACTIVE'   },
    { email: 'dilshan@gmail.com',  iid: 'TD-2026-S004', name: 'Dilshan Jayawardena',   phone: '0777654321', school: 'Ananda College',     gender: 'MALE',   status: 'ACTIVE'   },
    { email: 'sanduni@gmail.com',  iid: 'TD-2026-S005', name: 'Sanduni Rathnayake',    phone: '0723344556', school: 'Musaeus College',    gender: 'FEMALE', status: 'INACTIVE' },
    { email: 'hasitha@gmail.com',  iid: 'TD-2026-S006', name: 'Hasitha Bandara',       phone: '0789988776', school: 'Dharmaraja College', gender: 'MALE',   status: 'ACTIVE'   },
  ];

  const extraUsers: { id: string; email: string }[] = [];
  for (const s of extraStudentsData) {
    const u = await prisma.user.create({
      data: {
        email: s.email,
        password: studentPassword,
        role: 'STUDENT',
        orgId: institute.id,
        profile: {
          create: {
            instituteId: s.iid,
            fullName: s.name,
            phone: s.phone,
            school: s.school,
            gender: s.gender as any,
            status: s.status as any,
          },
        },
      },
    });
    extraUsers.push(u);
  }
  console.log(`Additional students created: ${extraUsers.length}`);

  // Convenience array: [primaryStudent, ...extraUsers]
  const allStudents: { id: string; email: string }[] = [primaryStudent, ...extraUsers];

  // â”€â”€â”€ Classes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const mathClass = await prisma.class.create({
    data: {
      id: 'class-math-2026',
      name: 'Combined Mathematics',
      subject: 'Combined Mathematics',
      description: 'A/L Combined Mathematics â€” 2026 batch. Covering Pure & Applied Maths.',
      monthlyFee: 3000,
      orgId: institute.id,
      status: 'STUDENTS_ONLY',
      vision: 'To help every student master mathematics with clarity and confidence.',
      mission: 'Structured lessons, live support, and personalized attention for A/L exam success.',
    },
  });

  const scienceClass = await prisma.class.create({
    data: {
      id: 'class-physics-2026',
      name: 'Physics',
      subject: 'Physics',
      description: 'A/L Physics â€” 2026 batch. Theory and practical problem solving.',
      monthlyFee: 2500,
      orgId: institute.id,
      status: 'STUDENTS_ONLY',
    },
  });
  console.log(`Classes created: ${mathClass.name}, ${scienceClass.name}`);

  // â”€â”€â”€ Months â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const janMonth = await prisma.month.create({
    data: { classId: mathClass.id, name: 'January 2026', year: 2026, month: 1, status: 'ANYONE' },
  });
  const febMonth = await prisma.month.create({
    data: { classId: mathClass.id, name: 'February 2026', year: 2026, month: 2, status: 'STUDENTS_ONLY' },
  });
  const marMonth = await prisma.month.create({
    data: { classId: mathClass.id, name: 'March 2026', year: 2026, month: 3, status: 'STUDENTS_ONLY' },
  });
  const aprMonth = await prisma.month.create({
    data: { classId: mathClass.id, name: 'April 2026', year: 2026, month: 4, status: 'STUDENTS_ONLY' },
  });

  // Physics months
  const physAprMonth = await prisma.month.create({
    data: { classId: scienceClass.id, name: 'April 2026', year: 2026, month: 4, status: 'STUDENTS_ONLY' },
  });
  console.log('Months created');

  // â”€â”€â”€ Recordings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // January
  const janRec1 = await prisma.recording.create({
    data: {
      id: 'rec-jan-01',
      monthId: janMonth.id,
      title: 'Lesson 01 â€” Algebra Revision',
      description: 'Revision of key algebraic identities and expressions',
      videoUrl: 'https://example.com/jan-01.mp4',
      videoType: 'DRIVE',
      duration: 3000,
      status: 'ANYONE',
      order: 1,
    },
  });
  const janRec2 = await prisma.recording.create({
    data: {
      id: 'rec-jan-02',
      monthId: janMonth.id,
      title: 'Lesson 02 â€” Polynomials',
      description: 'Factorisation, remainder theorem and factor theorem',
      videoUrl: 'https://example.com/jan-02.mp4',
      videoType: 'DRIVE',
      duration: 3300,
      status: 'STUDENTS_ONLY',
      order: 2,
    },
  });

  // February
  await prisma.recording.create({
    data: {
      id: 'rec-feb-01',
      monthId: febMonth.id,
      title: 'Lesson 01 â€” Functions & Graphs',
      description: 'Domain, range, composite and inverse functions',
      videoUrl: 'https://example.com/feb-01.mp4',
      videoType: 'DRIVE',
      duration: 3600,
      status: 'STUDENTS_ONLY',
      order: 1,
    },
  });
  await prisma.recording.create({
    data: {
      id: 'rec-feb-02',
      monthId: febMonth.id,
      title: 'Lesson 02 â€” Inequalities',
      description: 'Solving linear and quadratic inequalities',
      videoUrl: 'https://example.com/feb-02.mp4',
      videoType: 'DRIVE',
      duration: 3200,
      status: 'PAID_ONLY',
      order: 2,
    },
  });

  // March
  await prisma.recording.create({
    data: {
      id: 'rec-mar-01',
      monthId: marMonth.id,
      title: 'Lesson 01 â€” Sequences & Series',
      description: 'Arithmetic and geometric progressions, summation formulas',
      videoUrl: 'https://example.com/mar-01.mp4',
      videoType: 'DRIVE',
      duration: 4200,
      status: 'STUDENTS_ONLY',
      order: 1,
    },
  });

  // April
  const aprRec1 = await prisma.recording.create({
    data: {
      id: 'rec-apr-01',
      monthId: aprMonth.id,
      title: 'Lesson 01 â€” Introduction to Limits',
      description: 'Understanding limits, left/right-hand limits, continuity basics',
      videoUrl: 'https://example.com/apr-01.mp4',
      videoType: 'DRIVE',
      duration: 3600,
      status: 'ANYONE',
      order: 1,
      welcomeMessage: '<p>Welcome <span contenteditable="false" data-variable="{{studentName}}" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-semibold border bg-blue-100 text-blue-700 border-blue-200" style="user-select:all;cursor:default">ðŸ‘¤ Student Name</span>! This is your first lesson for <span contenteditable="false" data-variable="{{month}}" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-semibold border bg-purple-100 text-purple-700 border-purple-200" style="user-select:all;cursor:default">ðŸ“… Month</span>. Enjoy! ðŸŽ¯</p>',
    },
  });
  const aprRec2 = await prisma.recording.create({
    data: {
      id: 'rec-apr-02',
      monthId: aprMonth.id,
      title: 'Lesson 02 â€” Differentiation Basics',
      description: 'First principles, power rule, product & quotient rule',
      videoUrl: 'https://example.com/apr-02.mp4',
      videoType: 'DRIVE',
      duration: 4500,
      status: 'STUDENTS_ONLY',
      order: 2,
    },
  });
  const aprRec3 = await prisma.recording.create({
    data: {
      id: 'rec-apr-03',
      monthId: aprMonth.id,
      title: 'Lesson 03 â€” Quadratic Equations',
      description: 'Solving quadratic equations, graphing parabolas, discriminant analysis',
      videoUrl: 'https://example.com/apr-03.mp4',
      videoType: 'DRIVE',
      duration: 3600,
      status: 'PAID_ONLY',
      order: 3,
      topic: 'Quadratic Equations',
      welcomeMessage: '<p>Hey <span contenteditable="false" data-variable="{{studentName}}" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-semibold border bg-blue-100 text-blue-700 border-blue-200" style="user-select:all;cursor:default">ðŸ‘¤ Student Name</span>! Today\'s lesson on <strong>Quadratic Equations</strong> is really important for your exam. Good luck! ðŸ“</p>',
    },
  });

  // Physics April
  const physRec1 = await prisma.recording.create({
    data: {
      id: 'rec-phys-apr-01',
      monthId: physAprMonth.id,
      title: 'Lesson 01 â€” Newton\'s Laws of Motion',
      description: 'Exploring all three laws with derivations and real-world experiments',
      videoUrl: 'https://example.com/phys-apr-01.mp4',
      videoType: 'DRIVE',
      duration: 4200,
      status: 'STUDENTS_ONLY',
      order: 1,
    },
  });
  console.log('Recordings created');

  // â”€â”€â”€ Month Media â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await db.monthMedia.create({
    data: {
      monthId: aprMonth.id,
      title: 'April Formula Sheet',
      description: 'Comprehensive formula reference for April topics',
      fileUrl: 'https://example.com/media/apr-formula-sheet.pdf',
      mediaType: 'PDF',
      order: 1,
      status: 'STUDENTS_ONLY',
    },
  });
  await db.monthMedia.create({
    data: {
      monthId: aprMonth.id,
      title: 'Practice Problem Set â€” April',
      description: '50 practice questions covering Limits, Differentiation and Quadratics',
      fileUrl: 'https://example.com/media/apr-problems.pdf',
      mediaType: 'PDF',
      order: 2,
      status: 'PAID_ONLY',
    },
  });
  await db.monthMedia.create({
    data: {
      monthId: janMonth.id,
      title: 'Algebra Cheat Sheet',
      description: 'Key identities and formulas for Algebra revision',
      fileUrl: 'https://example.com/media/jan-algebra.pdf',
      mediaType: 'PDF',
      order: 1,
      status: 'ANYONE',
    },
  });
  console.log('Month media created');

  // â”€â”€â”€ Lectures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1) Currently LIVE
  await db.lecture.create({
    data: {
      id: 'lec-live-now',
      monthId: aprMonth.id,
      title: 'Differentiation â€” Live Q&A Session',
      description: 'Live doubt-clearing session for Chapter 4. All students welcome.',
      mode: 'ONLINE',
      platform: 'Zoom',
      startTime: ago(30),
      endTime: fromNow(30),
      sessionLink: 'https://zoom.us/j/12345678901',
      meetingId: '123 456 7890',
      meetingPassword: 'maths2026',
      maxParticipants: 150,
      status: 'STUDENTS_ONLY',
      welcomeMessage: '<p>ðŸŽ‰ Welcome, <span contenteditable="false" data-variable="{{studentName}}" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-semibold border bg-blue-100 text-blue-700 border-blue-200" style="user-select:all;cursor:default">ðŸ‘¤ Student Name</span>! This session is happening <strong>right now</strong>. Join quickly! ðŸš€</p>',
    },
  });

  // 2) Upcoming
  await db.lecture.create({
    data: {
      id: 'lec-upcoming-1',
      monthId: aprMonth.id,
      title: 'Integration â€” Definite Integrals',
      description: 'Chapter 5 coverage: area under curves, definite integrals and applications.',
      mode: 'ONLINE',
      platform: 'Google Meet',
      startTime: fromNow(60 * 20),
      endTime: fromNow(60 * 22),
      sessionLink: 'https://meet.google.com/abc-defg-hij',
      maxParticipants: 200,
      status: 'STUDENTS_ONLY',
    },
  });

  // 3) Upcoming offline
  await db.lecture.create({
    data: {
      id: 'lec-upcoming-2',
      monthId: aprMonth.id,
      title: 'Mock Exam â€” Paper I',
      description: 'Full 3-hour mock paper under exam conditions.',
      mode: 'OFFLINE',
      startTime: fromNow(60 * 48),
      endTime: fromNow(60 * 51),
      maxParticipants: 80,
      status: 'PAID_ONLY',
    },
  });

  // 4) Past lecture
  await db.lecture.create({
    data: {
      id: 'lec-past-1',
      monthId: aprMonth.id,
      title: 'Binomial Theorem & Permutations',
      description: 'Completed session on binomial expansion and combinatorics.',
      mode: 'ONLINE',
      platform: 'Zoom',
      startTime: ago(60 * 3 * 24),
      endTime: ago(60 * 3 * 24 - 120),
      sessionLink: 'https://zoom.us/j/99887766',
      meetingId: '998 877 6655',
      meetingPassword: 'binom26',
      status: 'STUDENTS_ONLY',
    },
  });

  // 5) Past offline
  await db.lecture.create({
    data: {
      id: 'lec-past-2',
      monthId: janMonth.id,
      title: 'Vectors & 3D Geometry â€” Introduction',
      description: 'First lecture on 3D vectors, dot product, cross product.',
      mode: 'OFFLINE',
      startTime: ago(60 * 7 * 24),
      endTime: ago(60 * 7 * 24 - 180),
      maxParticipants: 100,
      status: 'ANYONE',
    },
  });

  // 6) Physics â€” upcoming
  await db.lecture.create({
    data: {
      id: 'lec-physics-1',
      monthId: physAprMonth.id,
      title: 'Circular Motion & Centripetal Force',
      description: 'Live derivation and problem solving for circular motion.',
      mode: 'ONLINE',
      platform: 'Zoom',
      startTime: fromNow(60 * 3),
      endTime: fromNow(60 * 5),
      sessionLink: 'https://zoom.us/j/55544433322',
      meetingId: '555 444 3332',
      meetingPassword: 'phys2026',
      maxParticipants: 100,
      status: 'STUDENTS_ONLY',
    },
  });
  console.log('Lectures created');

  // â”€â”€â”€ Enrollments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // All 6 students enrolled in Math class; first 3 also in Physics
  for (const student of allStudents) {
    await prisma.enrollment.create({
      data: { userId: student.id, classId: mathClass.id },
    });
  }
  for (let i = 0; i < 3; i++) {
    await prisma.enrollment.create({
      data: { userId: allStudents[i].id, classId: scienceClass.id },
    });
  }
  console.log('Enrollments created');

  // â”€â”€â”€ Payment Slips â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // April payments: primaryStudent=VERIFIED, kavindu=VERIFIED, nethmi=PENDING, dilshan=REJECTED, sanduni=none, hasitha=PENDING
  const aprPayments: { student: { id: string; email: string }; status: 'VERIFIED' | 'PENDING' | 'REJECTED'; paidDate?: Date }[] = [
    { student: allStudents[0], status: 'VERIFIED', paidDate: ago(60 * 24 * 5) },  // student@td.lk
    { student: allStudents[1], status: 'VERIFIED', paidDate: ago(60 * 24 * 4) },  // kavindu
    { student: allStudents[2], status: 'PENDING' },                                // nethmi
    { student: allStudents[3], status: 'REJECTED' },                               // dilshan
    { student: allStudents[5], status: 'PENDING' },                                // hasitha
  ];
  for (const p of aprPayments) {
    await prisma.paymentSlip.create({
      data: {
        userId: p.student.id,
        monthId: aprMonth.id,
        type: 'MONTHLY',
        slipUrl: 'https://example.com/mock-slip.jpg',
        amount: 3000,
        status: p.status,
        paidDate: p.paidDate ?? null,
        paymentMethod: 'ONLINE',
        paymentPortion: 'FULL',
        ...(p.status === 'REJECTED' ? { rejectReason: 'Slip image unclear, please re-upload.' } : {}),
      },
    });
  }

  // Admission payment for student@td.lk
  await prisma.paymentSlip.create({
    data: {
      userId: allStudents[0].id,
      monthId: janMonth.id,
      type: 'ADMISSION',
      slipUrl: 'https://example.com/mock-admission-slip.jpg',
      amount: 1500,
      status: 'VERIFIED',
      paidDate: ago(60 * 24 * 90),
      paymentMethod: 'PHYSICAL',
      paymentPortion: 'FULL',
    },
  });
  console.log('Payment slips created');

  // â”€â”€â”€ Attendance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const recId = aprRec3.id;

  // student@td.lk â€” COMPLETED
  await prisma.attendance.create({
    data: {
      userId: allStudents[0].id,
      recordingId: recId,
      status: 'COMPLETED',
      watchedSec: 3450,
      details: [
        { type: 'START', videoPosition: 0, at: ago(300).toISOString() },
        { type: 'PUSH', watchedSec: 3450, at: ago(60).toISOString() },
        { type: 'END', videoPosition: 3450, watchedSec: 3450, at: ago(58).toISOString() },
      ],
    },
  });

  // kavindu â€” COMPLETED
  await prisma.attendance.create({
    data: {
      userId: allStudents[1].id,
      recordingId: recId,
      status: 'COMPLETED',
      watchedSec: 3600,
      details: [
        { type: 'START', videoPosition: 0, at: ago(250).toISOString() },
        { type: 'PUSH', watchedSec: 3600, at: ago(210).toISOString() },
        { type: 'END', videoPosition: 3600, watchedSec: 3600, at: ago(208).toISOString() },
      ],
    },
  });

  // nethmi â€” INCOMPLETE
  await prisma.attendance.create({
    data: {
      userId: allStudents[2].id,
      recordingId: recId,
      status: 'INCOMPLETE',
      watchedSec: 600,
      details: [
        { type: 'START', videoPosition: 0, at: ago(500).toISOString() },
        { type: 'INCOMPLETE_EXIT', watchedSec: 600, at: ago(490).toISOString() },
      ],
    },
  });

  // dilshan â€” INCOMPLETE (suspicious seeker)
  await prisma.attendance.create({
    data: {
      userId: allStudents[3].id,
      recordingId: recId,
      status: 'INCOMPLETE',
      watchedSec: 120,
      details: [
        { type: 'START', videoPosition: 0, at: ago(700).toISOString() },
        { type: 'INCOMPLETE_EXIT', watchedSec: 120, at: ago(699).toISOString() },
      ],
    },
  });

  // sanduni â€” MANUAL
  await prisma.attendance.create({
    data: {
      userId: allStudents[4].id,
      recordingId: recId,
      status: 'MANUAL',
      watchedSec: 0,
      eventName: 'Manual â€” 2026-04-05',
      details: [{ type: 'MANUAL', eventName: 'Manual â€” 2026-04-05', at: ago(1440).toISOString() }],
    },
  });

  // Also add attendance for jan/feb recordings for student@td.lk
  await prisma.attendance.create({
    data: {
      userId: allStudents[0].id,
      recordingId: janRec1.id,
      status: 'COMPLETED',
      watchedSec: 2900,
      details: [
        { type: 'START', videoPosition: 0, at: ago(60 * 24 * 90).toISOString() },
        { type: 'END', videoPosition: 2900, watchedSec: 2900, at: ago(60 * 24 * 89).toISOString() },
      ],
    },
  });
  await prisma.attendance.create({
    data: {
      userId: allStudents[0].id,
      recordingId: janRec2.id,
      status: 'COMPLETED',
      watchedSec: 3300,
      details: [
        { type: 'START', videoPosition: 0, at: ago(60 * 24 * 85).toISOString() },
        { type: 'END', videoPosition: 3300, watchedSec: 3300, at: ago(60 * 24 * 84).toISOString() },
      ],
    },
  });
  await prisma.attendance.create({
    data: {
      userId: allStudents[0].id,
      recordingId: aprRec1.id,
      status: 'COMPLETED',
      watchedSec: 3600,
      details: [
        { type: 'START', videoPosition: 0, at: ago(60 * 24 * 3).toISOString() },
        { type: 'END', videoPosition: 3600, watchedSec: 3600, at: ago(60 * 24 * 2).toISOString() },
      ],
    },
  });
  await prisma.attendance.create({
    data: {
      userId: allStudents[0].id,
      recordingId: aprRec2.id,
      status: 'INCOMPLETE',
      watchedSec: 1200,
      details: [
        { type: 'START', videoPosition: 0, at: ago(60 * 2).toISOString() },
        { type: 'INCOMPLETE_EXIT', watchedSec: 1200, at: ago(60 * 1).toISOString() },
      ],
    },
  });
  console.log('Attendance records created');

  // â”€â”€â”€ Watch Sessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // student@td.lk â€” 2 sessions on aprRec3
  await prisma.watchSession.create({
    data: {
      userId: allStudents[0].id,
      recordingId: recId,
      startedAt: ago(310),
      endedAt: ago(250),
      videoStartPos: 0,
      videoEndPos: 1800,
      totalWatchedSec: 1800,
      status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(310).toISOString() },
        { type: 'pause', videoTime: 600, wallTime: ago(300).toISOString() },
        { type: 'play', videoTime: 600, wallTime: ago(298).toISOString() },
        { type: 'pause', videoTime: 1800, wallTime: ago(280).toISOString() },
      ],
    },
  });
  await prisma.watchSession.create({
    data: {
      userId: allStudents[0].id,
      recordingId: recId,
      startedAt: ago(120),
      endedAt: ago(58),
      videoStartPos: 1800,
      videoEndPos: 3450,
      totalWatchedSec: 1650,
      status: 'ENDED',
      events: [
        { type: 'play', videoTime: 1800, wallTime: ago(120).toISOString() },
        { type: 'buffer', videoTime: 2200, wallTime: ago(110).toISOString() },
        { type: 'play', videoTime: 2200, wallTime: ago(110).toISOString() },
        { type: 'ended', videoTime: 3600, wallTime: ago(60).toISOString() },
      ],
    },
  });

  // kavindu â€” 1 session on aprRec3
  await prisma.watchSession.create({
    data: {
      userId: allStudents[1].id,
      recordingId: recId,
      startedAt: ago(280),
      endedAt: ago(208),
      videoStartPos: 0,
      videoEndPos: 3600,
      totalWatchedSec: 3600,
      status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(280).toISOString() },
        { type: 'pause', videoTime: 1500, wallTime: ago(255).toISOString() },
        { type: 'play', videoTime: 1500, wallTime: ago(253).toISOString() },
        { type: 'ended', videoTime: 3600, wallTime: ago(210).toISOString() },
      ],
    },
  });

  // nethmi â€” 1 partial session on aprRec3
  await prisma.watchSession.create({
    data: {
      userId: allStudents[2].id,
      recordingId: recId,
      startedAt: ago(505),
      endedAt: ago(490),
      videoStartPos: 0,
      videoEndPos: 540,
      totalWatchedSec: 600,
      status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(505).toISOString() },
        { type: 'pause', videoTime: 600, wallTime: ago(495).toISOString() },
      ],
    },
  });

  // student@td.lk â€” 1 session on jan rec1
  await prisma.watchSession.create({
    data: {
      userId: allStudents[0].id,
      recordingId: janRec1.id,
      startedAt: ago(60 * 24 * 90),
      endedAt: ago(60 * 24 * 89),
      videoStartPos: 0,
      videoEndPos: 2900,
      totalWatchedSec: 2900,
      status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(60 * 24 * 90).toISOString() },
        { type: 'ended', videoTime: 2900, wallTime: ago(60 * 24 * 89).toISOString() },
      ],
    },
  });

  // student@td.lk â€” 1 session on aprRec1
  await prisma.watchSession.create({
    data: {
      userId: allStudents[0].id,
      recordingId: aprRec1.id,
      startedAt: ago(60 * 24 * 3),
      endedAt: ago(60 * 24 * 2),
      videoStartPos: 0,
      videoEndPos: 3600,
      totalWatchedSec: 3600,
      status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(60 * 24 * 3).toISOString() },
        { type: 'ended', videoTime: 3600, wallTime: ago(60 * 24 * 2).toISOString() },
      ],
    },
  });

  // student@td.lk â€” currently watching aprRec2
  await prisma.watchSession.create({
    data: {
      userId: allStudents[0].id,
      recordingId: aprRec2.id,
      startedAt: ago(62),
      endedAt: ago(60),
      videoStartPos: 0,
      videoEndPos: 1200,
      totalWatchedSec: 1200,
      status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(62).toISOString() },
        { type: 'pause', videoTime: 1200, wallTime: ago(60).toISOString() },
      ],
    },
  });
  console.log('Watch sessions created');

  // â”€â”€â”€ Class Attendances (physical) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const classDates = [
    new Date('2026-04-01'),
    new Date('2026-04-05'),
    new Date('2026-04-08'),
  ];
  for (const date of classDates) {
    await prisma.classAttendance.create({
      data: {
        userId: allStudents[0].id,
        classId: mathClass.id,
        date,
        status: 'PRESENT',
        method: 'barcode',
        markedBy: admin.id,
      },
    });
  }
  // kavindu â€” 2 present, 1 late
  await prisma.classAttendance.create({
    data: { userId: allStudents[1].id, classId: mathClass.id, date: new Date('2026-04-01'), status: 'PRESENT', method: 'barcode' },
  });
  await prisma.classAttendance.create({
    data: { userId: allStudents[1].id, classId: mathClass.id, date: new Date('2026-04-05'), status: 'LATE', method: 'manual', note: 'Arrived 15 min late' },
  });
  await prisma.classAttendance.create({
    data: { userId: allStudents[1].id, classId: mathClass.id, date: new Date('2026-04-08'), status: 'ABSENT' },
  });
  // nethmi â€” absent from one
  await prisma.classAttendance.create({
    data: { userId: allStudents[2].id, classId: mathClass.id, date: new Date('2026-04-01'), status: 'PRESENT', method: 'barcode' },
  });
  await prisma.classAttendance.create({
    data: { userId: allStudents[2].id, classId: mathClass.id, date: new Date('2026-04-05'), status: 'ABSENT' },
  });
  console.log('Class attendances created');

  console.log('\n--- Seed Complete ---');
  console.log('Institute: Thilina Dhananjaya Academy');
  console.log('Admin login:   admin@td.lk   / admin123');
  console.log('Student login: student@td.lk / student123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

