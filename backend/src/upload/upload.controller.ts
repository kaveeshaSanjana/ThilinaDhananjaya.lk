import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private uploadService: UploadService) {}

  /**
   * POST /upload/image?folder=classes|recordings|avatars|general
   * Upload a single image to S3.
   * Requires JWT authentication.
   * Returns: { url: string }
   */
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder: 'classes' | 'recordings' | 'avatars' | 'general' = 'general',
  ) {
    const uploaded = await this.uploadService.uploadImage(file, folder);
    return {
      url: uploaded.responseUrl,
      incomingUrl: uploaded.incomingUrl,
      responseUrl: uploaded.responseUrl,
    };
  }

  /**
   * POST /upload/file?folder=media|general|classes|recordings|avatars
   * Upload a study material file (PDF, docs, images, etc.) to S3.
   * Requires JWT authentication.
   * Returns: { url: string }
   */
  @Post('file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder: 'classes' | 'recordings' | 'avatars' | 'general' | 'media' = 'media',
  ) {
    const uploaded = await this.uploadService.uploadFile(file, folder);
    return {
      url: uploaded.responseUrl,
      incomingUrl: uploaded.incomingUrl,
      responseUrl: uploaded.responseUrl,
    };
  }
}
