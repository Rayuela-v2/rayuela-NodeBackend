import { Test, TestingModule } from '@nestjs/testing';
import { GamificationIndicatorsController } from './gamification-indicators.controller';
import { GamificationIndicatorsService } from './gamification-indicators.service';
import { CommunityIndicatorsResponseDto } from './dto/indicators-response.dto';

import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('GamificationIndicatorsController', () => {
  let controller: GamificationIndicatorsController;
  let service: Partial<GamificationIndicatorsService>;

  const mockResponse: CommunityIndicatorsResponseDto = {
    projectId: 'proj1',
    asOfDate: '2026-06-15T00:00:00.000Z',
    threshold: 0.2,
    totalPlayers: 10,
    activePlayers: 5,
    totalContributions: 25,
    isTriggered: false,
    triggerBadges: [],
    communityIgnoredCount: 0,
    totalPlayerIgnored: 0,
    allPlayerBadges: [],
    unreachableBadges: [],
    candidateBadges: [],
    lowestCII: null,
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
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GamificationIndicatorsController>(
      GamificationIndicatorsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return indicators from service', async () => {
    const result = await controller.getIndicators('proj1', {
      threshold: 0.2,
      asOfDate: '2026-06-15T00:00:00.000Z',
    });

    expect(service.computeIndicators).toHaveBeenCalledWith('proj1', {
      threshold: 0.2,
      asOfDate: '2026-06-15T00:00:00.000Z',
    });
    expect(result).toEqual(mockResponse);
  });

  it('should return indicators timeline from service', async () => {
    const mockTimelineResponse = {
      projectId: 'proj1',
      threshold: 0.2,
      startDate: '2026-05-15T00:00:00.000Z',
      endDate: '2026-06-15T00:00:00.000Z',
      stepDays: 7,
      timestamps: ['2026-05-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'],
      series: [],
    };
    service.computeIndicatorsTimeline = jest
      .fn()
      .mockResolvedValue(mockTimelineResponse);

    const result = await controller.getIndicatorsTimeline('proj1', {
      startDate: '2026-05-15',
      endDate: '2026-06-15',
    });

    expect(service.computeIndicatorsTimeline).toHaveBeenCalledWith('proj1', {
      startDate: '2026-05-15',
      endDate: '2026-06-15',
    });
    expect(result).toEqual(mockTimelineResponse);
  });
});
