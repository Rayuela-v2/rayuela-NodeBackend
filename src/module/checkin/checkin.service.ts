import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { UpdateCheckinDto } from './dto/update-checkin.dto';
import { AdminCheckinQueryDto } from './dto/admin-checkin-query.dto';
import { AdminCheckinFilter, CheckInDao } from './persistence/checkin.dao';
import { TaskService } from '../task/task.service';
import { Task } from '../task/entities/task.entity';
import { Checkin } from './entities/checkin.entity';
import { UserService } from '../auth/users/user.service';
import { Move } from './entities/move.entity';
import { GameBuilder } from './entities/game.entity';
import { ProjectService, UserStatus } from '../project/project.service';
import { MoveDao } from './persistence/move.dao';
import { GamificationService } from '../gamification/gamification.service';
import { Project } from '../project/entities/project';
import { User } from '../auth/users/user.entity';
import { GamificationEngineFactory } from '../gamification/entities/engine/gamification/gamification-strategy-factory';
import { StorageService } from '../storage/storage.service';
import { CheckinIdempotencyDao } from './persistence/checkin-idempotency.dao';

@Injectable()
export class CheckinService {
  private readonly logger = new Logger(CheckinService.name);

  constructor(
    private readonly checkInDao: CheckInDao,
    private readonly moveDao: MoveDao,
    private readonly taskService: TaskService,
    private readonly userService: UserService,
    private readonly projectService: ProjectService,
    private readonly gamificationService: GamificationService,
    private readonly gamificationFactory: GamificationEngineFactory,
    private readonly storageService: StorageService,
    private readonly idempotencyDao: CheckinIdempotencyDao,
  ) {}

  async create(params: {
    createCheckinDto: CreateCheckinDto;
    files?: Express.Multer.File[];
    /**
     * Optional `Idempotency-Key` value sent by the mobile outbox. When
     * present we look up the key first and replay the previous result
     * if it matches the same user; collisions across users get a 409.
     * See `docs/OFFLINE_SYNC_PLAN.md` §8 #1 for the rationale.
     */
    idempotencyKey?: string;
  }) {
    const { createCheckinDto, files, idempotencyKey } = params;

    if (idempotencyKey) {
      const replay = await this.maybeReplay(
        idempotencyKey,
        createCheckinDto.userId,
      );
      if (replay) return replay;
    }

    const { tasks, user, users, checkin, project } =
      await this.getDataFromDB(createCheckinDto);

    if (!project.available) {
      throw new ConflictException('The project is not running');
    }

    if (files && files.length > 0) {
      const uploadPromises = files.map((file) =>
        this.storageService.uploadFile(
          file,
          `checkins/${createCheckinDto.userId}`,
        ),
      );
      const imageRefs = await Promise.all(uploadPromises);
      checkin.imageRefs = imageRefs;
    }

    const game = this.buildGame(tasks, users, project);

    checkin.contributesTo = tasks
      .find((t) => t.contributesToCheckin(checkin))
      ?.getId();
    const gameStatus = game.play(checkin);
    const move = new Move(checkin, gameStatus);

    user.addBadgeFromProject(
      gameStatus.newBadges.map((b) => b.name),
      createCheckinDto.projectId,
    );

    const c = await this.checkInDao.create(checkin);
    checkin.id = c['_id'];
    await this.moveDao.create(move);
    const contribution = tasks.find(
      (t) => t.getId() === move.checkin.contributesTo,
    );

    if (contribution) {
      contribution.setSolved(true);
      user.addContribution(contribution.getId());
      await this.taskService.setTaskAsSolved(contribution.getId());
    }

    await this.userService.update(user.id, user);
    await this.gamificationService.saveMove(move);

    if (idempotencyKey) {
      // Best-effort: the row is created; record the key so future
      // retries replay this same result. A duplicate-key error means
      // another concurrent request already won the race for the same
      // key + user, which is fine.
      try {
        await this.idempotencyDao.record({
          key: idempotencyKey,
          userId: createCheckinDto.userId,
          checkinId: String(checkin.id),
        });
      } catch (e) {
        this.logger.warn(
          `Idempotency key ${idempotencyKey} could not be recorded: ${e}`,
        );
      }
    }

    return {
      ...this.buildCreateResponse(move, contribution),
    };
  }

  /**
   * Look up [idempotencyKey]. When the row exists for the same
   * [userId], rehydrate the original check-in and return the same
   * envelope shape `create` would have returned, with a `replayed: true`
   * flag the controller surfaces in the response header. When the row
   * exists for a different user we throw 409 —
   * collisions only happen if a UUID was reused across accounts, which
   * is essentially impossible for v4 ids and signals tampering.
   */
  private async maybeReplay(idempotencyKey: string, userId: string) {
    const hit = await this.idempotencyDao.findByKey(idempotencyKey);
    if (!hit) return null;
    if (hit.userId !== userId) {
      throw new ConflictException(
        'Idempotency-Key is already in use by another account',
      );
    }
    const original = await this.checkInDao.findOne(hit.checkinId);
    const contribution = original.contributesTo
      ? await this.taskService.findOne(original.contributesTo)
      : undefined;

    // We deliberately do NOT recompute gameStatus on replay: the first
    // call already awarded points/badges and persisted them.
    const replayMove = new Move(original, {
      newBadges: [],
      newPoints: 0,
      newLeaderboard: [],
    });

    return this.buildCreateResponse(replayMove, contribution, true);
  }

