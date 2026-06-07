import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  FilterQuery,
  HydratedDocument,
  Model,
  PipelineStage,
  Types,
} from 'mongoose';
import { GeoUtils } from '../task/utils/geoUtils';
import { TimeInterval } from '../task/entities/time-restriction.entity';
import {
  TaskSchemaTemplate,
  TaskDocument,
} from '../task/persistence/task.schema';
import { AdminCheckinQueryDto } from '../checkin/dto/admin-checkin-query.dto';
import {
  CheckInDocument,
  CheckInTemplate,
} from '../checkin/persistence/checkin.schema';
import { MoveDocument, MoveTemplate } from '../checkin/persistence/move.schema';
import {
  ProjectDocument,
  ProjectTemplate,
} from '../project/persistence/project.schema';
import { UserDocument, UserTemplate } from '../auth/users/user.schema';
import {
  ActiveUsersSeries,
  AreaStat,
  CommunityStats,
  ContributionRate,
  Granularity,
  IntervalStat,
  PointsSeries,
  StrategyBreakdown,
  SummaryStats,
  TaskTypeStat,
  TimeSeries,
} from './analytics.types';

@Injectable()
export class AnalyticsDao {
  constructor(
    @InjectModel(CheckInTemplate.collectionName())
    private readonly checkinModel: Model<CheckInDocument>,

    @InjectModel(MoveTemplate.collectionName())
    private readonly moveModel: Model<MoveDocument>,

    @InjectModel(ProjectTemplate.collectionName())
    private readonly projectModel: Model<ProjectDocument>,

    @InjectModel(UserTemplate.collectionName())
    private readonly userModel: Model<UserDocument>,

    @InjectModel(TaskSchemaTemplate.collectionName())
    private readonly taskModel: Model<TaskDocument>,
  ) {}

  private buildDateBucket(granularity: Granularity, field: string) {
    const d = `$${field}`;
    if (granularity === 'day') {
      return { $dateToString: { format: '%Y-%m-%d', date: d } };
    }
    if (granularity === 'week') {
      return {
        $dateFromParts: {
          isoWeekYear: { $isoWeekYear: d },
          isoWeek: { $isoWeek: d },
          isoDayOfWeek: 1,
        },
      };
    }
    return { $dateToString: { format: '%Y-%m-01', date: d } };
  }

  private lookupByStringId(from: string, localField: string, as: string) {
    return {
      $lookup: {
        from,
        let: { refId: `$${localField}` },
        pipeline: [
          { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$refId'] } } },
        ],
        as,
      },
    };
  }

  private projectMatch(projectId?: string) {
    return projectId ? [{ $match: { projectId } }] : [];
  }

  private dateRangeMatch(
    field: string,
    startDate?: string,
    endDate?: string,
  ): PipelineStage[] {
    if (!startDate && !endDate) return [];
    const cond: Record<string, Date> = {};
    if (startDate) cond.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      cond.$lte = end;
    }
    return [{ $match: { [field]: cond } } as PipelineStage];
  }

