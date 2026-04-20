import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { UsersModule } from '../users/users.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [UsersModule, AttendanceModule, EnrollmentsModule],
  controllers: [PublicController],
})
export class PublicModule {}
