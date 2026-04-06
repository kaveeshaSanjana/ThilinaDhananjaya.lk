import { Module } from '@nestjs/common';
import { LecturesService } from './lectures.service';
import { LecturesController } from './lectures.controller';

@Module({
  providers: [LecturesService],
  controllers: [LecturesController],
  exports: [LecturesService],
})
export class LecturesModule {}
