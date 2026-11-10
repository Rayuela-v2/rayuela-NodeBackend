import { Test, TestingModule } from '@nestjs/testing';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { UserService } from '../auth/users/user.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('ProjectController', () => {
  let controller: ProjectController;
  let service: ProjectService;

  const mockProjectService = {
    getTaskCombinations: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    findOnePublic: jest.fn(),
    update: jest.fn(),
    toggleAvailable: jest.fn(),
  };

  const mockUserService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: UserService, useValue: mockUserService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProjectController>(ProjectController);
    service = module.get<ProjectService>(ProjectService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getTaskCombinations', async () => {
    await controller.getTaskCombination('1');
    expect(service.getTaskCombinations).toHaveBeenCalledWith('1');
  });

  it('should call findAll', async () => {
    await controller.findAll();
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should call create', async () => {
    const dto = {} as any;
    const req = { user: { userId: 'u1' } };
    await controller.create(dto, req);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should call findOne', async () => {
    const req = { user: { userId: 'u1' } };
    await controller.findOne('1', req);
    expect(service.findOne).toHaveBeenCalledWith('1', 'u1');
  });

  it('should call findOnePublic', async () => {
    await controller.findOnePublic('1');
    expect(service.findOnePublic).toHaveBeenCalledWith('1');
  });

  it('should call update', async () => {
    const dto = {} as any;
    await controller.update('1', dto);
    expect(service.update).toHaveBeenCalledWith('1', dto);
  });

  it('should call toggleAvailable', async () => {
    await controller.toggleAvailable('1');
    expect(service.toggleAvailable).toHaveBeenCalledWith('1');
  });
});
