import { Test, TestingModule } from '@nestjs/testing';
import { GamificationIndicatorsController } from './gamification-indicators.controller';
import { GamificationIndicatorsService } from './gamification-indicators.service';
import { CommunityIndicatorsResponseDto } from './dto/indicators-response.dto';

describe('GamificationIndicatorsController', () => {
  let controller: GamificationIndicatorsController;
  let service: Partial<GamificationIndicatorsService>;

  const mockResponse: CommunityIndicatorsResponseDto = {
    projectId: 'proj1',
    currentPeriod: 2,
    startDate: '2026-06-01T00:00:00.000Z',
    asOfDate: '2026-06-15T00:00:00.000Z',
    daysPerPeriod: 7,
    totalPlayers: 10,
    activePlayers: 5,
    totalContributions: 25,
    avgPMI: 1.8,
    CMI: 1.1,
    badges: [],
    players: [],
    adaptationCandidateBadge: null,
  };

  beforeEach(async () => {
    service = {
      computeIndicators: jest.fn().mockResolvedValue(mockResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamificationIndicatorsController],
      providers: [
        {
          provide: GamificationIndicatorsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<GamificationIndicatorsController>(
      GamificationIndicatorsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return indicators from service', async () => {
    const result = await controller.getIndicators('proj1', {
      daysPerPeriod: 7,
      asOfDate: '2026-06-15T00:00:00.000Z',
    });

    expect(service.computeIndicators).toHaveBeenCalledWith('proj1', {
      daysPerPeriod: 7,
      asOfDate: '2026-06-15T00:00:00.000Z',
    });
    expect(result).toEqual(mockResponse);
  });
});