  private buildDateFilter(field: string, startDate?: string, endDate?: string) {
    if (!startDate && !endDate) return {};
    const cond: Record<string, Date> = {};
    if (startDate) cond.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      cond.$lte = end;
    }
    return { [field]: cond };
  }

  async checkinsOverTime(
    projectId: string | undefined,
    granularity: Granularity,
    startDate?: string,
    endDate?: string,
  ): Promise<TimeSeries[]> {
    return this.checkinModel.aggregate([
      ...this.projectMatch(projectId),
      ...this.dateRangeMatch('datetime', startDate, endDate),
      {
        $group: {
          _id: this.buildDateBucket(granularity, 'datetime'),
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, period: '$_id', count: 1 } },
    ]);
  }

  async activeUsersOverTime(
    projectId: string | undefined,
    granularity: Granularity,
    startDate?: string,
    endDate?: string,
  ): Promise<ActiveUsersSeries[]> {
    return this.checkinModel.aggregate([
      ...this.projectMatch(projectId),
      ...this.dateRangeMatch('datetime', startDate, endDate),
      {
        $group: {
          _id: {
            period: this.buildDateBucket(granularity, 'datetime'),
            userId: '$userId',
          },
        },
      },
      {
        $group: {
          _id: '$_id.period',
          uniqueUsers: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, period: '$_id', uniqueUsers: 1 } },
    ]);
  }

  async byStrategy(): Promise<StrategyBreakdown[]> {
    return this.checkinModel.aggregate([
      this.lookupByStringId('projects', 'projectId', 'project'),
      { $unwind: '$project' },
      {
        $lookup: {
          from: 'moves',
          let: { cid: { $toString: '$_id' } },
          pipeline: [{ $match: { $expr: { $eq: ['$checkinId', '$$cid'] } } }],
          as: 'move',
        },
      },
      { $unwind: { path: '$move', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$projectId',
          projectName: { $first: '$project.name' },
          gamificationStrategy: { $first: '$project.gamificationStrategy' },
          recommendationStrategy: { $first: '$project.recommendationStrategy' },
          leaderboardStrategy: { $first: '$project.leaderboardStrategy' },
          checkinCount: { $sum: 1 },
          totalPoints: { $sum: { $ifNull: ['$move.newPoints', 0] } },
          users: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          _id: 0,
          projectId: '$_id',
          projectName: 1,
          gamificationStrategy: 1,
          recommendationStrategy: 1,
          leaderboardStrategy: 1,
          checkinCount: 1,
          avgPointsPerCheckin: {
            $cond: [
              { $eq: ['$checkinCount', 0] },
              0,
              { $divide: ['$totalPoints', '$checkinCount'] },
            ],
          },
          activeUsers: { $size: '$users' },
        },
      },
    ]);
  }

  async pointsOverTime(
    projectId: string | undefined,
    granularity: Granularity,
    startDate?: string,
    endDate?: string,
  ): Promise<PointsSeries[]> {
    return this.moveModel.aggregate([
      ...this.dateRangeMatch('timestamp', startDate, endDate),
      ...(projectId
        ? [
            this.lookupByStringId('checkins', 'checkinId', 'checkin'),
            { $unwind: '$checkin' },
            { $match: { 'checkin.projectId': projectId } },
          ]
        : []),
      {
        $group: {
          _id: this.buildDateBucket(granularity, 'timestamp'),
          totalPoints: { $sum: '$newPoints' },
          checkinCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          period: '$_id',
          totalPoints: 1,
          avgPointsPerCheckin: {
            $cond: [
              { $eq: ['$checkinCount', 0] },
              0,
              { $divide: ['$totalPoints', '$checkinCount'] },
            ],
          },
        },
      },
    ]);
  }

  async contributionRate(projectId?: string): Promise<ContributionRate[]> {
    return this.checkinModel.aggregate([
      ...this.projectMatch(projectId),
      {
        $group: {
          _id: '$projectId',
          total: { $sum: 1 },
          withContribution: {
            $sum: {
              $cond: [{ $gt: [{ $strLenCP: '$contributesTo' }, 0] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'projects',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$pid'] } } },
          ],
          as: 'project',
        },
      },
      { $unwind: '$project' },
      {
        $project: {
          _id: 0,
          projectId: '$_id',
          projectName: '$project.name',
          total: 1,
          withContribution: 1,
          rate: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $divide: ['$withContribution', '$total'] },
            ],
          },
        },
      },
    ]);
  }

  async badgeAcquisitionOverTime(
    projectId: string | undefined,
    granularity: Granularity,
    startDate?: string,
    endDate?: string,
  ): Promise<TimeSeries[]> {
    return this.moveModel.aggregate([
      ...this.dateRangeMatch('timestamp', startDate, endDate),
      ...(projectId
        ? [
            this.lookupByStringId('checkins', 'checkinId', 'checkin'),
            { $unwind: '$checkin' },
            { $match: { 'checkin.projectId': projectId } },
          ]
        : []),
      { $unwind: '$newBadges' },
      {
        $group: {
          _id: this.buildDateBucket(granularity, 'timestamp'),
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, period: '$_id', count: 1 } },
    ]);
  }

  async summary(
    projectId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<SummaryStats> {
    const dateFilter = this.buildDateFilter('datetime', startDate, endDate);
    const baseMatch = { ...(projectId ? { projectId } : {}), ...dateFilter };

    const [checkins, activeUsers, badgesResult, pointsResult] =
      await Promise.all([
        this.checkinModel.countDocuments(baseMatch),
        this.checkinModel.distinct('userId', baseMatch),
        this.moveModel.aggregate([
          ...this.dateRangeMatch('timestamp', startDate, endDate),
          ...(projectId
            ? [
                this.lookupByStringId('checkins', 'checkinId', 'checkin'),
                { $unwind: '$checkin' },
                { $match: { 'checkin.projectId': projectId } },
              ]
            : []),
          { $unwind: '$newBadges' },
          { $count: 'total' },
        ]),
        this.moveModel.aggregate([
          ...this.dateRangeMatch('timestamp', startDate, endDate),
          ...(projectId
            ? [
                this.lookupByStringId('checkins', 'checkinId', 'checkin'),
                { $unwind: '$checkin' },
                { $match: { 'checkin.projectId': projectId } },
              ]
            : []),
          { $group: { _id: null, total: { $sum: '$newPoints' } } },
        ]),
      ]);

    const contributionData = await this.contributionRate(projectId);
    const totalContrib = contributionData.reduce(
      (s, p) => s + p.withContribution,
      0,
    );
    const totalAll = contributionData.reduce((s, p) => s + p.total, 0);

    return {
      totalCheckins: checkins,
      totalActiveUsers: activeUsers.length,
      overallContributionRate: totalAll === 0 ? 0 : totalContrib / totalAll,
      totalBadgesEarned: badgesResult[0]?.total ?? 0,
      totalPointsAwarded: pointsResult[0]?.total ?? 0,
    };
  }

  /**
   * Builds community-level statistics for a project's check-ins, grouped by
   * area, task type and time interval. Each group reports the check-in count,
   * and areas also accumulate the points and badges awarded by the related
   * `Move`.
   *
   * `query` carries the optional admin filters (badge, task name/type, user,
   * photos, contribution, date range and geo radius). It is bound by NestJS
   * from the query string of `GET /analytics/project/:projectId/community-stats`
   * (`@Query() query: AdminCheckinQueryDto` in `AnalyticsController`); the DTO is
   * the same one used by the admin check-in listing endpoint.
   *
   * The work is split into helpers: `buildCommunityStatsFilter` turns the query
   * into a Mongo filter, `applyGeoRadiusFilter` narrows results to a geographic
   * radius in memory, and `buildCommunityStatsResult` performs the aggregation.
   */
  async communityStats(
    projectId: string,
    query?: AdminCheckinQueryDto,
  ): Promise<CommunityStats> {
    const project = await this.projectModel.findById(projectId).exec();
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const { filter, hasNoResults } = await this.buildCommunityStatsFilter(
      projectId,
      query,
    );
    if (hasNoResults) {
      return { byArea: [], byTaskType: [], byInterval: [] };
    }

    let checkins = await this.checkinModel.find(filter).exec();
    checkins = AnalyticsDao.applyGeoRadiusFilter(checkins, query);

    const checkinIds = checkins.map((c) => c._id.toString());
    const moves = await this.moveModel
      .find({ checkinId: { $in: checkinIds } })
      .exec();
    const moveByCheckinId = new Map<string, MoveDocument>(
      moves.map((m) => [m.checkinId, m]),
    );

    return this.buildCommunityStatsResult(project, checkins, moveByCheckinId);
  }

  /**
   * Translates the admin query filters into a Mongo filter for check-ins.
   *
   * Returns `hasNoResults: true` when a filter (badge or task name) matches
   * nothing, so the caller can short-circuit with an empty response instead of
   * running a query that can never match.
   */
  private async buildCommunityStatsFilter(
    projectId: string,
    query?: AdminCheckinQueryDto,
  ): Promise<{ filter: FilterQuery<CheckInDocument>; hasNoResults: boolean }> {
    const filter: FilterQuery<CheckInDocument> = { projectId };

    if (!query) {
      return { filter, hasNoResults: false };
    }

    if (query.taskType && query.taskType.trim().length > 0) {
      filter.taskType = query.taskType.trim();
    }

    if (query.userId && query.userId.trim().length > 0) {
      filter.userId = query.userId.trim();
    }

    if (query.badgeName && query.badgeName.trim().length > 0) {
      const moves = await this.moveModel
        .find({ newBadges: query.badgeName.trim() })
        .exec();
      const checkinIdIn = moves.map((m) => m.checkinId);
      if (checkinIdIn.length === 0) {
        return { filter, hasNoResults: true };
      }
      filter._id = { $in: checkinIdIn };
    }

    if (query.taskName && query.taskName.trim().length > 0) {
      const taskIdIn = await this.findTaskIdsByName(projectId, query.taskName);
      if (taskIdIn.length === 0) {
        return { filter, hasNoResults: true };
      }
      filter.contributesTo = { $in: taskIdIn };
    } else if (query.contributed === 'true') {
      filter.contributesTo = { $nin: [null, ''] };
    } else if (query.contributed === 'false') {
      filter.$or = [
        { contributesTo: { $exists: false } },
        { contributesTo: null },
        { contributesTo: '' },
      ];
    }

    if (query.hasPhotos === 'true') {
      filter['imageRefs.0'] = { $exists: true };
    } else if (query.hasPhotos === 'false') {
      filter.$and = [
        ...((filter.$and as object[]) || []),
        {
          $or: [{ imageRefs: { $exists: false } }, { imageRefs: { $size: 0 } }],
        },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      const datetime: { $gte?: Date; $lte?: Date } = {};
      if (query.dateFrom) {
        datetime.$gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setUTCHours(23, 59, 59, 999);
        datetime.$lte = end;
      }
      filter.datetime = datetime;
    }

    return { filter, hasNoResults: false };
  }

  /**
   * Resolves the ids of a project's tasks whose name or description contains
   * `taskName` (case-insensitive, partial match). The match is pushed down to
   * Mongo so we don't load every project task into memory.
   */
  private async findTaskIdsByName(
    projectId: string,
    taskName: string,
  ): Promise<string[]> {
    let projIdObj: Types.ObjectId | string;
    try {
      projIdObj = new Types.ObjectId(projectId);
    } catch {
      projIdObj = projectId;
    }
    const rx = new RegExp(AnalyticsDao.escapeRegExp(taskName.trim()), 'i');
    const tasks = await this.taskModel
      .find({ projectId: projIdObj, $or: [{ name: rx }, { description: rx }] })
      .exec();
    return tasks.map((t) => t._id.toString());
  }

  /** Escapes regex metacharacters so user input is matched literally. */
  private static escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Narrows check-ins to those within `radiusKm` of the query's lat/lng centre.
   * Returns the input unchanged when the radius filter is absent or invalid.
   */
  private static applyGeoRadiusFilter<
    T extends { latitude: string; longitude: string },
  >(checkins: T[], query?: AdminCheckinQueryDto): T[] {
    if (!query || !query.latitude || !query.longitude || !query.radiusKm) {
      return checkins;
    }
    const centerLat = parseFloat(query.latitude);
    const centerLng = parseFloat(query.longitude);
    const radiusKm = parseFloat(query.radiusKm);
    if (
      Number.isNaN(centerLat) ||
      Number.isNaN(centerLng) ||
      Number.isNaN(radiusKm) ||
      radiusKm <= 0
    ) {
      return checkins;
    }
    return checkins.filter((c) =>
      AnalyticsDao.withinRadius(
        Number(c.latitude),
        Number(c.longitude),
        centerLat,
        centerLng,
        radiusKm,
      ),
    );
  }

  /**
   * Aggregates check-ins into per-area, per-task-type and per-interval counts,
   * attributing each check-in's points and badges (from its `Move`) to the area
   * whose polygon contains it (or "Outside Area" when none match).
   */
  private buildCommunityStatsResult(
    project: ProjectDocument,
    checkins: HydratedDocument<CheckInDocument>[],
    moveByCheckinId: Map<string, MoveDocument>,
  ): CommunityStats {
    const areas = project.areas?.features || [];
    const intervals = (project.timeIntervals || []).map(
      (ti) =>
        new TimeInterval(
          ti.name,
          ti.days,
          ti.time,
          new Date(ti.startDate),
          new Date(ti.endDate),
        ),
    );

    const areaStatsMap = new Map<string, Omit<AreaStat, 'areaId'>>();
    for (const area of areas) {
      const areaId = area.properties.id || area.properties.name || 'Unknown';
      const areaName = area.properties.name || areaId;
      areaStatsMap.set(areaId.toString(), {
        areaName,
        checkinsCount: 0,
        totalPoints: 0,
        totalBadges: 0,
      });
    }
    areaStatsMap.set('Outside Area', {
      areaName: 'Fuera de Área',
      checkinsCount: 0,
      totalPoints: 0,
      totalBadges: 0,
    });

    const taskTypeStatsMap = new Map<string, number>();
    const intervalStatsMap = new Map<string, number>();

    for (const ch of checkins) {
      const move = moveByCheckinId.get(ch._id.toString());
      const points = move?.newPoints || 0;
      const badgesCount = move?.newBadges?.length || 0;

      let matchedAreaId = 'Outside Area';
      for (const area of areas) {
        const areaId = area.properties.id || area.properties.name || 'Unknown';
        if (
          GeoUtils.isPointInPolygon(
            parseFloat(ch.longitude),
            parseFloat(ch.latitude),
            area.geometry,
          )
        ) {
          matchedAreaId = areaId.toString();
          break;
        }
      }

      const areaStat = areaStatsMap.get(matchedAreaId);
      if (areaStat) {
        areaStat.checkinsCount++;
        areaStat.totalPoints += points;
        areaStat.totalBadges += badgesCount;
      }

      const tType = ch.taskType || 'Unknown';
      taskTypeStatsMap.set(tType, (taskTypeStatsMap.get(tType) || 0) + 1);

      let matchedInterval = 'Cualquiera';
      for (const ti of intervals) {
        if (ti.satisfy(ch.datetime)) {
          matchedInterval = ti.name;
          break;
        }
      }
      intervalStatsMap.set(
        matchedInterval,
        (intervalStatsMap.get(matchedInterval) || 0) + 1,
      );
    }

    const byArea: AreaStat[] = Array.from(areaStatsMap.entries()).map(
      ([areaId, val]) => ({ areaId, ...val }),
    );
    const byTaskType: TaskTypeStat[] = Array.from(
      taskTypeStatsMap.entries(),
    ).map(([taskType, checkinsCount]) => ({ taskType, checkinsCount }));
    const byInterval: IntervalStat[] = Array.from(
      intervalStatsMap.entries(),
    ).map(([timeIntervalId, checkinsCount]) => ({
      timeIntervalId,
      checkinsCount,
    }));

    return { byArea, byTaskType, byInterval };
  }

  private static withinRadius(
    lat: number,
    lng: number,
    centerLat: number,
    centerLng: number,
    radiusKm: number,
  ): boolean {
    if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat - centerLat);
    const dLng = toRad(lng - centerLng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(centerLat)) *
        Math.cos(toRad(lat)) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const EARTH_RADIUS_KM = 6371;
    return EARTH_RADIUS_KM * c <= radiusKm;
  }
}
