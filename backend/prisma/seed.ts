import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function ago(minutes: number): Date {
  return new Date(Date.now() - minutes * 60000);
}

async function main() {
  console.log('Seeding database...');

  // ─── Admin ─────────────────────────────────────────────
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

  // ─── Cleanup old test student that may conflict ────────
  const oldStudent = await prisma.user.findUnique({ where: { email: 'student@test.com' } });
  if (oldStudent) {
    await prisma.user.delete({ where: { id: oldStudent.id } });
    console.log('Removed old student@test.com');
  }

  // ─── Sample Class ──────────────────────────────────────
  const sampleClass = await prisma.class.upsert({
    where: { id: 'sample-class-1' },
    update: {},
    create: {
      id: 'sample-class-1',
      name: 'Combined Mathematics',
      description: 'A/L Combined Mathematics - 2026 batch',
    },
  });

  // ─── January month (original) ─────────────────────────
  await prisma.month.upsert({
    where: { classId_year_month: { classId: sampleClass.id, year: 2026, month: 1 } },
    update: {},
    create: {
      classId: sampleClass.id,
      name: 'January 2026',
      year: 2026,
      month: 1,
    },
  });

  // ─── April month (for mock data) ──────────────────────
  const aprilMonth = await prisma.month.upsert({
    where: { classId_year_month: { classId: sampleClass.id, year: 2026, month: 4 } },
    update: {},
    create: {
      classId: sampleClass.id,
      name: 'April 2026',
      year: 2026,
      month: 4,
      status: 'ANYONE',
    },
  });

  // ─── Sample recordings ─────────────────────────────────
  await prisma.recording.upsert({
    where: { id: 'sample-recording-1' },
    update: {},
    create: {
      id: 'sample-recording-1',
      monthId: aprilMonth.id,
      title: 'Introduction to Limits',
      description: 'First lesson on limits and continuity',
      videoUrl: 'https://example.com/sample-video.mp4',
      duration: 3600,
      status: 'ANYONE',
      order: 1,
    },
  });

  const mockRecording = await prisma.recording.upsert({
    where: { id: 'mock-recording-1' },
    update: {},
    create: {
      id: 'mock-recording-1',
      monthId: aprilMonth.id,
      title: 'Lesson 03 — Quadratic Equations',
      description: 'Solving quadratic equations and graphing parabolas',
      videoUrl: 'https://example.com/quadratic.mp4',
      videoType: 'DRIVE',
      duration: 3600,
      status: 'ANYONE',
      order: 2,
    },
  });

  // ─── 10 Mock Students ─────────────────────────────────
  const studentPassword = await bcrypt.hash('student123', 12);
  const studentsData = [
    { email: 'kavindu@gmail.com',  iid: 'TD-2026-0001', name: 'Kavindu Perera',           phone: '0771234567', school: 'Royal College' },
    { email: 'nethmi@gmail.com',   iid: 'TD-2026-0002', name: 'Nethmi Fernando',           phone: '0712345678', school: 'Visakha Vidyalaya' },
    { email: 'tharushi@gmail.com', iid: 'TD-2026-0003', name: 'Tharushi Silva',            phone: '0761122334', school: 'Devi Balika' },
    { email: 'dilshan@gmail.com',  iid: 'TD-2026-0004', name: 'Dilshan Jayawardena',       phone: '0777654321', school: 'Ananda College' },
    { email: 'sanduni@gmail.com',  iid: 'TD-2026-0005', name: 'Sanduni Rathnayake',        phone: '0723344556', school: 'Musaeus College' },
    { email: 'hasitha@gmail.com',  iid: 'TD-2026-0006', name: 'Hasitha Bandara',           phone: '0789988776', school: 'Dharmaraja College' },
    { email: 'nimesh@gmail.com',   iid: 'TD-2026-0007', name: 'Nimesh Wickramasinghe',     phone: '0754433221', school: 'Nalanda College' },
    { email: 'ishara@gmail.com',   iid: 'TD-2026-0008', name: 'Ishara De Silva',           phone: '0764455667', school: 'S. Thomas College' },
    { email: 'malini@gmail.com',   iid: 'TD-2026-0009', name: 'Malini Gunasekara',         phone: '0711223344', school: 'Ladies College' },
    { email: 'chaminda@gmail.com', iid: 'TD-2026-0010', name: 'Chaminda Vaas',             phone: '0755566778', school: 'Richmond College' },
  ];

  const users: { id: string; email: string }[] = [];
  // Clean up any existing mock students and profiles to avoid unique constraint conflicts
  const mockEmails = studentsData.map(s => s.email);
  const mockIids = studentsData.map(s => s.iid);
  // Delete profiles by instituteId first (in case they belong to different users)
  const conflictingProfiles = await prisma.profile.findMany({ where: { instituteId: { in: mockIids } } });
  if (conflictingProfiles.length > 0) {
    const conflictingUserIds = conflictingProfiles.map(p => p.userId);
    await prisma.user.deleteMany({ where: { id: { in: conflictingUserIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { in: mockEmails } } });

  for (const s of studentsData) {
    const u = await prisma.user.create({
      data: {
        email: s.email,
        password: studentPassword,
        role: 'STUDENT',
        profile: {
          create: {
            instituteId: s.iid,
            fullName: s.name,
            phone: s.phone,
            school: s.school,
            status: 'ACTIVE',
          },
        },
      },
    });
    users.push(u);
  }
  console.log(`Created ${users.length} mock students`);

  const recId = mockRecording.id;

  // Enroll students 1-9 (student 10 = not enrolled)
  for (let i = 0; i < 9; i++) {
    await prisma.enrollment.upsert({
      where: { userId_classId: { userId: users[i].id, classId: sampleClass.id } },
      update: {},
      create: { userId: users[i].id, classId: sampleClass.id },
    });
  }
  console.log('Enrollments created (9 of 10)');

  // ─── Payment Slips ────────────────────────────────────
  // Students: 1=VERIFIED, 2=PENDING, 3=REJECTED, 6=VERIFIED, 8=VERIFIED, 9=PENDING
  // Students 4,5,7,10 = no payment slip
  const paymentEntries: { userId: string; status: 'VERIFIED' | 'PENDING' | 'REJECTED' }[] = [
    { userId: users[0].id, status: 'VERIFIED' },
    { userId: users[1].id, status: 'PENDING' },
    { userId: users[2].id, status: 'REJECTED' },
    { userId: users[5].id, status: 'VERIFIED' },
    { userId: users[7].id, status: 'VERIFIED' },
    { userId: users[8].id, status: 'PENDING' },
  ];
  for (const p of paymentEntries) {
    const existing = await prisma.paymentSlip.findFirst({
      where: { userId: p.userId, monthId: aprilMonth.id },
    });
    if (!existing) {
      await prisma.paymentSlip.create({
        data: {
          userId: p.userId,
          monthId: aprilMonth.id,
          type: 'MONTHLY',
          slipUrl: 'https://example.com/mock-slip.jpg',
          amount: 3000,
          status: p.status,
          paidDate: p.status === 'VERIFIED' ? ago(1440) : null,
        },
      });
    }
  }
  console.log('Payment slips created');

  // ─── Attendance Records ────────────────────────────────

  // Helper: upsert attendance
  async function upsertAttendance(userId: string, data: any) {
    await prisma.attendance.upsert({
      where: { userId_recordingId: { userId, recordingId: recId } },
      update: data,
      create: { userId, recordingId: recId, ...data },
    });
  }

  // 1) Kavindu — COMPLETED
  await upsertAttendance(users[0].id, {
    status: 'COMPLETED',
    watchedSec: 3200,
    details: [
      { type: 'START', videoPosition: 0, at: ago(180).toISOString() },
      { type: 'INCOMPLETE_EXIT', watchedSec: 900, at: ago(160).toISOString() },
      { type: 'START', videoPosition: 0, at: ago(120).toISOString() },
      { type: 'PUSH', watchedSec: 3200, at: ago(30).toISOString() },
      { type: 'END', videoPosition: 3200, watchedSec: 3200, at: ago(28).toISOString() },
    ],
  });

  // 2) Nethmi — COMPLETED
  await upsertAttendance(users[1].id, {
    status: 'COMPLETED',
    watchedSec: 3600,
    details: [
      { type: 'START', videoPosition: 0, at: ago(240).toISOString() },
      { type: 'PUSH', watchedSec: 3600, at: ago(200).toISOString() },
      { type: 'END', videoPosition: 3600, watchedSec: 3600, at: ago(198).toISOString() },
    ],
  });

  // 3) Tharushi — INCOMPLETE
  await upsertAttendance(users[2].id, {
    status: 'INCOMPLETE',
    watchedSec: 450,
    details: [
      { type: 'START', videoPosition: 0, at: ago(500).toISOString() },
      { type: 'INCOMPLETE_EXIT', watchedSec: 450, at: ago(490).toISOString() },
    ],
  });

  // 4) Dilshan — INCOMPLETE
  await upsertAttendance(users[3].id, {
    status: 'INCOMPLETE',
    watchedSec: 120,
    details: [
      { type: 'START', videoPosition: 0, at: ago(700).toISOString() },
      { type: 'INCOMPLETE_EXIT', watchedSec: 120, at: ago(695).toISOString() },
    ],
  });

  // 5) Sanduni — MANUAL
  await upsertAttendance(users[4].id, {
    status: 'MANUAL',
    watchedSec: 0,
    eventName: 'Manual - 2026-04-05',
    details: [
      { type: 'MANUAL', eventName: 'Manual - 2026-04-05', at: ago(1440).toISOString() },
    ],
  });

  // 6) Hasitha — COMPLETED + live join
  await upsertAttendance(users[5].id, {
    status: 'COMPLETED',
    watchedSec: 2800,
    liveJoinedAt: ago(350),
    details: [
      { type: 'LIVE_JOIN', at: ago(350).toISOString() },
      { type: 'START', videoPosition: 0, at: ago(320).toISOString() },
      { type: 'PUSH', watchedSec: 2800, at: ago(310).toISOString() },
      { type: 'END', videoPosition: 2800, watchedSec: 2800, at: ago(308).toISOString() },
    ],
  });

  // 7) Nimesh — NO attendance record (never watched)
  // skip

  // 8) Ishara — INCOMPLETE (suspicious seeker)
  await upsertAttendance(users[7].id, {
    status: 'INCOMPLETE',
    watchedSec: 800,
    details: [
      { type: 'START', videoPosition: 0, at: ago(600).toISOString() },
      { type: 'INCOMPLETE_EXIT', watchedSec: 800, at: ago(585).toISOString() },
    ],
  });

  // 9) Malini — INCOMPLETE (currently watching)
  await upsertAttendance(users[8].id, {
    status: 'INCOMPLETE',
    watchedSec: 600,
    details: [
      { type: 'START', videoPosition: 0, at: ago(15).toISOString() },
    ],
  });

  // 10) Chaminda — COMPLETED (not enrolled)
  await upsertAttendance(users[9].id, {
    status: 'COMPLETED',
    watchedSec: 3600,
    details: [
      { type: 'START', videoPosition: 0, at: ago(120).toISOString() },
      { type: 'PUSH', watchedSec: 3600, at: ago(60).toISOString() },
      { type: 'END', videoPosition: 3600, watchedSec: 3600, at: ago(58).toISOString() },
    ],
  });

  console.log('Attendance records created');

  // ─── Watch Sessions ────────────────────────────────────

  // Delete existing mock sessions first to avoid duplicates on re-seed
  await prisma.watchSession.deleteMany({ where: { recordingId: recId } });

  const sessionsToCreate: any[] = [];

  // 1) Kavindu — 3 sessions
  sessionsToCreate.push(
    {
      userId: users[0].id, recordingId: recId,
      startedAt: ago(200), endedAt: ago(160), videoStartPos: 0, videoEndPos: 810, totalWatchedSec: 900, status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(200).toISOString() },
        { type: 'pause', videoTime: 300, wallTime: ago(195).toISOString() },
        { type: 'play', videoTime: 300, wallTime: ago(194).toISOString() },
        { type: 'seek', videoTime: 800, wallTime: ago(188).toISOString() },
        { type: 'pause', videoTime: 900, wallTime: ago(180).toISOString() },
      ],
    },
    {
      userId: users[0].id, recordingId: recId,
      startedAt: ago(155), endedAt: ago(85), videoStartPos: 0, videoEndPos: 1800, totalWatchedSec: 2000, status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(155).toISOString() },
        { type: 'buffer', videoTime: 500, wallTime: ago(147).toISOString() },
        { type: 'play', videoTime: 500, wallTime: ago(147).toISOString() },
        { type: 'pause', videoTime: 1200, wallTime: ago(135).toISOString() },
        { type: 'play', videoTime: 1200, wallTime: ago(133).toISOString() },
        { type: 'pause', videoTime: 2000, wallTime: ago(120).toISOString() },
      ],
    },
    {
      userId: users[0].id, recordingId: recId,
      startedAt: ago(92), endedAt: ago(28), videoStartPos: 2000, videoEndPos: 3200, totalWatchedSec: 1200, status: 'ENDED',
      events: [
        { type: 'play', videoTime: 2000, wallTime: ago(92).toISOString() },
        { type: 'pause', videoTime: 2600, wallTime: ago(82).toISOString() },
        { type: 'play', videoTime: 2600, wallTime: ago(80).toISOString() },
        { type: 'ended', videoTime: 3200, wallTime: ago(60).toISOString() },
      ],
    },
  );

  // 2) Nethmi — 1 session
  sessionsToCreate.push({
    userId: users[1].id, recordingId: recId,
    startedAt: ago(282), endedAt: ago(198), videoStartPos: 0, videoEndPos: 3240, totalWatchedSec: 3600, status: 'ENDED',
    events: [
      { type: 'play', videoTime: 0, wallTime: ago(282).toISOString() },
      { type: 'pause', videoTime: 1200, wallTime: ago(262).toISOString() },
      { type: 'play', videoTime: 1200, wallTime: ago(260).toISOString() },
      { type: 'ended', videoTime: 3600, wallTime: ago(198).toISOString() },
    ],
  });

  // 3) Tharushi — 1 session
  sessionsToCreate.push({
    userId: users[2].id, recordingId: recId,
    startedAt: ago(510), endedAt: ago(490), videoStartPos: 0, videoEndPos: 405, totalWatchedSec: 450, status: 'ENDED',
    events: [
      { type: 'play', videoTime: 0, wallTime: ago(510).toISOString() },
      { type: 'pause', videoTime: 200, wallTime: ago(507).toISOString() },
      { type: 'play', videoTime: 200, wallTime: ago(506).toISOString() },
      { type: 'pause', videoTime: 450, wallTime: ago(500).toISOString() },
    ],
  });

  // 4) Dilshan — 2 sessions
  sessionsToCreate.push(
    {
      userId: users[3].id, recordingId: recId,
      startedAt: ago(705), endedAt: ago(695), videoStartPos: 0, videoEndPos: 108, totalWatchedSec: 120, status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(705).toISOString() },
        { type: 'pause', videoTime: 120, wallTime: ago(700).toISOString() },
      ],
    },
    {
      userId: users[3].id, recordingId: recId,
      startedAt: ago(402), endedAt: ago(398), videoStartPos: 0, videoEndPos: 2754, totalWatchedSec: 60, status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(402).toISOString() },
        { type: 'seek', videoTime: 3000, wallTime: ago(401).toISOString() },
        { type: 'pause', videoTime: 3060, wallTime: ago(400).toISOString() },
      ],
    },
  );

  // 5) Sanduni — 0 sessions (manual only)
  // skip

  // 6) Hasitha — 2 sessions (live join)
  sessionsToCreate.push(
    {
      userId: users[5].id, recordingId: recId,
      startedAt: ago(380), endedAt: ago(320), videoStartPos: 0, videoEndPos: 1620, totalWatchedSec: 1800, status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(380).toISOString() },
        { type: 'pause', videoTime: 600, wallTime: ago(370).toISOString() },
        { type: 'play', videoTime: 600, wallTime: ago(368).toISOString() },
        { type: 'pause', videoTime: 1800, wallTime: ago(350).toISOString() },
      ],
    },
    {
      userId: users[5].id, recordingId: recId,
      startedAt: ago(332), endedAt: ago(308), videoStartPos: 1800, videoEndPos: 2520, totalWatchedSec: 1600, status: 'ENDED',
      events: [
        { type: 'play', videoTime: 1800, wallTime: ago(332).toISOString() },
        { type: 'buffer', videoTime: 2200, wallTime: ago(327).toISOString() },
        { type: 'play', videoTime: 2200, wallTime: ago(327).toISOString() },
        { type: 'ended', videoTime: 2800, wallTime: ago(320).toISOString() },
      ],
    },
  );

  // 7) Nimesh — 0 sessions
  // skip

  // 8) Ishara — 4 sessions (suspicious seeker)
  sessionsToCreate.push(
    {
      userId: users[7].id, recordingId: recId,
      startedAt: ago(603), endedAt: ago(597), videoStartPos: 0, videoEndPos: 2790, totalWatchedSec: 150, status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(603).toISOString() },
        { type: 'seek', videoTime: 1000, wallTime: ago(602).toISOString() },
        { type: 'seek', videoTime: 2000, wallTime: ago(601).toISOString() },
        { type: 'seek', videoTime: 3000, wallTime: ago(600).toISOString() },
        { type: 'pause', videoTime: 3100, wallTime: ago(600).toISOString() },
      ],
    },
    {
      userId: users[7].id, recordingId: recId,
      startedAt: ago(502), endedAt: ago(498), videoStartPos: 0, videoEndPos: 2745, totalWatchedSec: 90, status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(502).toISOString() },
        { type: 'seek', videoTime: 1500, wallTime: ago(501).toISOString() },
        { type: 'seek', videoTime: 3000, wallTime: ago(500).toISOString() },
        { type: 'pause', videoTime: 3050, wallTime: ago(500).toISOString() },
      ],
    },
    {
      userId: users[7].id, recordingId: recId,
      startedAt: ago(304), endedAt: ago(296), videoStartPos: 500, videoEndPos: 2880, totalWatchedSec: 180, status: 'ENDED',
      events: [
        { type: 'play', videoTime: 500, wallTime: ago(304).toISOString() },
        { type: 'seek', videoTime: 1800, wallTime: ago(303).toISOString() },
        { type: 'pause', videoTime: 1900, wallTime: ago(301).toISOString() },
        { type: 'play', videoTime: 1900, wallTime: ago(301).toISOString() },
        { type: 'seek', videoTime: 3200, wallTime: ago(300).toISOString() },
      ],
    },
    {
      userId: users[7].id, recordingId: recId,
      startedAt: ago(103), endedAt: ago(97), videoStartPos: 0, videoEndPos: 2880, totalWatchedSec: 100, status: 'ENDED',
      events: [
        { type: 'play', videoTime: 0, wallTime: ago(103).toISOString() },
        { type: 'seek', videoTime: 3200, wallTime: ago(102).toISOString() },
        { type: 'pause', videoTime: 3200, wallTime: ago(100).toISOString() },
      ],
    },
  );

  // 9) Malini — 1 session (currently watching)
  sessionsToCreate.push({
    userId: users[8].id, recordingId: recId,
    startedAt: ago(30), endedAt: null, videoStartPos: 0, videoEndPos: 540, totalWatchedSec: 600, status: 'WATCHING',
    events: [
      { type: 'play', videoTime: 0, wallTime: ago(30).toISOString() },
      { type: 'pause', videoTime: 200, wallTime: ago(27).toISOString() },
      { type: 'play', videoTime: 200, wallTime: ago(26).toISOString() },
    ],
  });

  // 10) Chaminda — 1 session (not enrolled, but watched)
  sessionsToCreate.push({
    userId: users[9].id, recordingId: recId,
    startedAt: ago(182), endedAt: ago(58), videoStartPos: 0, videoEndPos: 3240, totalWatchedSec: 3600, status: 'ENDED',
    events: [
      { type: 'play', videoTime: 0, wallTime: ago(182).toISOString() },
      { type: 'pause', videoTime: 1800, wallTime: ago(152).toISOString() },
      { type: 'play', videoTime: 1800, wallTime: ago(150).toISOString() },
      { type: 'ended', videoTime: 3600, wallTime: ago(120).toISOString() },
    ],
  });

  for (const s of sessionsToCreate) {
    await prisma.watchSession.create({ data: s });
  }
  console.log(`Created ${sessionsToCreate.length} watch sessions`);

  console.log('\n--- Seed Complete ---');
  console.log('Admin login: admin@thilinadhananjaya.lk / admin123');
  console.log('Student login (any): student123');
  console.log(`Mock recording: "${mockRecording.title}" in April 2026`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
