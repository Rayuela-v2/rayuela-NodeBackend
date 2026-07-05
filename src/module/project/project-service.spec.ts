import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { ProjectDao } from './persistence/project.dao';
import { UserService } from '../auth/users/user.service';
import { NotFoundException } from '@nestjs/common';
import ProjectBuilder from './project.builder';
import { User } from '../auth/users/user.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { BadgeRule } from '../gamification/entities/gamification.entity';
import { getModelToken } from '@nestjs/mongoose';
import { CheckInTemplate } from '../checkin/persistence/checkin.schema';

const mockCheckInModel = {
  find: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
};

const mockProjectDao = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  toggleAvailable: jest.fn(),
};

const mockUserService = {
  getByUserId: jest.fn(),
};

const mockLeaderboardService = {
  getLeaderboardFor: jest.fn(),
};

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: ProjectDao, useValue: mockProjectDao },
        { provide: UserService, useValue: mockUserService },
        { provide: LeaderboardService, useValue: mockLeaderboardService },
        {
          provide: getModelToken(CheckInTemplate.collectionName()),
          useValue: mockCheckInModel,
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a project', async () => {
      const dto: CreateProjectDto = {} as any;
      const project = ProjectBuilder.build();
      mockProjectDao.create.mockResolvedValue(project);

      const result = await service.create(dto);

      expect(mockProjectDao.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(project);
    });
  });

  describe('findAll', () => {
    it('should find all projects and return their _doc property', async () => {
      const projects = [{ _doc: ProjectBuilder.build() }];
      mockProjectDao.findAll.mockResolvedValue(projects);

      const result = await service.findAll();

      expect(mockProjectDao.findAll).toHaveBeenCalled();
      expect(result).toEqual([projects[0]._doc]);
    });
  });

  describe('findOne', () => {
    it('should find a project by id without user status', async () => {
      const project = ProjectBuilder.build();
      mockProjectDao.findOne.mockResolvedValue(project);
      const result = await service.findOne('p1');
      expect(result).toEqual(project);
      expect(mockUserService.getByUserId).not.toHaveBeenCalled();
    });

    it('should find a project and include user status if userId is provided', async () => {
      const project = ProjectBuilder.withId('p1').build();
      project.gamification.badgesRules = [
        { name: 'badge1' } as BadgeRule,
        { name: 'badge2' } as BadgeRule,
      ];
      const user = new User('a', 'b', 'c', 'd');
      const gameProfile = { points: 100, badges: ['badge1'] };
      user.getGameProfileFromProject = jest.fn().mockReturnValue(gameProfile);
      user.isSubscribedToProject = jest.fn().mockReturnValue(true);
      mockProjectDao.findOne.mockResolvedValue(project);
      mockUserService.getByUserId.mockResolvedValue(user);
      mockLeaderboardService.getLeaderboardFor.mockResolvedValue([]);

      const result = await service.findOne('p1', 'u1');

      expect(result).toHaveProperty('user');
      expect(result.user.isSubscribed).toBe(true);
      expect(result.user.points).toBe(100);
      expect(result.user.badges[0]['active']).toBe(true);
      expect(result.user.badges[1]['active']).toBe(false);
    });

    it('should handle user status when user has no game profile for the project', async () => {
      const project = ProjectBuilder.withId('p1').build();
      const user = new User('a', 'b', 'c', 'd');
      user.getGameProfileFromProject = jest.fn().mockReturnValue(null);
      mockProjectDao.findOne.mockResolvedValue(project);
      mockUserService.getByUserId.mockResolvedValue(user);

      const result = await service.findOne('p1', 'u1');

      expect(result.user).toBe(null);
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      const dto: UpdateProjectDto = {};
      const project = ProjectBuilder.build();
      mockProjectDao.update.mockResolvedValue(project);
      const result = await service.update('p1', dto);
      expect(mockProjectDao.update).toHaveBeenCalledWith('p1', dto);
      expect(result).toEqual(project);
    });
  });

  describe('toggleAvailable', () => {
    it('should toggle project availability', async () => {
      await service.toggleAvailable('p1');
      expect(mockProjectDao.toggleAvailable).toHaveBeenCalledWith('p1');
    });
  });

  describe('getTaskCombinations', () => {
    it('should generate task combinations for a project', async () => {
      const project = ProjectBuilder.withAreas({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {} } as any],
      })
        .withTaskTypes(['type1'])
        .withTimeIntervals([{} as any])
        .build();
      mockProjectDao.findOne.mockResolvedValue(project);

      const combinations = await service.getTaskCombinations('p1');

      expect(combinations).toHaveLength(1);
      expect(combinations[0][0].name).toBe('T1');
    });

    it('should throw NotFoundException if project not found', async () => {
      mockProjectDao.findOne.mockResolvedValue(null);
      await expect(service.getTaskCombinations('p1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOnePublic', () => {
    it('should find a public project', async () => {
      const project = ProjectBuilder.build();
      mockProjectDao.findOne.mockResolvedValue(project);
      await service.findOnePublic('p1');
      expect(mockProjectDao.findOne).toHaveBeenCalledWith('p1');
    });
  });
});
