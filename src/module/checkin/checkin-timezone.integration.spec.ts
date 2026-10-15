import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CheckinService } from './checkin.service';
import { CheckInDao } from './persistence/checkin.dao';
import { MoveDao } from './persistence/move.dao';
import { TaskService } from '../task/task.service';
import { UserService } from '../auth/users/user.service';
import { ProjectService } from '../project/project.service';
import { GamificationService } from '../gamification/gamification.service';
import { GamificationEngineFactory } from '../gamification/entities/engine/gamification/gamification-strategy-factory';
import { StorageService } from '../storage/storage.service';
import { CheckinIdempotencyDao } from './persistence/checkin-idempotency.dao';
import { BasicPointsEngine } from '../gamification/entities/engine/gamification/basic-points-engine';
import { BasicBadgeEngine } from '../gamification/entities/engine/gamification/basic-badge-engine';
import { PointsFirstLBEngine } from '../gamification/entities/engine/gamification/basic-leaderboard-engine';
import { Project } from '../project/entities/project';
import { User } from '../auth/users/user.entity';
import { Task } from '../task/entities/task.entity';
import { TimeInterval } from '../task/entities/time-restriction.entity';
import {
  Gamification,
  PointRule,
} from '../gamification/entities/gamification.entity';
import {
  GamificationStrategy,
  LeaderboardStrategy,
  RecommendationStrategy,
  FeatureCollection,
  Feature,
} from '../project/dto/create-project.dto';
import { CreateCheckinDto } from './dto/create-checkin.dto';

