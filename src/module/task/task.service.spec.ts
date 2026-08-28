import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { TaskDao } from './persistence/task.dao';
import { ProjectService } from '../project/project.service';
import { UserService } from '../auth/users/user.service';
import { RecommendationEngineFactory } from '../gamification/entities/engine/recommendation/recommendation-engine-factory';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import ProjectBuilder from '../project/project.builder';
import { User } from '../auth/users/user.entity';
import { UpdateTaskDto } from './dto/update-task.dto';
import TaskBuilder from './task.builder';

const mockTaskDao = {
  create: jest.fn(),
  getRawTasksByProject: jest.fn(),
  getTasksByProject: jest.fn(),
  getTaskById: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  deleteByProjectId: jest.fn(),
  bulkSave: jest.fn(),
  setTaskAsSolved: jest.fn(),
  deleteUseless: jest.fn(),
};

const mockProjectService = {
  findOne: jest.fn(),
};

const mockUserService = {
  findByEmailOrUsername: jest.fn(),
  findAllByProjectId: jest.fn(),
};

const mockRecommendationEngine = {
  generateRecommendations: jest.fn(),
};

const mockRecommendationFactory = {
  getEngine: jest.fn().mockReturnValue(mockRecommendationEngine),
};

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: TaskDao, useValue: mockTaskDao },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: UserService, useValue: mockUserService },
        {
          provide: RecommendationEngineFactory,
          useValue: mockRecommendationFactory,
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a task successfully', async () => {
      const createTaskDto: CreateTaskDto = {
        solved: false,
        timeIntervalId: '',
        projectId: 'p1',
        type: 'type1',
        areaId: 'area1',
        name: 'test',
        description: 'test',
      };
      const project = ProjectBuilder.withTaskTypes(['type1'])
        .withAreas({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: { id: 'area1' } } as any],
        })
        .build();
      mockProjectService.findOne.mockResolvedValue(project);
      mockTaskDao.create.mockResolvedValue({});

      await service.create(createTaskDto);

      expect(mockProjectService.findOne).toHaveBeenCalledWith('p1');
      expect(mockTaskDao.create).toHaveBeenCalledWith(createTaskDto);
    });

    it('should throw BadRequestException for invalid task type', async () => {
      const createTaskDto: CreateTaskDto = {
        solved: false,
        timeIntervalId: '',
        projectId: 'p1',
        type: 'invalid_type',
        areaId: 'area1',
        name: 'test',
        description: 'test',
      };
      const project = ProjectBuilder.withTaskTypes(['type1']).build();
      mockProjectService.findOne.mockResolvedValue(project);

      await expect(service.create(createTaskDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid area', async () => {
      const createTaskDto: CreateTaskDto = {
        solved: false,
        timeIntervalId: '',
        projectId: 'p1',
        type: 'type1',
        areaId: 'invalid_area',
        name: 'test',
        description: 'test',
      };
      const project = ProjectBuilder.withTaskTypes(['type1'])
        .withAreas({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: { id: 'area1' } } as any],
        })
        .build();
      mockProjectService.findOne.mockResolvedValue(project);

      await expect(service.create(createTaskDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findRawByProjectId', () => {
    it('should return recommended tasks with solver and points', async () => {
      const user = new User('a', 'user1', 'p', 'n');
      user.ratings = [{ taskId: 'task1', score: 5, checkinId: 'c1' } as any];
      user.contributions = [];
      const solver = new User('b', 'solver', 'p', 'n');
      solver.contributions = ['task1'];
      const task = TaskBuilder.withId('task1').build();
      const project = ProjectBuilder.build();

      mockTaskDao.getRawTasksByProject.mockResolvedValue([task]);
      mockUserService.findByEmailOrUsername.mockResolvedValue(user);
      mockUserService.findAllByProjectId.mockResolvedValue([user, solver]);
      mockProjectService.findOne.mockResolvedValue(project);
      mockRecommendationEngine.generateRecommendations.mockReturnValue([
        { task, score: 1 },
      ]);

      const result = await service.findRawByProjectId('p1', 'user1');

      expect(result[0].solvedBy).toBe('solver');
      expect(result[0].points).toBeDefined();
    });

    it('should return recommended tasks without solver if not solved', async () => {
      const user = new User('a', 'user1', 'p', 'n');
      user.ratings = [];
      user.contributions = [];
      const task = TaskBuilder.withId('task1').build();
      const project = ProjectBuilder.build();

      mockTaskDao.getRawTasksByProject.mockResolvedValue([task]);
      mockUserService.findByEmailOrUsername.mockResolvedValue(user);
      mockUserService.findAllByProjectId.mockResolvedValue([user]);
      mockProjectService.findOne.mockResolvedValue(project);
      mockRecommendationEngine.generateRecommendations.mockReturnValue([
        { task, score: 1 },
      ]);

      const result = await service.findRawByProjectId('p1', 'user1');

      expect(result[0].solvedBy).toBeUndefined();
    });
  });

  describe('findForAdmin', () => {
    it('should return tasks mapped to JSON for admin', async () => {
      const task = TaskBuilder.withId('task1').build();
      mockTaskDao.getTasksByProject.mockResolvedValue([task]);
      const result = await service.findForAdmin('p1');
      expect(result).toEqual([task.toJSON()]);
      expect(mockTaskDao.getTasksByProject).toHaveBeenCalledWith('p1');
    });
  });

  describe('findByProjectId', () => {
    it('should return tasks for a project', async () => {
      const tasks = [TaskBuilder.build()];
      mockTaskDao.getTasksByProject.mockResolvedValue(tasks);
      const result = await service.findByProjectId('p1');
      expect(result).toEqual(tasks);
      expect(mockTaskDao.getTasksByProject).toHaveBeenCalledWith('p1');
    });
  });

  describe('findOne', () => {
    it('should return a single task', async () => {
      const task = TaskBuilder.build();
      mockTaskDao.getTaskById.mockResolvedValue(task);
      const result = await service.findOne('t1');
      expect(result).toEqual(task);
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskDao.getTaskById.mockResolvedValue(null);
      await expect(service.findOne('t1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const dto: UpdateTaskDto = {};
      await service.update('t1', dto);
      expect(mockTaskDao.updateTask).toHaveBeenCalledWith('t1', dto);
    });
  });

  describe('remove', () => {
    it('should remove a task', async () => {
      await service.remove('t1');
      expect(mockTaskDao.deleteTask).toHaveBeenCalledWith('t1');
    });
  });

  describe('bulkSave', () => {
    it('should delete existing tasks and bulk save new ones', async () => {
      const dtoList: CreateTaskDto[] = [
        {
          name: '',
          description: '',
          projectId: '',
          timeIntervalId: '',
          areaId: '',
          type: '',
          solved: false,
        },
      ];
      await service.bulkSave('p1', dtoList);
      expect(mockTaskDao.deleteByProjectId).toHaveBeenCalledWith('p1');
      expect(mockTaskDao.bulkSave).toHaveBeenCalledWith(dtoList);
    });
  });

  describe('setTaskAsSolved', () => {
    it('should set a task as solved', async () => {
      await service.setTaskAsSolved('t1');
      expect(mockTaskDao.setTaskAsSolved).toHaveBeenCalledWith('t1');
    });
  });

  describe('removeUselessFrom', () => {
    it('should remove useless tasks from a project', async () => {
      const project = ProjectBuilder.build();
      mockProjectService.findOne.mockResolvedValue(project);
      await service.removeUselessFrom('p1');
      expect(mockProjectService.findOne).toHaveBeenCalledWith('p1');
      expect(mockTaskDao.deleteUseless).toHaveBeenCalledWith(project);
    });
  });
});
