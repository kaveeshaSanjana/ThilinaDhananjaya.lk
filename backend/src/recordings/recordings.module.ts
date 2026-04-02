import { Module } from '@nestjs/common';
import { RecordingsService } from './recordings.service';
import { RecordingsController } from './recordings.controller';
import { AccessResolverService } from './access-resolver.service';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UploadModule],
  providers: [RecordingsService, AccessResolverService],
  controllers: [RecordingsController],
  exports: [RecordingsService, AccessResolverService],
})
export class RecordingsModule {}