describe('CheckinService Timezone Integration (E2E)', () => {
  let service: CheckinService;

  const mockCheckInDao = {
    create: jest.fn((c) => Promise.resolve({ _id: 'checkin-123', ...c })),
    findAllByProjectIdAndUser: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };

  const mockMoveDao = {
    create: jest.fn().mockResolvedValue({}),
  };

  const mockTaskService = {
    findByProjectId: jest.fn(),
    findOne: jest.fn(),
    setTaskAsSolved: jest.fn(),
  };

  const mockUserService = {
    getByUserId: jest.fn(),
    findAllByProjectId: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  };

  const mockProjectService = {
    findOne: jest.fn(),
  };

  const mockGamificationService = {
    saveMove: jest.fn().mockResolvedValue({}),
  };

  const mockStorageService = {
    uploadFile: jest.fn().mockResolvedValue('file-key'),
  };

  const mockIdempotencyDao = {
    findByKey: jest.fn().mockResolvedValue(null),
    record: jest.fn().mockResolvedValue({}),
  };

  // Real gamification engine factory using real basic points/badge/leaderboard engines
  const realGamificationFactory = {
    getBadgeEngine: jest.fn(() => new BasicBadgeEngine()),
    getPointsEngine: jest.fn(() => new BasicPointsEngine()),
    getLeaderboardEngine: jest.fn(() => new PointsFirstLBEngine()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinService,
        { provide: CheckInDao, useValue: mockCheckInDao },
        { provide: MoveDao, useValue: mockMoveDao },
        { provide: TaskService, useValue: mockTaskService },
        { provide: UserService, useValue: mockUserService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: GamificationService, useValue: mockGamificationService },
        { provide: StorageService, useValue: mockStorageService },
        {
          provide: GamificationEngineFactory,
          useValue: realGamificationFactory,
        },
        { provide: CheckinIdempotencyDao, useValue: mockIdempotencyDao },
      ],
    }).compile();

    service = module.get<CheckinService>(CheckinService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const testArea: Feature = {
    type: 'Feature',
    properties: { id: 'area-1', name: 'Parque Quilmes' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-58.28, -34.7],
          [-58.26, -34.7],
          [-58.26, -34.72],
          [-58.28, -34.72],
          [-58.28, -34.7],
        ],
      ],
    },
  };

  const testAreasCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [testArea],
  };

  function createTestProject(params: {
    id: string;
    timezone: string;
    timeIntervals: TimeInterval[];
    pointRules?: PointRule[];
  }): Project {
    const gamification = new Gamification(
      params.id,
      [],
      params.pointRules || [],
    );
    return new Project(
      params.id,
      'Test Citizen Science Project',
      'Description',
      'img.jpg',
      'http://test.org',
      true, // available
      testAreasCollection,
      ['Aves'],
      params.timeIntervals,
      'owner-1',
      gamification,
      GamificationStrategy.BASIC,
      LeaderboardStrategy.POINTS_FIRST,
      RecommendationStrategy.SIMPLE,
      false, // manualLocation
      params.timezone,
    );
  }

  function createTestUser(
    projectIds: string[] = ['proj-ba'],
    id = 'user-1',
  ): User {
    const user = new User('test@test.com', 'volunteer', 'pass', 'Volunteer');
    user.id = id;
    for (const pid of projectIds) {
      user.addProject(pid);
    }
    user.addBadgeFromProject = jest.fn();
    user.addContribution = jest.fn();
    return user;
  }

  describe('Scenario 1: Resolution of the Northflank Bug (Buenos Aires Project with UTC Host Clock)', () => {
    it('should successfully contribute to morning task when collaborator submits at 09:30 ART (12:30 UTC)', async () => {
      // Fake server time at 12:35 UTC (5 minutes after observation was captured)
      jest.useFakeTimers().setSystemTime(new Date('2026-10-14T12:35:00.000Z'));

      const projectTz = 'America/Argentina/Buenos_Aires';
      const morningInterval = new TimeInterval(
        'Mañana',
        [1, 2, 3, 4, 5], // Lunes a Viernes
        { start: '08:00:00', end: '12:00:00' },
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-12-31T23:59:59.999Z'),
        projectTz,
      );

      const morningRule = new PointRule(
        'rule-morning',
        'proj-ba',
        'Aves',
        'area-1',
        'Mañana',
        100,
        true, // mustContribute
      );

      const project = createTestProject({
        id: 'proj-ba',
        timezone: projectTz,
        timeIntervals: [morningInterval],
        pointRules: [morningRule],
      });

      const task = new Task(
        'task-birds-morning',
        'Censo de Aves Mañana',
        'Registrar aves entre 8 y 12 hs',
        'proj-ba',
        morningInterval,
        testArea,
        'Aves',
        false, // not solved yet
      );

      const user = createTestUser(['proj-ba']);
      mockProjectService.findOne.mockResolvedValue(project);
      mockTaskService.findByProjectId.mockResolvedValue([task]);
      mockTaskService.findOne.mockResolvedValue(task);
      mockUserService.getByUserId.mockResolvedValue(user);
      mockUserService.findAllByProjectId.mockResolvedValue([user]);

      // Wednesday Oct 14, 2026 at 09:30:00 ART -> Mobile sends UTC ISO string:
      const dto: CreateCheckinDto = {
        datetime: new Date('2026-10-14T12:30:00.000Z'),
        latitude: '-34.71',
        longitude: '-58.27',
        projectId: 'proj-ba',
        userId: 'user-1',
        taskType: 'Aves',
      };

      const result = await service.create({ createCheckinDto: dto });

      // Verifications:
      // 1. Task should match and be solved
      expect(result.contributesTo).toBeDefined();
      expect(result.contributesTo?.id).toBe('task-birds-morning');
      expect(mockTaskService.setTaskAsSolved).toHaveBeenCalledWith(
        'task-birds-morning',
      );
      expect(user.addContribution).toHaveBeenCalledWith('task-birds-morning');

      // 2. Real points engine awarded 100 points
      const gameStatus =
        (result as any)._gameStatus || (result as any).gameStatus;
      expect(gameStatus.newPoints).toBe(100);

      // 3. Client captured timestamp was preserved (not overwritten with server arrival time)
      const savedCheckin = mockCheckInDao.create.mock.calls[0][0];
      expect(savedCheckin.date.toISOString()).toBe('2026-10-14T12:30:00.000Z');
    });

    it('should NOT contribute when collaborator submits outside interval in Buenos Aires (13:30 ART = 16:30 UTC)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-14T16:35:00.000Z'));

      const projectTz = 'America/Argentina/Buenos_Aires';
      const morningInterval = new TimeInterval(
        'Mañana',
        [1, 2, 3, 4, 5],
        { start: '08:00:00', end: '12:00:00' },
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-12-31T23:59:59.999Z'),
        projectTz,
      );

      const project = createTestProject({
        id: 'proj-ba',
        timezone: projectTz,
        timeIntervals: [morningInterval],
      });

      const task = new Task(
        'task-birds-morning',
        'Censo de Aves Mañana',
        'Registrar aves',
        'proj-ba',
        morningInterval,
        testArea,
        'Aves',
      );

      const user = createTestUser(['proj-ba']);
      mockProjectService.findOne.mockResolvedValue(project);
      mockTaskService.findByProjectId.mockResolvedValue([task]);
      mockUserService.getByUserId.mockResolvedValue(user);
      mockUserService.findAllByProjectId.mockResolvedValue([user]);

      // Wednesday Oct 14, 2026 at 13:30:00 ART -> 16:30:00 UTC (outside 08:00 - 12:00 window)
      const dto: CreateCheckinDto = {
        datetime: new Date('2026-10-14T16:30:00.000Z'),
        latitude: '-34.71',
        longitude: '-58.27',
        projectId: 'proj-ba',
        userId: 'user-1',
        taskType: 'Aves',
      };

      const result = await service.create({ createCheckinDto: dto });

      expect(result.contributesTo).toBeUndefined();
      expect(mockTaskService.setTaskAsSolved).not.toHaveBeenCalled();
      const gameStatus =
        (result as any)._gameStatus || (result as any).gameStatus;
      expect(gameStatus.newPoints).toBe(0);
    });
  });

  describe('Scenario 2: Sunday Night Rollover Across Midnight in UTC', () => {
    it('should correctly match Sunday-only restriction when checkin is at 22:30 ART on Sunday (Monday 01:30 UTC)', async () => {
      // Fake server time at 01:35 UTC Monday
      jest.useFakeTimers().setSystemTime(new Date('2026-10-19T01:35:00.000Z'));

      const projectTz = 'America/Argentina/Buenos_Aires';
      const sundayInterval = new TimeInterval(
        'Domingo Noche',
        [7], // Sunday only
        { start: '20:00:00', end: '23:30:00' },
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-12-31T23:59:59.999Z'),
        projectTz,
      );

      const sundayRule = new PointRule(
        'rule-sunday',
        'proj-ba',
        'Aves',
        'area-1',
        'Domingo Noche',
        50,
        true,
      );

      const project = createTestProject({
        id: 'proj-ba',
        timezone: projectTz,
        timeIntervals: [sundayInterval],
        pointRules: [sundayRule],
      });

      const task = new Task(
        'task-sunday-night',
        'Censo Nocturno Dominical',
        'Domingos de 20 a 23:30 hs',
        'proj-ba',
        sundayInterval,
        testArea,
        'Aves',
      );

      const user = createTestUser(['proj-ba']);
      mockProjectService.findOne.mockResolvedValue(project);
      mockTaskService.findByProjectId.mockResolvedValue([task]);
      mockTaskService.findOne.mockResolvedValue(task);
      mockUserService.getByUserId.mockResolvedValue(user);
      mockUserService.findAllByProjectId.mockResolvedValue([user]);

      // Sunday Oct 18, 2026 at 22:30:00 ART -> Mobile sends Monday Oct 19 at 01:30:00 UTC!
      const dto: CreateCheckinDto = {
        datetime: new Date('2026-10-19T01:30:00.000Z'),
        latitude: '-34.71',
        longitude: '-58.27',
        projectId: 'proj-ba',
        userId: 'user-1',
        taskType: 'Aves',
      };

      const result = await service.create({ createCheckinDto: dto });

      expect(result.contributesTo).toBeDefined();
      expect(result.contributesTo?.id).toBe('task-sunday-night');
      const gameStatus =
        (result as any)._gameStatus || (result as any).gameStatus;
      expect(gameStatus.newPoints).toBe(50);
    });
  });

  describe('Scenario 3: Multi-Project Timezone Independence (Madrid vs Buenos Aires)', () => {
    it('should evaluate the same UTC instant according to each project specific timezone', async () => {
      // Fake server time at 14:35 UTC Wednesday Oct 14, 2026
      jest.useFakeTimers().setSystemTime(new Date('2026-10-14T14:35:00.000Z'));

      // 14:30:00 UTC on Wednesday Oct 14, 2026:
      // - In Madrid (UTC+2 CEST): local time is 16:30 (Afternoon)
      // - In Buenos Aires (UTC-3 ART): local time is 11:30 (Morning)
      const sameUtcInstant = new Date('2026-10-14T14:30:00.000Z');

      // Madrid project: afternoon task (16:00 - 18:00)
      const madridInterval = new TimeInterval(
        'Tarde Madrid',
        [1, 2, 3, 4, 5],
        { start: '16:00:00', end: '18:00:00' },
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-12-31T23:59:59.999Z'),
        'Europe/Madrid',
      );
      const madridProject = createTestProject({
        id: 'proj-madrid',
        timezone: 'Europe/Madrid',
        timeIntervals: [madridInterval],
      });
      const madridTask = new Task(
        'task-madrid-afternoon',
        'Tarde Retiro',
        'Tarde',
        'proj-madrid',
        madridInterval,
        testArea,
        'Aves',
      );

      // Buenos Aires project: morning task (10:00 - 12:00)
      const baInterval = new TimeInterval(
        'Mañana BA',
        [1, 2, 3, 4, 5],
        { start: '10:00:00', end: '12:00:00' },
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-12-31T23:59:59.999Z'),
        'America/Argentina/Buenos_Aires',
      );
      const baProject = createTestProject({
        id: 'proj-ba',
        timezone: 'America/Argentina/Buenos_Aires',
        timeIntervals: [baInterval],
      });
      const baTask = new Task(
        'task-ba-morning',
        'Mañana Quilmes',
        'Mañana',
        'proj-ba',
        baInterval,
        testArea,
        'Aves',
      );

      const user = createTestUser(['proj-madrid', 'proj-ba']);
      mockUserService.getByUserId.mockResolvedValue(user);
      mockUserService.findAllByProjectId.mockResolvedValue([user]);

      // Test 1: Submit to Madrid project at 14:30 UTC -> local 16:30 Madrid -> Matches 16:00-18:00!
      mockProjectService.findOne.mockResolvedValue(madridProject);
      mockTaskService.findByProjectId.mockResolvedValue([madridTask]);
      mockTaskService.findOne.mockResolvedValue(madridTask);

      const resMadrid = await service.create({
        createCheckinDto: {
          datetime: sameUtcInstant,
          latitude: '-34.71',
          longitude: '-58.27',
          projectId: 'proj-madrid',
          userId: 'user-1',
          taskType: 'Aves',
        },
      });
      expect(resMadrid.contributesTo?.id).toBe('task-madrid-afternoon');

      // Test 2: Submit same instant to Buenos Aires project at 14:30 UTC -> local 11:30 BA -> Matches 10:00-12:00!
      mockProjectService.findOne.mockResolvedValue(baProject);
      mockTaskService.findByProjectId.mockResolvedValue([baTask]);
      mockTaskService.findOne.mockResolvedValue(baTask);

      const resBA = await service.create({
        createCheckinDto: {
          datetime: sameUtcInstant,
          latitude: '-34.71',
          longitude: '-58.27',
          projectId: 'proj-ba',
          userId: 'user-1',
          taskType: 'Aves',
        },
      });
      expect(resBA.contributesTo?.id).toBe('task-ba-morning');
    });
  });

  describe('Scenario 4: Future Checkin Tolerance Bounds', () => {
    it('should accept check-in within clock drift tolerance (5 minutes in future)', async () => {
      const now = new Date('2026-10-14T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      const project = createTestProject({
        id: 'proj-drift',
        timezone: 'America/Argentina/Buenos_Aires',
        timeIntervals: [],
      });
      mockProjectService.findOne.mockResolvedValue(project);
      mockTaskService.findByProjectId.mockResolvedValue([]);
      const user = createTestUser(['proj-drift']);
      mockUserService.getByUserId.mockResolvedValue(user);
      mockUserService.findAllByProjectId.mockResolvedValue([user]);

      const nearFutureDate = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes ahead
      const dto: CreateCheckinDto = {
        datetime: nearFutureDate,
        latitude: '-34.71',
        longitude: '-58.27',
        projectId: 'proj-drift',
        userId: 'user-1',
        taskType: 'Aves',
      };

      const result = await service.create({ createCheckinDto: dto });
      expect(result).toBeDefined();
      expect(mockCheckInDao.create).toHaveBeenCalled();
    });

    it('should reject check-in beyond tolerance threshold (20 minutes in future)', async () => {
      const now = new Date('2026-10-14T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      const project = createTestProject({
        id: 'proj-future',
        timezone: 'America/Argentina/Buenos_Aires',
        timeIntervals: [],
      });
      mockProjectService.findOne.mockResolvedValue(project);

      const farFutureDate = new Date(now.getTime() + 20 * 60 * 1000); // 20 minutes ahead
      const dto: CreateCheckinDto = {
        datetime: farFutureDate,
        latitude: '-34.71',
        longitude: '-58.27',
        projectId: 'proj-future',
        userId: 'user-1',
        taskType: 'Aves',
      };

      await expect(service.create({ createCheckinDto: dto })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create({ createCheckinDto: dto })).rejects.toThrow(
        'Check-in timestamp cannot be in the future',
      );
      expect(mockCheckInDao.create).not.toHaveBeenCalled();
    });
  });
});
