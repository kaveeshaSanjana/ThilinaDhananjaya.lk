"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding database...');
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
    const sampleClass = await prisma.class.upsert({
        where: { id: 'sample-class-1' },
        update: {},
        create: {
            id: 'sample-class-1',
            name: 'Combined Mathematics',
            description: 'A/L Combined Mathematics - 2026 batch',
        },
    });
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
    await prisma.recording.upsert({
        where: { id: 'sample-recording-1' },
        update: {},
        create: {
            id: 'sample-recording-1',
            monthId: sampleMonth.id,
            title: 'Introduction to Limits',
            description: 'First lesson on limits and continuity',
            videoUrl: 'https://example.com/sample-video.mp4',
            visibility: 'ANYONE',
            order: 1,
        },
    });
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
//# sourceMappingURL=seed.js.map