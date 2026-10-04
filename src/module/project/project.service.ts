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
import { StorageService } from '../storage/storage.service';
import { GamificationDao } from '../gamification/persistence/gamification-dao.service';
import http from 'http';
import https from 'https';

export interface UserStatus {
  isSubscribed: boolean;
  badges: BadgeRule[];
  points: number;
  leaderboard: Leaderboard;
}

export interface ImageMigrationResult {
  projectId: string;
  projectImageMigrated: boolean;
  badgesMigratedCount: number;
  failures: string[];
}

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectDao: ProjectDao,
    private readonly userService: UserService,
    private readonly leaderboardService: LeaderboardService,
    @InjectModel(CheckInTemplate.collectionName())
    private readonly checkInModel: Model<CheckInDocument>,
    private readonly storageService: StorageService,
    private readonly gamificationDao: GamificationDao,
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

  /**
   * Downloads an image from an external HTTP/HTTPS URL with timeout and size cap (10MB).
   */
  async fetchImageBuffer(
    url: string,
    timeoutMs = 8000,
  ): Promise<{ buffer: Buffer; mimetype: string }> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(
        url,
        {
          timeout: timeoutMs,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Rayuela/1.0',
          },
        },
        (res) => {
          if (
            res.statusCode &&
            (res.statusCode === 301 || res.statusCode === 302) &&
            res.headers.location
          ) {
            return this.fetchImageBuffer(res.headers.location, timeoutMs)
              .then(resolve)
              .catch(reject);
          }

          if (
            !res.statusCode ||
            res.statusCode < 200 ||
            res.statusCode >= 300
          ) {
            return reject(
              new Error(`Failed to fetch image: HTTP status ${res.statusCode}`),
            );
          }

          const contentType = res.headers['content-type'] || 'image/jpeg';
          const chunks: Buffer[] = [];
          let totalLength = 0;
          const maxBytes = 10 * 1024 * 1024; // 10MB limit

          res.on('data', (chunk: Buffer) => {
            totalLength += chunk.length;
            if (totalLength > maxBytes) {
              req.destroy(new Error('Image exceeds 10MB size limit'));
              return;
            }
            chunks.push(chunk);
          });

          res.on('end', () => {
            resolve({
              buffer: Buffer.concat(chunks),
              mimetype: contentType,
            });
          });
        },
      );

      req.on('timeout', () => {
        req.destroy(new Error(`Timeout fetching image after ${timeoutMs}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Migrates external project cover image and badge images into Garage S3.
   */
  async migrateImages(projectId: string): Promise<ImageMigrationResult> {
    const project = await this.projectDao.findOne(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const failures: string[] = [];
    let projectImageMigrated = false;
    let badgesMigratedCount = 0;

    // 1. Migrate Project Cover Image
    if (
      project.image &&
      (project.image.startsWith('http://') ||
        project.image.startsWith('https://'))
    ) {
      try {
        const { buffer, mimetype } = await this.fetchImageBuffer(project.image);
        const ext = mimetype.includes('png')
          ? 'png'
          : mimetype.includes('webp')
            ? 'webp'
            : 'jpg';
        const optimized = await this.storageService.optimizeImage(
          { buffer, mimetype, originalname: `project-cover.${ext}` },
          { maxDimension: 1600, quality: 80 },
        );
        const key = await this.storageService.uploadFile(
          optimized,
          `projects/${projectId}`,
        );
        await this.projectDao.update(projectId, { image: key });
        projectImageMigrated = true;
      } catch (err: any) {
        failures.push(`Project cover: ${err?.message || err}`);
      }
    }

    // 2. Migrate Badge Images
    const gamificationDoc =
      await this.gamificationDao.getBadgesByProject(projectId);
    if (
      gamificationDoc &&
      gamificationDoc.badges &&
      gamificationDoc.badges.length > 0
    ) {
      for (const badge of gamificationDoc.badges) {
        if (
          badge.imageUrl &&
          (badge.imageUrl.startsWith('http://') ||
            badge.imageUrl.startsWith('https://'))
        ) {
          try {
            const { buffer, mimetype } = await this.fetchImageBuffer(
              badge.imageUrl,
            );
            const ext = mimetype.includes('png')
              ? 'png'
              : mimetype.includes('webp')
                ? 'webp'
                : 'jpg';
            const optimized = await this.storageService.optimizeImage(
              {
                buffer,
                mimetype,
                originalname: `${badge.name || 'badge'}.${ext}`,
              },
              { maxDimension: 512, quality: 85 },
            );
            const key = await this.storageService.uploadFile(
              optimized,
              'badges',
            );
            await this.gamificationDao.updateBadgeImageUrl(
              projectId,
              String(badge._id),
              key,
            );
            badgesMigratedCount++;
          } catch (err: any) {
            failures.push(`Badge "${badge.name}": ${err?.message || err}`);
          }
        }
      }
    }

    return {
      projectId,
      projectImageMigrated,
      badgesMigratedCount,
      failures,
    };
  }
}
