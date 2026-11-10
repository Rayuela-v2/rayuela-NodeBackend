import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectDao } from './persistence/project.dao';
import {
  CreateProjectDto,
  GamificationStrategy,
  LeaderboardStrategy,
  RecommendationStrategy,
} from './dto/create-project.dto';
import { ProjectTemplate } from './persistence/project.schema';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserService } from '../auth/users/user.service';
import { Project } from './entities/project';
import { getTaskTypeName } from './entities/task-type';
import {
  BadgeRule,
  effectiveBadgeStatus,
} from '../gamification/entities/gamification.entity';
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
    const now = new Date();

    // Resolve the fading window once, server-side, so no client has to
    // re-derive `faded` vs `expired` against its own clock — mobile caches
    // this payload and reads it back offline, where "now" is anyone's guess.
    // `expiresAt` still ships raw so the countdown stays live.
    const resolved = this.withEffectiveBadgeStatus(project, now);

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
        ...resolved,
        user: gp && {
          isSubscribed: user.isSubscribedToProject(project.id),
          badges: resolved.gamification.badgesRules.map((b) => ({
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
    return resolved;
  }

  /** Copy of the project whose badge rules report their status as of [now]. */
  private withEffectiveBadgeStatus(project: Project, now: Date): Project {
    return {
      ...project,
      gamification: {
        ...project.gamification,
        badgesRules: project.gamification.badgesRules.map((b) => ({
          ...b,
          status: effectiveBadgeStatus(b, now),
        })),
      },
    };
  }

  async create(createProjectDto: CreateProjectDto): Promise<ProjectTemplate> {
    this.assertStrategiesAreKnown(createProjectDto);
    return this.projectDao.create(createProjectDto);
  }

  /**
   * Rejects strategy values that aren't in the enums.
   *
   * The project schema stores these as plain strings with no `enum`, and
   * updates go through `findByIdAndUpdate` without `runValidators`, so a typo
   * lands in Mongo unchallenged. It surfaces much later and much worse:
   * `GamificationEngineFactory` throws on an unknown strategy, so every
   * check-in on that project starts failing — no points, no badges.
   *
   * Written by hand rather than with `class-validator` decorators because the
   * package isn't installed and there is no global `ValidationPipe`; the
   * decorators would be inert metadata that only looks like a guard.
   *
   * Undefined is left alone so partial updates keep working.
   */
  private assertStrategiesAreKnown(
    dto: Partial<CreateProjectDto> | UpdateProjectDto,
  ): void {
    const checks: Array<[string, unknown, Record<string, string>]> = [
      ['gamificationStrategy', dto.gamificationStrategy, GamificationStrategy],
      [
        'recommendationStrategy',
        dto.recommendationStrategy,
        RecommendationStrategy,
      ],
      ['leaderboardStrategy', dto.leaderboardStrategy, LeaderboardStrategy],
    ];

    for (const [field, value, allowed] of checks) {
      if (value === undefined || value === null) continue;
      const values: string[] = Object.values(allowed);
      if (!values.includes(value as string)) {
        throw new BadRequestException(
          `${field} inválido: "${value}". Valores permitidos: ${values.join(', ')}`,
        );
      }
    }
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectTemplate> {
    this.assertStrategiesAreKnown(updateProjectDto);
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
