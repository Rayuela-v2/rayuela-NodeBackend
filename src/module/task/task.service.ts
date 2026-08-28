import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskDao } from './persistence/task.dao';
import { Task } from './entities/task.entity';
import { ProjectService } from '../project/project.service';
import { BasicPointsEngine } from '../gamification/entities/engine/gamification/basic-points-engine';
import { UserService } from '../auth/users/user.service';
import { RecommendationEngineFactory } from '../gamification/entities/engine/recommendation/recommendation-engine-factory';

@Injectable()
export class TaskService {
  constructor(
    private readonly taskDao: TaskDao,
    private readonly projectService: ProjectService,
    private readonly userService: UserService,
    private readonly recommendationFactory: RecommendationEngineFactory,
  ) {}

  async create(createTaskDto: CreateTaskDto) {
    const project = await this.projectService.findOne(createTaskDto.projectId);
    if (!project.taskTypes.includes(createTaskDto.type)) {
      throw new BadRequestException('Task type is invalid');
    }
    const area = project.areas.features.find(
      (a) => a.properties.id === createTaskDto.areaId,
    );
    if (!area) {
      throw new BadRequestException('Area not found');
    }
    return await this.taskDao.create(createTaskDto);
  }

  async findRawByProjectId(projectId: string, username: string): Promise<any> {
    const allTasks = await this.taskDao.getRawTasksByProject(projectId);
    const user = await this.userService.findByEmailOrUsername('', username);
    const users = await this.userService.findAllByProjectId(projectId);
    const project = await this.projectService.findOne(projectId);
    const recommendationEngine = this.recommendationFactory.getEngine(
      project.recommendationStrategy,
    );

    const recommendations = recommendationEngine.generateRecommendations(
      user,
      Object.fromEntries(user.ratings.map((r) => [r.taskId, r.score])),
      allTasks,
    );
    return recommendations.map((tr) => ({
      ...tr.task.toJSON(),
      solvedBy: users.find((u) => {
        return u.contributions
          .map((id) => id.toString())
          .includes(tr.task.getId().toString());
      })?.username,
      points: new BasicPointsEngine().calculatePoints(tr.task, project),
    }));
  }

  async findForAdmin(projectId: string): Promise<any[]> {
    const tasks = await this.taskDao.getTasksByProject(projectId);
    return tasks.map((task) => task.toJSON());
  }

  async findByProjectId(projectId: string): Promise<Task[]> {
    return await this.taskDao.getTasksByProject(projectId);
  }

  async findOne(id: string): Promise<Task> {
    const task: Task = await this.taskDao.getTaskById(id);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto) {
    return await this.taskDao.updateTask(id, updateTaskDto);
  }

  async remove(id: string) {
    return await this.taskDao.deleteTask(id);
  }

  async bulkSave(projectId: string, createTaskDtoList: CreateTaskDto[]) {
    await this.taskDao.deleteByProjectId(projectId);
    return await this.taskDao.bulkSave(createTaskDtoList);
  }

  async setTaskAsSolved(id: string) {
    return await this.taskDao.setTaskAsSolved(id);
  }

  async removeUselessFrom(projectId: string) {
    const p = await this.projectService.findOne(projectId);
    return await this.taskDao.deleteUseless(p);
  }
}
