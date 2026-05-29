import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CheckInDao } from './checkin.dao';
import { CheckInTemplate } from './checkin.schema';
import { NotFoundException } from '@nestjs/common';

describe('CheckInDao', () => {
  let dao: CheckInDao;
  let model: any;

  const mockModel = {
    find: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
    findByIdAndDelete: jest.fn().mockReturnThis(),
    exec: jest.fn(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    save: jest.fn(),
  };

  class MockModel {
    constructor(private data: any) {
      Object.assign(this, data);
    }
    save = jest.fn().mockResolvedValue(this);
    static find = mockModel.find;
    static findById = mockModel.findById;
    static findByIdAndUpdate = mockModel.findByIdAndUpdate;
    static findByIdAndDelete = mockModel.findByIdAndDelete;
    static sort = mockModel.sort;
    static limit = mockModel.limit;
    static exec = mockModel.exec;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInDao,
        {
          provide: getModelToken(CheckInTemplate.collectionName()),
          useValue: MockModel,
        },
      ],
    }).compile();

    dao = module.get<CheckInDao>(CheckInDao);
    model = MockModel;
  });

  it('should find all', async () => {
    model.find.mockReturnThis();
    model.exec.mockResolvedValue([]);
    const res = await dao.findAll();
    expect(res).toEqual([]);
  });

  it('should find one', async () => {
    const doc = {
      _id: '1',
      latitude: '0',
      longitude: '0',
      datetime: new Date(),
      projectId: 'p1',
      userId: 'u1',
      contributesTo: '',
      taskType: 'T',
    };
    model.findById.mockReturnThis();
    model.exec.mockResolvedValue(doc);
    const res = await dao.findOne('1');
    expect(res.projectId).toBe('p1');
  });

  it('should throw NotFound if one not found', async () => {
    model.findById.mockReturnThis();
    model.exec.mockResolvedValue(null);
    await expect(dao.findOne('1')).rejects.toThrow(NotFoundException);
  });

  it('should create', async () => {
    const checkin = {
      latitude: '0',
      longitude: '0',
      date: new Date(),
      projectId: 'p1',
      user: { id: 'u1' },
      contributesTo: '',
      taskType: 'T',
      imageRefs: ['image-ref-123', 'image-ref-456'],
    } as any;
    const res = await dao.create(checkin);
    expect(res).toBeDefined();
    expect(res.imageRefs).toEqual(['image-ref-123', 'image-ref-456']);
  });

  it('should update', async () => {
    model.findByIdAndUpdate.mockReturnThis();
    model.exec.mockResolvedValue({});
    const res = await dao.update('1', {} as any);
    expect(res).toBeDefined();
  });

  it('should throw NotFound on update if not found', async () => {
    model.findByIdAndUpdate.mockReturnThis();
    model.exec.mockResolvedValue(null);
    await expect(dao.update('1', {} as any)).rejects.toThrow(NotFoundException);
  });

  it('should remove', async () => {
    model.findByIdAndDelete.mockReturnThis();
    model.exec.mockResolvedValue({});
    await dao.remove('1');
    expect(model.findByIdAndDelete).toHaveBeenCalledWith('1');
  });

  it('should throw NotFound on remove if not found', async () => {
    model.findByIdAndDelete.mockReturnThis();
    model.exec.mockResolvedValue(null);
    await expect(dao.remove('1')).rejects.toThrow(NotFoundException);
  });

  it('should find by project id', async () => {
    model.find.mockReturnThis();
    model.sort.mockReturnThis();
    model.limit.mockReturnThis();
    model.exec.mockResolvedValue([]);
    await dao.findByProjectId('u1', 'p1');
    expect(model.find).toHaveBeenCalledWith({ projectId: 'p1', userId: 'u1' });
  });

  describe('findForAdmin', () => {
    /**
     * Wires the next call to `find()` and to `countDocuments()` so the
     * full chain `.sort().skip().limit().exec()` resolves to `items` and
     * `countDocuments().exec()` to `count`.
     */
    const wireFindAndCount = (items: any[], count: number) => {
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(items),
      };
      const countChain = {
        exec: jest.fn().mockResolvedValue(count),
      };
      mockModel.find.mockReturnValueOnce(findChain);
      (MockModel as any).countDocuments = jest.fn().mockReturnValue(countChain);
      return { findChain, countChain };
    };

    it('paginates with default sort=desc on datetime', async () => {
      const { findChain } = wireFindAndCount([{ _id: 'a' }], 1);

      const res = await dao.findForAdmin({
        projectId: 'p1',
        page: 1,
        limit: 20,
        sortOrder: -1,
      });

      expect(model.find).toHaveBeenLastCalledWith({ projectId: 'p1' });
      expect(findChain.sort).toHaveBeenCalledWith({ datetime: -1 });
      expect(findChain.skip).toHaveBeenCalledWith(0);
      expect(findChain.limit).toHaveBeenCalledWith(20);
      expect(res).toEqual({
        items: [{ _id: 'a' }],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('applies hasPhotos=true filter', async () => {
      wireFindAndCount([], 0);

      await dao.findForAdmin({
        projectId: 'p1',
        hasPhotos: true,
        page: 1,
        limit: 20,
        sortOrder: -1,
      });

      expect(model.find).toHaveBeenLastCalledWith({
        projectId: 'p1',
        'imageRefs.0': { $exists: true },
      });
    });

    it('applies hasPhotos=false filter via $and', async () => {
      wireFindAndCount([], 0);

      await dao.findForAdmin({
        projectId: 'p1',
        hasPhotos: false,
        page: 1,
        limit: 20,
        sortOrder: -1,
      });

      const arg = model.find.mock.calls[model.find.mock.calls.length - 1][0];
      expect(arg.projectId).toBe('p1');
      expect(arg.$and).toEqual([
        {
          $or: [{ imageRefs: { $exists: false } }, { imageRefs: { $size: 0 } }],
        },
      ]);
    });

    it('passes taskIdIn through as $in on contributesTo', async () => {
      wireFindAndCount([], 0);

      await dao.findForAdmin({
        projectId: 'p1',
        taskIdIn: ['t1', 't2'],
        page: 1,
        limit: 20,
        sortOrder: -1,
      });

      expect(model.find).toHaveBeenLastCalledWith({
        projectId: 'p1',
        contributesTo: { $in: ['t1', 't2'] },
      });
    });

    it('respects asc sort order', async () => {
      const { findChain } = wireFindAndCount([], 0);

      await dao.findForAdmin({
        projectId: 'p1',
        page: 1,
        limit: 20,
        sortOrder: 1,
      });

      expect(findChain.sort).toHaveBeenCalledWith({ datetime: 1 });
    });

    it('applies geo radius filter in-memory', async () => {
      // Inside ≈ at the center of (0,0); outside ≈ ~111km away on the equator.
      const inside = { latitude: '0', longitude: '0', _id: 'a' };
      const outside = { latitude: '1', longitude: '0', _id: 'b' };
      const findChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([inside, outside]),
      };
      mockModel.find.mockReturnValueOnce(findChain);

      const res = await dao.findForAdmin({
        projectId: 'p1',
        centerLat: 0,
        centerLng: 0,
        radiusKm: 1,
        page: 1,
        limit: 20,
        sortOrder: -1,
      });

      expect(res.total).toBe(1);
      expect(res.items).toEqual([inside]);
    });
  });
});
