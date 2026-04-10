import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClassesModule } from './classes/classes.module';
import { RecordingsModule } from './recordings/recordings.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { PaymentsModule } from './payments/payments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { UploadModule } from './upload/upload.module';
import { StatsModule } from './stats/stats.module';
import { LecturesModule } from './lectures/lectures.module';
import { InstituteModule } from './institutes/institutes.module';
import { PublicModule } from './public/public.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClassesModule,
    RecordingsModule,
    EnrollmentsModule,
    PaymentsModule,
    AttendanceModule,
    UploadModule,
    StatsModule,
    LecturesModule,
    InstituteModule,
    PublicModule,
    MediaModule,
  ],
})
export class AppModule {}
