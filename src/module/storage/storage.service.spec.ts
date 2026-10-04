import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

jest.mock('@aws-sdk/client-s3');

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'S3_BUCKET') return 'test-bucket';
              return 'test-value';
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should upload a file and return the key', async () => {
    const mockFile = {
      originalname: 'test.png',
      buffer: Buffer.from('test'),
      mimetype: 'image/png',
    };

    const result = await service.uploadFile(mockFile, 'test-folder');

    expect(result).toContain('test-folder/');
    expect(result).toContain('.png');
    expect(S3Client.prototype.send).toHaveBeenCalled();
  });

  it('should get a file from S3', async () => {
    const mockKey = 'test-key';
    const mockResponse = {
      Body: 'test-body',
      ContentType: 'image/png',
    };

    (S3Client.prototype.send as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await service.getFile(mockKey);

    expect(result.body).toBe('test-body');
    expect(result.contentType).toBe('image/png');
    expect(S3Client.prototype.send).toHaveBeenCalled();
  });

  describe('optimizeImage', () => {
    it('should return original buffer if file has no buffer', async () => {
      const mockFile = {} as any;
      const res = await service.optimizeImage(mockFile);
      expect(res.buffer).toBeUndefined();
    });

    it('should fail-open and return buffer on unexpected sharp failure', async () => {
      const invalidFile = {
        buffer: Buffer.from('not-a-real-image'),
        originalname: 'corrupted.png',
        mimetype: 'image/png',
        size: 16,
      };

      const res = await service.optimizeImage(invalidFile);
      expect(res.buffer).toEqual(invalidFile.buffer);
      expect(res.originalname).toBe('corrupted.png');
    });

    it('should optimize transparent PNG as WebP preserving transparency', async () => {
      const transparentPngBuffer = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .png()
        .toBuffer();

      const res = await service.optimizeImage({
        buffer: transparentPngBuffer,
        originalname: 'badge-icon.png',
        mimetype: 'image/png',
      });

      expect(res.mimetype).toBe('image/webp');
      expect(res.originalname).toBe('badge-icon.webp');
      const meta = await sharp(res.buffer).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.hasAlpha).toBe(true);
    });
  });
});