  private buildCreateResponse(
    move: Move,
    contribution?: Task,
    replayed = false,
  ) {
    return {
      id: move.checkin.id,
      ...move,
      ...(replayed ? { replayed } : {}),
      contributesTo: contribution && {
        name: contribution.name,
        id: contribution.getId(),
      },
    };
  }

  private buildGame(
    tasks: Task[],
    users: User[],
    project: Project & { user?: UserStatus },
  ) {
    const badgeEngine = this.gamificationFactory.getBadgeEngine(
      project.gamificationStrategy,
    );
    const pointsEngine = this.gamificationFactory.getPointsEngine(
      project.gamificationStrategy,
    );
    const leaderboardEngine = this.gamificationFactory.getLeaderboardEngine(
      project.leaderboardStrategy,
    );
    return new GameBuilder()
      .withBadgeEngine(badgeEngine)
      .withPointsEngine(pointsEngine)
      .withLeaderboardEngine(leaderboardEngine)
      .withTasks(tasks)
      .withUsers(users)
      .withProject(project)
      .build();
  }

  async findAll() {
    return this.checkInDao.findAll();
  }

  async findOne(id: string) {
    return this.checkInDao.findOne(id);
  }

  async update(id: string, updateCheckinDto: UpdateCheckinDto) {
    return this.checkInDao.update(id, updateCheckinDto);
  }

  async remove(id: string) {
    return this.checkInDao.remove(id);
  }

  findByProjectId(userId: string, projectId: string) {
    return this.checkInDao.findByProjectId(userId, projectId);
  }

  /**
   * Admin endpoint: list every checkin for the project with optional filters
   * and pagination. The "task name" filter is resolved here because tasks
   * live in their own collection — we look them up first and pass the
   * matching ids down to the DAO. Each checkin in the response is enriched
   * with `taskName` so the admin doesn't have to cross-reference manually.
   */
  async findForAdmin(projectId: string, query: AdminCheckinQueryDto) {
    const limit = clamp(
      parseIntSafe(query.limit, ADMIN_DEFAULT_LIMIT),
      1,
      ADMIN_MAX_LIMIT,
    );
    const page = Math.max(1, parseIntSafe(query.page, 1));

    let taskIdIn: string[] | undefined;
    let projectTasks: Task[] | null = null;
    if (query.taskName && query.taskName.trim().length > 0) {
      projectTasks = await this.taskService.findByProjectId(projectId);
      const needle = query.taskName.trim().toLowerCase();
      taskIdIn = projectTasks
        .filter(
          (t) =>
            (t.name && t.name.toLowerCase().includes(needle)) ||
            (t.description && t.description.toLowerCase().includes(needle)),
        )
        .map((t) => t.getId().toString());
      // No tasks match → return an empty page early to spare a Mongo round-trip.
      if (taskIdIn.length === 0) {
        return { items: [], total: 0, page, limit };
      }
    }

    const filter: AdminCheckinFilter = {
      projectId,
      taskType: query.taskType?.trim() || undefined,
      userId: query.userId?.trim() || undefined,
      taskIdIn,
      hasPhotos: parseBool(query.hasPhotos),
      contributed: parseBool(query.contributed),
      dateFrom: parseDate(query.dateFrom),
      dateTo: parseDate(query.dateTo),
      centerLat: parseFloatSafe(query.latitude),
      centerLng: parseFloatSafe(query.longitude),
      radiusKm: parseFloatSafe(query.radiusKm),
      page,
      limit,
      sortOrder: query.sortOrder === 'asc' ? 1 : -1,
    };

    const result = await this.checkInDao.findForAdmin(filter);

    // Skip the task-enrichment DB call when there is nothing to enrich.
    if (result.items.length === 0) {
      return { items: [], total: result.total, page: result.page, limit: result.limit };
    }

    // Build an id→task map once so the response can include task name + type.
    if (!projectTasks) {
      projectTasks = await this.taskService.findByProjectId(projectId);
    }
    const taskById = new Map<string, Task>(
      projectTasks.map((t) => [t.getId().toString(), t]),
    );
    const items = result.items.map((c: any) => {
      const plain = typeof c.toObject === 'function' ? c.toObject() : c;
      const task = plain.contributesTo
        ? taskById.get(plain.contributesTo.toString())
        : undefined;
      return {
        ...plain,
        taskName: task?.name || null,
        taskDescription: task?.description || null,
      };
    });

    return {
      items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  private async getDataFromDB(createCheckinDto: CreateCheckinDto) {
    const tasks: Task[] = await this.taskService.findByProjectId(
      createCheckinDto.projectId,
    );
    const user = await this.userService.getByUserId(createCheckinDto.userId);
    const users = await this.userService.findAllByProjectId(
      createCheckinDto.projectId,
    );
    const checkin = Checkin.fromDTO(createCheckinDto, user);
    const project = await this.projectService.findOne(
      createCheckinDto.projectId,
    );
    return { tasks, user, users, checkin, project };
  }

  async rate(params: { checkinId: string; rate: number; userId: string }) {
    const ch = await this.findOne(params.checkinId);
    return this.userService.rate(params.userId, ch, params.rate);
  }
}

const ADMIN_DEFAULT_LIMIT = 20;
const ADMIN_MAX_LIMIT = 100;

function parseIntSafe(value: string | undefined, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseFloatSafe(value: string | undefined): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
