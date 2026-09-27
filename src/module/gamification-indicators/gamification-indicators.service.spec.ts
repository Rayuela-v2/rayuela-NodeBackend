import { Test, TestingModule } from '@nestjs/testing';
import { GamificationIndicatorsService } from './gamification-indicators.service';
import { CheckInDao } from '../checkin/persistence/checkin.dao';
import { UserDao } from '../auth/users/user.dao';
import { GamificationDao } from '../gamification/persistence/gamification-dao.service';
import { MoveDao } from '../checkin/persistence/move.dao';
import {
  INDICATOR_FORMULA_STRATEGY,
  IndicatorFormulaStrategy,
} from './domain/formula-strategy.interface';
import { BadRequestException } from '@nestjs/common';
import { Gamification } from '../gamification/entities/gamification.entity';
import { User } from '../auth/users/user.entity';
import { UserRole } from '../auth/users/user.schema';

describe('GamificationIndicatorsService', () => {
  let service: GamificationIndicatorsService;
  let checkInDao: Partial<CheckInDao>;
  let userDao: Partial<UserDao>;
  let gamificationDao: Partial<GamificationDao>;
  let moveDao: Partial<MoveDao>;
  let formulaStrategy: Partial<IndicatorFormulaStrategy>;

  beforeEach(async () => {
    checkInDao = {
      findAllByProjectId: jest.fn().mockResolvedValue([]),
    };
    userDao = {
      getAllByProjectId: jest.fn().mockResolvedValue([]),
    };
    gamificationDao = {
      getGamificationByProjectId: jest
        .fn()
        .mockResolvedValue(new Gamification('proj1', [], [])),
    };
    moveDao = {
      findMovesByCheckinIds: jest.fn().mockResolvedValue([]),
    };
    formulaStrategy = {
      calculateIndicators: jest.fn().mockReturnValue({
        projectId: 'proj1',
        asOfDate: new Date().toISOString(),
        threshold: 0.2,
        totalPlayers: 0,
        activePlayers: 0,
        totalContributions: 0,
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
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationIndicatorsService,
        { provide: CheckInDao, useValue: checkInDao },
        { provide: UserDao, useValue: userDao },
        { provide: GamificationDao, useValue: gamificationDao },
        { provide: MoveDao, useValue: moveDao },
        { provide: INDICATOR_FORMULA_STRATEGY, useValue: formulaStrategy },
      ],
    }).compile();

    service = module.get<GamificationIndicatorsService>(
      GamificationIndicatorsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw BadRequestException if asOfDate is invalid', async () => {
    await expect(
      service.computeIndicators('proj1', { asOfDate: 'invalid-date' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if threshold is invalid or non-positive', async () => {
    await expect(
      service.computeIndicators('proj1', {
        threshold: -0.1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should parse DD-MM-YYYY format for asOfDate and custom threshold', async () => {
    const res = await service.computeIndicators('proj1', {
      asOfDate: '20-07-2026',
      threshold: '0.25',
    });
    expect(res).toBeDefined();
    expect(formulaStrategy.calculateIndicators).toHaveBeenCalledWith(
      expect.objectContaining({
        asOfDate: expect.any(Date),
        threshold: 0.25,
      }),
    );
  });

  it('should fetch data from DAOs and delegate to formulaStrategy', async () => {
    const mockUser = new User(
      'Test User',
      'testuser',
      'test@example.com',
      'pwd',
      null,
      true,
      UserRole.Volunteer,
      'u1',
      [{ projectId: 'proj1', points: 0, badges: ['B1'], active: true }],
      [],
      [],
      [],
      null,
      new Date('2026-06-01T00:00:00.000Z'),
    );

    (userDao.getAllByProjectId as jest.Mock).mockResolvedValue([mockUser]);
    (checkInDao.findAllByProjectId as jest.Mock).mockResolvedValue([
      {
        id: 'c1',
        userId: 'u1',
        user: null,
        date: new Date('2026-06-02T10:00:00.000Z'),
        taskType: 'species',
        contributesTo: 't1',
      },
    ]);
    (moveDao.findMovesByCheckinIds as jest.Mock).mockResolvedValue([
      {
        checkinId: 'c1',
        newBadges: ['B1'],
        timestamp: new Date('2026-06-02T10:00:00.000Z'),
      },
    ]);

    const result = await service.computeIndicators('proj1', {
      asOfDate: '2026-06-15T00:00:00.000Z',
      threshold: 0.2,
    });

    expect(gamificationDao.getGamificationByProjectId).toHaveBeenCalledWith(
      'proj1',
    );
    expect(checkInDao.findAllByProjectId).toHaveBeenCalledWith('proj1');
    expect(userDao.getAllByProjectId).toHaveBeenCalledWith('proj1');
    expect(moveDao.findMovesByCheckinIds).toHaveBeenCalledWith(['c1']);
    expect(formulaStrategy.calculateIndicators).toHaveBeenCalled();
    expect(result.projectId).toBe('proj1');
  });
});
