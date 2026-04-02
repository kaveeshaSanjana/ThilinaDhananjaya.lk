import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';

@Injectable()
export class UploadService {
  private s3: S3Client;
  private bucket: string;
  private region: string;

  constructor(private config: ConfigService) {
    this.region = this.config.get<string>('AWS_REGION') ?? 'us-east-1';
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') ?? '';

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  /**
   * Upload a file buffer to S3.
   * @param file - multer file object (memory storage)
   * @param folder - S3 key prefix e.g. 'classes', 'recordings', 'avatars'
   * @returns public S3 URL
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: 'classes' | 'recordings' | 'avatars' | 'general',
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('No file provided. Send the image as form-data with field name "file".');
    }

    const bucket = this.config.get<string>('AWS_S3_BUCKET') ?? '';
    const accessKey = this.config.get<string>('AWS_ACCESS_KEY_ID') ?? '';
    const secretKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '';

    if (
      !bucket || bucket === 'your-s3-bucket-name' ||
      !accessKey || accessKey === 'your-access-key-id' ||
      !secretKey || secretKey === 'your-secret-access-key'
    ) {
      throw new BadRequestException(
        'AWS S3 is not configured. Update AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in the .env file.',
      );
    }

    if (!this.bucket) {
      throw new BadRequestException('S3 is not configured. Set AWS_S3_BUCKET in the .env file.');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.',
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds the 5 MB limit.');
    }

    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const key = `${folder}/${randomUUID()}${ext}`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        `S3 upload failed: ${err?.message ?? 'Unknown error'}. Check your AWS credentials and bucket name in .env.`,
      );
    }

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Delete an object from S3 by its full URL.
   */
  async deleteByUrl(url: string): Promise<void> {
    try {
      const prefix = `https://${this.bucket}.s3.${this.region}.amazonaws.com/`;
      if (!url.startsWith(prefix)) return;
      const key = url.slice(prefix.length);
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      // Deletion errors are non-fatal; log but don't throw
    }
  }
}
