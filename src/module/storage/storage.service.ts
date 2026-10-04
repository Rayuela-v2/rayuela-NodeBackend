import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

import sharp from 'sharp';

export interface OptimizeImageOptions {
  maxDimension?: number;
  quality?: number;
}

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY');
    const region = this.configService.get<string>('S3_REGION');
    this.bucketName = this.configService.get<string>('S3_BUCKET');

    this.s3Client = new S3Client({
      endpoint: endpoint || 'http://localhost:3900',
      region: region || 'garage',
      credentials: {
        accessKeyId: accessKeyId || 'placeholder',
        secretAccessKey: secretAccessKey || 'placeholder',
      },
      forcePathStyle: true, // Required for Garage/S3-compatible
    });

    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucketName) {
      this.logger.warn(
        'S3 Storage configuration is incomplete. Image uploads may fail.',
      );
    }
  }

  /**
   * Optimizes an image buffer/file using sharp: auto-orient, resize within maxDimension,
   * re-encode to JPEG quality.
   *
   * Zero-friction fail-open guarantee: falls back to original buffer on error.
   */
  async optimizeImage(
    file: {
      buffer: Buffer;
      originalname?: string;
      mimetype?: string;
      size?: number;
    },
    options: OptimizeImageOptions = {},
  ): Promise<{
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }> {
    const { maxDimension = 1600, quality = 80 } = options;

    if (!file || !file.buffer) {
      return {
        buffer: file?.buffer,
        originalname: file?.originalname || 'image.jpg',
        mimetype: file?.mimetype || 'image/jpeg',
        size: file?.size || 0,
      };
    }

    try {
      const metadata = await sharp(file.buffer).metadata();
      const hasAlpha = !!metadata.hasAlpha;
      const isPngOrWebp =
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/webp' ||
        metadata.format === 'png' ||
        metadata.format === 'webp';

      const pipeline = sharp(file.buffer).rotate().resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      });

      let optimizedBuffer: Buffer;
      let mimetype: string;
      let extension: string;

      if (hasAlpha || isPngOrWebp) {
        // Retain full alpha transparency using WebP
        optimizedBuffer = await pipeline
          .webp({ quality, alphaQuality: 100, effort: 4 })
          .toBuffer();
        mimetype = 'image/webp';
        extension = 'webp';
      } else {
        optimizedBuffer = await pipeline
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
        mimetype = 'image/jpeg';
        extension = 'jpg';
      }

      const originalBase = file.originalname
        ? file.originalname.replace(/\.[^/.]+$/, '')
        : 'image';

      return {
        buffer: optimizedBuffer,
        size: optimizedBuffer.length,
        mimetype,
        originalname: `${originalBase}.${extension}`,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to optimize image ${file.originalname || 'unknown'}: ${error?.message || error}. Falling back to original buffer.`,
      );
      return {
        buffer: file.buffer,
        size: file.size || file.buffer.length,
        mimetype: file.mimetype || 'image/jpeg',
        originalname: file.originalname || 'image.jpg',
      };
    }
  }

  async uploadFile(file: any, folder: string): Promise<string> {
    const fileExtension = file.originalname
      ? file.originalname.split('.').pop()
      : 'jpg';
    const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);
      return fileName;
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`);
      throw error;
    }
  }

  async getFile(key: string): Promise<{ body: any; contentType: string }> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      const response = await this.s3Client.send(command);
      return {
        body: response.Body,
        contentType: response.ContentType,
      };
    } catch (error) {
      this.logger.error(`Failed to get file from S3: ${error.message}`);
      throw error;
    }
  }
}
