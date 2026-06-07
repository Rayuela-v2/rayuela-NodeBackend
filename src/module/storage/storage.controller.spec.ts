import { Test, TestingModule } from '@nestjs/testing';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { Stream } from 'stream';

describe('StorageController', () => {
  let controller: StorageController;

  const mockStorageService = {
    getFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    controller = module.get<StorageController>(StorageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getFile', () => {
    it('should return a file stream', async () => {
      const mockKey = 'test-key';
      const mockStream = new Stream.PassThrough();
      const mockResponse = {
        body: mockStream,
        contentType: 'image/png',
      };

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      mockStorageService.getFile.mockResolvedValue(mockResponse);

      // We need to mock pipe because PassThrough has it
      const pipeSpy = jest
        .spyOn(mockStream, 'pipe')
        .mockImplementation((res) => res as any);

      await controller.getFile(mockKey, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/png',
      );
      expect(pipeSpy).toHaveBeenCalledWith(mockRes);
    });

    it('should throw NotFoundException when file not found', async () => {
      const mockKey = 'invalid-key';
      const mockRes = {} as Response;

      mockStorageService.getFile.mockRejectedValue(new Error('S3 Error'));

      await expect(controller.getFile(mockKey, mockRes)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
