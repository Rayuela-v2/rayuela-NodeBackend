import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TaskDocument, TaskSchemaTemplate } from './task.schema';
import { Task } from '../entities/task.entity';
import { CreateTaskDto } from '../dto/create-task.dto';
import { ProjectDao } from '../../project/persistence/project.dao';
import { TimeInterval } from '../entities/time-restriction.entity';
import { Project } from '../../project/entities/project';

@Injectable()
export class TaskDao {
  constructor(
    @InjectModel(TaskSchemaTemplate.collectionName())
    private taskModel: Model<TaskDocument>,
    private projectDao: ProjectDao,
  ) {}

  async create(taskData: CreateTaskDto): Promise<TaskDocument> {
    const createdTask = new this.taskModel(taskData);
    return createdTask.save();
  }

  async getTaskById(taskId: string): Promise<Task> {
    const res = await this.taskModel.findById(taskId).exec();
    return await this.mapDocToTask(res['_doc']);
  }

  async getAllTasks(): Promise<TaskDocument[]> {
    return this.taskModel.find().exec();
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    const project: Project = await this.projectDao.findOne(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    const tasks: TaskDocument[] = await this.taskModel
      .find({ projectId })
      .exec();
    if (!tasks) {
      throw new NotFoundException('No tasks found for this project');
    }
    return tasks.map((task) => this.mapDocToTaskWithProject(task, project));
  }

  async updateTask(
    taskId: string,
    taskData: any,
  ): Promise<TaskDocument | null> {
    return this.taskModel
      .findByIdAndUpdate(taskId, taskData, { new: true })
      .exec();
  }

  async deleteTask(taskId: string): Promise<TaskDocument | null> {
    return this.taskModel.findByIdAndDelete(taskId).exec();
  }

  async findByNameOrDescription(
    name: string,
    description: string,
  ): Promise<TaskDocument | null> {
    return this.taskModel.findOne({ $or: [{ name }, { description }] }).exec();
  }

  private mapDocToTaskWithProject(doc: TaskDocument, project: Project): Task {
    const area = project.areas?.features?.find(
      (f) => f.properties?.id?.toString() === doc.areaId?.toString(),
    );
    return new Task(
      doc._id,
      doc.name,
      doc.description,
      doc.projectId.toString(),
      this.mapTimeRestriction(doc.timeIntervalId?.toString(), project),
      area,
      doc.type,
      doc.solved,
    );
  }

  private async mapDocToTask(doc: TaskDocument): Promise<Task> {
    const project: Project = await this.projectDao.findOne(
      doc.projectId.toString(),
    );
    return this.mapDocToTaskWithProject(doc, project);
  }

  private mapTimeRestriction(
    timeIntervalId: string,
    project: Project,
  ): TimeInterval {
    const ti = project.timeIntervals?.find((t) => t.name === timeIntervalId);
    return new TimeInterval(
      ti?.name || 'unavailable',
      ti?.days,
      ti?.time,
      ti?.startDate,
      ti?.endDate,
    );
  }

  async deleteByProjectId(projectId: string): Promise<number> {
    const result = await this.taskModel.deleteMany({ projectId }).exec();
    return result.deletedCount;
  }

  async bulkSave(createTaskDtoList: CreateTaskDto[]): Promise<any> {
    return await this.taskModel.insertMany(createTaskDtoList);
  }

  async getRawTasksByProject(projectId: string): Promise<Task[]> {
    const project: Project = await this.projectDao.findOne(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    const tasks: TaskDocument[] = await this.taskModel
      .find({ projectId })
      .exec();
    if (!tasks) {
      throw new NotFoundException('No tasks found for this project');
    }
    return tasks.map((task) => this.mapDocToTaskWithProject(task, project));
  }

  async setTaskAsSolved(id: string): Promise<TaskDocument | null> {
    const updatedTask = await this.taskModel
      .findByIdAndUpdate(id, { solved: true }, { new: true })
      .exec();

    if (!updatedTask) {
      throw new NotFoundException(`Task with id ${id} not found`);
    }

    return updatedTask;
  }

  async deleteUseless(project: Project): Promise<number> {
    const validTaskTypes = project.taskTypes;
    const validTimeIntervals = project.timeIntervals.map((ti) => ti.name);
    const validAreaIds = project.areas.features.map((f) =>
      f.properties.id?.toString(),
    );

    const result = await this.taskModel
      .deleteMany({
        projectId: project.id,
        $or: [
          { type: { $nin: validTaskTypes } },
          { timeIntervalId: { $nin: validTimeIntervals } },
          { areaId: { $nin: validAreaIds } },
        ],
      })
      .exec();

    return result.deletedCount;
  }
}
