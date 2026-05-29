import { Test, TestingModule } from '@nestjs/testing';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { UpdateCheckinDto } from './dto/update-checkin.dto';

describe('CheckinController', () => {
  let controller: CheckinController;
  let service: CheckinService;

  const mockCheckinService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findByProjectId: jest.fn(),
    findForAdmin: jest.fn(),
    rate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckinController],
      providers: [{ provide: CheckinService, useValue: mockCheckinService }],
    }).compile();

    controller = module.get<CheckinController>(CheckinController);
    service = module.get<CheckinService>(CheckinService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const fakeRes: any = { setHeader: jest.fn() };

    it('should call service.create with the request user and idempotency key', async () => {
      const dto: CreateCheckinDto = { userId: '', projectId: '1' } as any;
      const req = { user: { userId: 'u1' } };
      const files = [{ buffer: Buffer.from('test') }] as any;
      mockCheckinService.create.mockResolvedValueOnce({
        id: 'new',
        replayed: false,
      });

      await controller.create(dto, req, files, 'idem-1', fakeRes);

      expect(dto.userId).toBe('u1');
      expect(service.create).toHaveBeenCalledWith({
        createCheckinDto: dto,
        files,
        idempotencyKey: 'idem-1',
      });
      // No replay → no header.
      expect(fakeRes.setHeader).not.toHaveBeenCalled();
    });

    it('emits X-Original-Resource on a replayed response', async () => {
      const dto: CreateCheckinDto = { userId: '', projectId: '1' } as any;
      const req = { user: { userId: 'u1' } };
      mockCheckinService.create.mockResolvedValueOnce({
        id: 'old-checkin',
        replayed: true,
      });

      await controller.create(dto, req, [], 'idem-2', fakeRes);

      expect(fakeRes.setHeader).toHaveBeenCalledWith(
        'X-Original-Resource',
        'old-checkin',
      );
    });
  });

  describe('findAll', () => {
    it('should call service.findAll', async () => {
      await controller.findAll();
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should call service.findOne', async () => {
      await controller.findOne('1');
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('update', () => {
    it('should call service.update', async () => {
      const dto: UpdateCheckinDto = {};
      await controller.update('1', dto);
      expect(service.update).toHaveBeenCalledWith('1', dto);
    });
  });

  describe('remove', () => {
    it('should call service.remove', async () => {
      await controller.remove('1');
      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });

  describe('findByProjectId', () => {
    it('should call service.findByProjectId', async () => {
      const req = { user: { userId: '1' } };
      await controller.findUserCheckins(req, 'proj1');
      expect(service.findByProjectId).toHaveBeenCalledWith('1', 'proj1');
    });
  });

  describe('rate', () => {
    it('should call service.rate', async () => {
      const req = { user: { userId: '1' } };
      const body = { checkinId: 'c1', rate: 5 };
      await controller.rate(body, req);
      expect(service.rate).toHaveBeenCalledWith({ ...body, userId: '1' });
    });
  });

  describe('findForAdmin', () => {
    it('forwards the project id and query to the service', async () => {
      const query = {
        taskName: 'limpieza',
        hasPhotos: 'true',
        page: '2',
        limit: '10',
      } as any;
      mockCheckinService.findForAdmin.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 2,
        limit: 10,
      });

      const result = await controller.findForAdmin('proj1', query);

      expect(service.findForAdmin).toHaveBeenCalledWith('proj1', query);
      expect(result).toEqual({ items: [], total: 0, page: 2, limit: 10 });
    });
  });
});
