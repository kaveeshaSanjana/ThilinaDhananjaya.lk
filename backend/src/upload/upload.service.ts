import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';

type UploadFolder = 'classes' | 'recordings' | 'avatars' | 'general' | 'media';

export interface UploadUrlResult {
  incomingUrl: string;
  responseUrl: string;
}

@Injectable()
export class UploadService {
  private s3: S3Client;
  private bucket: string;
  private region: string;
  private responseBaseUrl: string;

  constructor(private config: ConfigService) {
    this.region = this.config.get<string>('AWS_REGION') ?? 'us-east-1';
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') ?? '';
    const configuredResponseBase =
      this.config.get<string>('UPLOAD_RESPONSE_BASE_URL') ||
      this.config.get<string>('STORAGE_RESPONSE_BASE_URL') ||
      this.config.get<string>('ASSET_PUBLIC_BASE_URL') ||
      '';

    this.responseBaseUrl = this.normalizePublicBaseUrl(configuredResponseBase);

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  private ensureFileProvided(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided. Send the file as form-data with field name "file".');
    }
  }

  private ensureBucketConfigured() {
    if (!this.bucket) {
      throw new BadRequestException(
        'AWS S3 is not configured. Update AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in the .env file.',
      );
    }
  }

  private normalizePublicBaseUrl(rawUrl: string) {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) return '';

    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return withScheme.replace(/\/+$/, '');
  }

  private getIncomingPrefix() {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/`;
  }

  private buildUploadUrls(key: string): UploadUrlResult {
    const normalizedKey = key.replace(/^\/+/, '');
    const incomingUrl = `${this.getIncomingPrefix()}${normalizedKey}`;
    const responseUrl = this.toResponseUrl(incomingUrl);

    return { incomingUrl, responseUrl };
  }

  // Keep custom/non-S3 URLs exactly as-is; only remap known incoming S3 URLs.
  private toResponseUrl(url: string) {
    const value = (url || '').trim();
    if (!value) return value;

    const incomingPrefix = this.getIncomingPrefix();
    if (!value.startsWith(incomingPrefix)) {
      return value;
    }

    if (!this.responseBaseUrl) {
      return value;
    }

    const key = value.slice(incomingPrefix.length).replace(/^\/+/, '');
    return key ? `${this.responseBaseUrl}/${key}` : value;
  }

  private async uploadToS3(file: Express.Multer.File, folder: UploadFolder): Promise<UploadUrlResult> {
    const ext = extname(file.originalname).toLowerCase() || '.bin';
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

    return this.buildUploadUrls(key);
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
  ): Promise<UploadUrlResult> {
    this.ensureFileProvided(file);
    this.ensureBucketConfigured();

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

    return this.uploadToS3(file, folder);
  }

  /**
   * Upload a media/document file to S3.
   * Supports common study-material formats (PDF, Office docs, images, zip).
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: UploadFolder = 'media',
  ): Promise<UploadUrlResult> {
    this.ensureFileProvided(file);
    this.ensureBucketConfigured();

    const ext = extname(file.originalname).toLowerCase();
    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/vnd.rar',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/jpg',
    ]);

    const allowedExtensions = new Set([
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.txt', '.zip', '.rar', '.jpg', '.jpeg', '.png', '.webp', '.gif',
    ]);

    if (!allowedMimeTypes.has(file.mimetype) && !allowedExtensions.has(ext)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: PDF, Word, Excel, PowerPoint, text, zip/rar, and common image formats.',
      );
    }

    const maxSize = 25 * 1024 * 1024; // 25 MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds the 25 MB limit.');
    }

    return this.uploadToS3(file, folder);
  }

  private extractKeyFromUrl(url: string): string | null {
    const value = (url || '').trim();
    if (!value) return null;

    const incomingPrefix = this.getIncomingPrefix();
    if (value.startsWith(incomingPrefix)) {
      const key = value.slice(incomingPrefix.length).split(/[?#]/)[0] || '';
      return key || null;
    }

    if (this.responseBaseUrl) {
      const responsePrefix = `${this.responseBaseUrl}/`;
      if (value.startsWith(responsePrefix)) {
        const key = value.slice(responsePrefix.length).split(/[?#]/)[0] || '';
        return key || null;
      }
    }

    return null;
  }

  /**
   * Delete an object from S3 by its full URL.
   */
  async deleteByUrl(url: string): Promise<void> {
    try {
      const key = this.extractKeyFromUrl(url);
      if (!key) return;
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      // Deletion errors are non-fatal; log but don't throw
    }
  }
}
