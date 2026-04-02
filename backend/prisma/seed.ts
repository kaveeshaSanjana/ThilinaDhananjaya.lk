import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@thilinadhananjaya.lk' },
    update: {},
    create: {
      email: 'admin@thilinadhananjaya.lk',
      password: adminPassword,
      role: 'ADMIN',
      profile: {
        create: {
          instituteId: 'TD-ADMIN-0001',
          fullName: 'System Administrator',
          status: 'ACTIVE',
        },
      },
    },
  });
  console.log(`Admin user created: ${admin.email}`);

  // Create sample student
  const studentPassword = await bcrypt.hash('student123', 12);
  const student = await prisma.user.upsert({
    where: { email: 'student@test.com' },
    update: {},
    create: {
      email: 'student@test.com',
      password: studentPassword,
      role: 'STUDENT',
      profile: {
        create: {
          instituteId: `TD-${new Date().getFullYear()}-0001`,
          fullName: 'Test Student',
          phone: '0771234567',
          school: 'Royal College',
          status: 'ACTIVE',
        },
      },
    },
  });
  console.log(`Student user created: ${student.email}`);

  // Create a sample class
  const sampleClass = await prisma.class.upsert({
    where: { id: 'sample-class-1' },
    update: {},
    create: {
      id: 'sample-class-1',
      name: 'Combined Mathematics',
      description: 'A/L Combined Mathematics - 2026 batch',
    },
  });

  // Create sample month
  const sampleMonth = await prisma.month.upsert({
    where: { classId_year_month: { classId: sampleClass.id, year: 2026, month: 1 } },
    update: {},
    create: {
      classId: sampleClass.id,
      name: 'January 2026',
      year: 2026,
      month: 1,
    },
  });

  // Create sample recording
  await prisma.recording.upsert({
    where: { id: 'sample-recording-1' },
    update: {},
    create: {
      id: 'sample-recording-1',
      monthId: sampleMonth.id,
      title: 'Introduction to Limits',
      description: 'First lesson on limits and continuity',
      videoUrl: 'https://example.com/sample-video.mp4',
      status: 'ANYONE',
      order: 1,
    },
  });

  // Enroll student in class
  await prisma.enrollment.upsert({
    where: { userId_classId: { userId: student.id, classId: sampleClass.id } },
    update: {},
    create: {
      userId: student.id,
      classId: sampleClass.id,
    },
  });

  console.log('Sample class, month, recording, and enrollment created');
  console.log('\n--- Seed Complete ---');
  console.log('Admin login: admin@thilinadhananjaya.lk / admin123');
  console.log('Student login: student@test.com / student123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
