import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [PublicController],
})
export class PublicModule {}
