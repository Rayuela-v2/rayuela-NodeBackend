import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

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
});
