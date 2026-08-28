import { Test, TestingModule } from '@nestjs/testing';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('TaskController', () => {
  let controller: TaskController;
  let service: TaskService;

  const mockTaskService = {
    bulkSave: jest.fn(),
    removeUselessFrom: jest.fn(),
    create: jest.fn(),
    findRawByProjectId: jest.fn(),
    findForAdmin: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [{ provide: TaskService, useValue: mockTaskService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TaskController>(TaskController);
    service = module.get<TaskService>(TaskService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call bulkSave', async () => {
    await controller.postBulk('p1', []);
    expect(service.bulkSave).toHaveBeenCalledWith('p1', []);
  });

  it('should call removeUselessFromProject', async () => {
    await controller.removeUselessFromProject('p1');
    expect(service.removeUselessFrom).toHaveBeenCalledWith('p1');
  });

  it('should call create', async () => {
    const dto = { name: 't1' } as any;
    // Mock CreateTaskDto.fromDTO if needed, but since it's a static method on the class itself
    // and we're just testing the controller call, we can mock the service.create
    await controller.create(dto);
    expect(service.create).toHaveBeenCalled();
  });

  it('should call findForAdmin', async () => {
    await controller.findForAdmin('p1');
    expect(service.findForAdmin).toHaveBeenCalledWith('p1');
  });

  it('should call findAllByProject', async () => {
    const req = { user: { username: 'u1' } };
    await controller.findAllByProject('p1', req);
    expect(service.findRawByProjectId).toHaveBeenCalledWith('p1', 'u1');
  });

  it('should call findOne', async () => {
    await controller.findOne('1');
    expect(service.findOne).toHaveBeenCalledWith('1');
  });

  it('should call update', async () => {
    const dto = {} as any;
    await controller.update('1', dto);
    expect(service.update).toHaveBeenCalledWith('1', dto);
  });

  it('should call remove', async () => {
    await controller.remove('1');
    expect(service.remove).toHaveBeenCalledWith('1');
  });
});
