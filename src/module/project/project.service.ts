import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectDao } from './persistence/project.dao';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectTemplate } from './persistence/project.schema';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserService } from '../auth/users/user.service';
import { Project } from './entities/project';
import { getTaskTypeName } from './entities/task-type';
import { BadgeRule } from '../gamification/entities/gamification.entity';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { Leaderboard } from '../leaderboard/persistence/leaderboard-user-schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CheckInTemplate,
  CheckInDocument,
} from '../checkin/persistence/checkin.schema';
import { CheckinMapper } from '../checkin/persistence/CheckinMapper';
import { BasicBadgeEngine } from '../gamification/entities/engine/gamification/basic-badge-engine';

export interface UserStatus {
  isSubscribed: boolean;
  badges: BadgeRule[];
  points: number;
  leaderboard: Leaderboard;
}

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectDao: ProjectDao,
    private readonly userService: UserService,
    private readonly leaderboardService: LeaderboardService,
    @InjectModel(CheckInTemplate.collectionName())
    private readonly checkInModel: Model<CheckInDocument>,
  ) {}

  async findAll(): Promise<(ProjectTemplate & { _id: string })[]> {
    return this.projectDao.findAll().then((res) => res.map((p) => p['_doc']));
  }

  async findOne(
    id: string,
    userId?: string,
  ): Promise<Project & { user?: UserStatus }> {
    const project = await this.projectDao.findOne(id);
    if (userId) {
      const user = await this.userService.getByUserId(userId);
      const gp = user.getGameProfileFromProject(project.id);

      const checkinDocs = await this.checkInModel
        .find({ projectId: project.id, userId })
        .sort({ datetime: 1 })
        .exec();
      const checkins = checkinDocs.map((c) => CheckinMapper.toEntity(c, null));
      const badgeEngine = new BasicBadgeEngine();
      const memo = new Map<string, boolean>();

      return {
        ...project,
        user: gp && {
          isSubscribed: user.isSubscribedToProject(project.id),
          badges: project.gamification.badgesRules.map((b) => ({
            ...b,
            active: gp.badges.includes(b.name),
            satisfied: badgeEngine.isBadgeSatisfied(
              b,
              checkins,
              project,
              gp.badges || [],
              memo,
            ),
          })),
          points: gp?.points,
          leaderboard: await this.leaderboardService.getLeaderboardFor(
            project.id,
          ),
        },
      };
    }
    return project;
  }

  async create(createProjectDto: CreateProjectDto): Promise<ProjectTemplate> {
    return this.projectDao.create(createProjectDto);
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectTemplate> {
    const p = this.projectDao.update(id, updateProjectDto);
    return p;
  }

  async toggleAvailable(id: string): Promise<void> {
    return this.projectDao.toggleAvailable(id);
  }

  async getTaskCombinations(id: string) {
    const project: Project = await this.projectDao.findOne(id);
    if (!project) {
      throw new NotFoundException('Project not Found');
    }
    const combinations = [];
    project.areas.features.map((area) => {
      project.taskTypes.forEach((typeObj) => {
        const typeName = getTaskTypeName(typeObj);
        project.timeIntervals.forEach((timeInterval) => {
          combinations.push([
            {
              id,
              name: `T${combinations.length + 1}`,
              description: `T${combinations.length + 1}`,
              projectId: id,
              timeInterval,
              area,
              type: typeName,
            },
          ]);
        });
      });
    });
    return combinations;
  }

  findOnePublic(id: string) {
    return this.projectDao.findOne(id);
  }
}
