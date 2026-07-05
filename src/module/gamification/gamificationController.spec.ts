import { Test, TestingModule } from '@nestjs/testing';
import { GamificationController } from './gamificationController';
import { GamificationService } from './gamification.service';

describe('GamificationController', () => {
  let controller: GamificationController;
  let service: GamificationService;

  const mockGamificationService = {
    createBadge: jest.fn(),
    updateBadge: jest.fn(),
    removeBadge: jest.fn(),
    updateBadgeStatus: jest.fn(),
    createScoreRule: jest.fn(),
    updateScoreRule: jest.fn(),
    removeScoreRule: jest.fn(),
    update: jest.fn(),
    findByProjectId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamificationController],
      providers: [
        { provide: GamificationService, useValue: mockGamificationService },
      ],
    }).compile();

    controller = module.get<GamificationController>(GamificationController);
    service = module.get<GamificationService>(GamificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('badge operations', () => {
    it('should create badge', async () => {
      const dto = {} as any;
      await controller.create(dto);
      expect(service.createBadge).toHaveBeenCalledWith(dto);
    });

    it('should update badge', async () => {
      const dto = {} as any;
      await controller.updateBadge(dto, '1');
      expect(service.updateBadge).toHaveBeenCalledWith('1', dto);
    });

    it('should remove badge', async () => {
      await controller.remove('p1', 'b1');
      expect(service.removeBadge).toHaveBeenCalledWith('p1', 'b1');
    });

    it('should update badge status', async () => {
      await controller.updateBadgeStatus('p1', 'b1', 'active');
      expect(service.updateBadgeStatus).toHaveBeenCalledWith(
        'p1',
        'b1',
        'active',
      );
    });
  });

  describe('score rule operations', () => {
    it('should create score rule', async () => {
      const dto = {} as any;
      await controller.createScoreRule(dto);
      expect(service.createScoreRule).toHaveBeenCalledWith(dto);
    });

    it('should update score rule', async () => {
      const dto = {} as any;
      await controller.updateScoreRule(dto);
      expect(service.updateScoreRule).toHaveBeenCalledWith(dto);
    });

    it('should remove score rule', async () => {
      await controller.removeScoreRule('p1', 's1');
      expect(service.removeScoreRule).toHaveBeenCalledWith('p1', 's1');
    });
  });

  describe('general operations', () => {
    it('should update gamification', async () => {
      const dto = {} as any;
      await controller.update('p1', dto);
      expect(service.update).toHaveBeenCalledWith('p1', dto);
    });

    it('should find by project id', async () => {
      await controller.findAll('p1');
      expect(service.findByProjectId).toHaveBeenCalledWith('p1');
    });
  });
});
