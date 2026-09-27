import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  INDICATOR_FORMULA_STRATEGY,
  IndicatorFormulaStrategy,
} from './domain/formula-strategy.interface';
import {
  BadgeDefinition,
  CheckinRecord,
  CommunityIndicatorResult,
  IndicatorComputationContext,
  PlayerEarnedBadge,
  PlayerProfile,
} from './domain/indicator.types';
import { GetIndicatorsQueryDto } from './dto/get-indicators-query.dto';
import { CommunityIndicatorsResponseDto } from './dto/indicators-response.dto';
import { GetIndicatorsTimelineQueryDto } from './dto/get-indicators-timeline-query.dto';
import { IndicatorsTimelineResponseDto } from './dto/indicators-timeline-response.dto';
import { CheckInDao } from '../checkin/persistence/checkin.dao';
import { UserDao } from '../auth/users/user.dao';
import { GamificationDao } from '../gamification/persistence/gamification-dao.service';
import { MoveDao } from '../checkin/persistence/move.dao';

@Injectable()
export class GamificationIndicatorsService {
  private readonly logger = new Logger(GamificationIndicatorsService.name);

  constructor(
    private readonly checkInDao: CheckInDao,
    private readonly userDao: UserDao,
    private readonly gamificationDao: GamificationDao,
    private readonly moveDao: MoveDao,
    @Inject(INDICATOR_FORMULA_STRATEGY)
    private readonly formulaStrategy: IndicatorFormulaStrategy,
  ) {}

  /**
   * Computes gamification and community interest indicators for a project.
   */
  async computeIndicators(
    projectId: string,
    query?: GetIndicatorsQueryDto,
  ): Promise<CommunityIndicatorsResponseDto> {
    const asOfDate = query?.asOfDate
      ? this.parseDate(query.asOfDate, 'end', 'asOfDate')
      : new Date();

    const threshold = this.parseThreshold(query?.threshold);
    const minActiveCheckins = this.parseMinActiveCheckins(
      query?.minActiveCheckins,
    );

    const { badges, checkins, players } = await this.loadProjectComputationData(
      projectId,
      asOfDate,
    );

    const ctx: IndicatorComputationContext = {
      projectId,
      badges,
      players,
      checkins,
      asOfDate,
      threshold,
      minActiveCheckins,
    };

    return this.formulaStrategy.calculateIndicators(ctx);
  }

  /**
   * Computes historical time-series snapshots of Community Interest (CII) across a date window.
   */
  async computeIndicatorsTimeline(
    projectId: string,
    query?: GetIndicatorsTimelineQueryDto,
  ): Promise<IndicatorsTimelineResponseDto> {
    const threshold = this.parseThreshold(query?.threshold);
    const minActiveCheckins = this.parseMinActiveCheckins(
      query?.minActiveCheckins,
    );

    const endDate = query?.endDate
      ? this.parseDate(query.endDate, 'end', 'endDate')
      : new Date();

    const defaultStart = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = query?.startDate
      ? this.parseDate(query.startDate, 'start', 'startDate')
      : defaultStart;

    if (startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException(
        `startDate (${startDate.toISOString()}) must be before or equal to endDate (${endDate.toISOString()})`,
      );
    }

    const diffDays = Math.max(
      1,
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    let stepDays = 1;
    if (query?.stepDays !== undefined && query?.stepDays !== '') {
      const parsedStep = Number(query.stepDays);
      if (isNaN(parsedStep) || parsedStep <= 0) {
        throw new BadRequestException(
          `Invalid stepDays value: "${query.stepDays}". Must be a positive integer.`,
        );
      }
      stepDays = Math.max(1, Math.floor(parsedStep));
    } else {
      if (diffDays > 60) {
        stepDays = Math.max(1, Math.round(diffDays / 30));
      } else if (diffDays > 14) {
        stepDays = Math.max(1, Math.round(diffDays / 20));
      }
    }

    // Generate sample timestamps
    const sampleDates: Date[] = [];
    let currentMs = startDate.getTime();
    const endMs = endDate.getTime();
    const stepMs = stepDays * 24 * 60 * 60 * 1000;

    while (currentMs < endMs) {
      sampleDates.push(new Date(currentMs));
      currentMs += stepMs;
    }
    // Always include the exact end date as the last point if not already present
    if (
      sampleDates.length === 0 ||
      sampleDates[sampleDates.length - 1].getTime() !== endMs
    ) {
      sampleDates.push(endDate);
    }

    const { badges, checkins, players } = await this.loadProjectComputationData(
      projectId,
      endDate,
    );

    // Filter badges if badgeId query param is supplied
    const targetBadges = query?.badgeId
      ? badges.filter(
          (b) =>
            String(b.id) === String(query.badgeId) || b.name === query.badgeId,
        )
      : badges;

    // Evaluate snapshots across timeline
    const badgePointsMap = new Map<string, (number | null)[]>();
    targetBadges.forEach((b) => badgePointsMap.set(b.id, []));

    let latestSnapshot: CommunityIndicatorResult | null = null;

    for (const sampleDate of sampleDates) {
      const ctx: IndicatorComputationContext = {
        projectId,
        badges,
        players,
        checkins,
        asOfDate: sampleDate,
        threshold,
        minActiveCheckins,
      };

      const result = this.formulaStrategy.calculateIndicators(ctx);
      latestSnapshot = result;

      const resultMap = new Map<string, number | null>();
      result.badges.forEach((b) => {
        resultMap.set(b.badgeId, b.CII);
      });

      targetBadges.forEach((b) => {
        const ciiVal = resultMap.get(b.id) ?? null;
        badgePointsMap.get(b.id)!.push(ciiVal);
      });
    }

    // Build series response
    const series = targetBadges.map((b) => {
      const latestMetric = latestSnapshot?.badges.find(
        (m) => m.badgeId === b.id,
      );
      const points = badgePointsMap.get(b.id) || [];
      const currentCII =
        points.length > 0
          ? points[points.length - 1]
          : latestMetric?.CII ?? null;

      return {
        badgeId: b.id,
        badgeName: b.name,
        status: b.status,
        points,
        isCandidate: latestMetric?.isCandidate ?? false,
        isLowestCII: latestMetric?.isLowestCII ?? false,
        currentCII,
      };
    });

    return {
      projectId,
      threshold,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      stepDays,
      timestamps: sampleDates.map((d) => d.toISOString()),
      series,
    };
  }

  /**
   * Helper to load and assemble raw project data into domain computation models.
   */
  private async loadProjectComputationData(
    projectId: string,
    fallbackDate: Date,
  ): Promise<{
    badges: BadgeDefinition[];
    checkins: CheckinRecord[];
    players: PlayerProfile[];
  }> {
    // 1. Fetch project gamification rules
    const gamification =
      await this.gamificationDao.getGamificationByProjectId(projectId);
    if (!gamification) {
      throw new NotFoundException(
        `Gamification settings not found for project ${projectId}`,
      );
    }

    // 2. Fetch all project check-ins
    const rawCheckins = await this.checkInDao.findAllByProjectId(projectId);

    // 3. Fetch all participating project users
    const rawUsers = await this.userDao.getAllByProjectId(projectId);

    // 4. Fetch moves for checkins to detect badge awards and award timestamps
    const checkinIds = rawCheckins.map((c) => String(c.id)).filter(Boolean);
    const moves =
      checkinIds.length > 0
        ? await this.moveDao.findMovesByCheckinIds(checkinIds)
        : [];

    const moveByCheckinId = new Map<string, any>();
    moves.forEach((m) => {
      moveByCheckinId.set(String(m.checkinId), m);
    });

    // Map badge templates to domain BadgeDefinition
    const badges: BadgeDefinition[] = (gamification.badgesRules || []).map(
      (b) => ({
        id: b._id || b.name,
        name: b.name,
        reqCheckins: b.checkinsAmount || 1,
        previousBadges: b.previousBadges || [],
        status: b.status || 'active',
        fadedSince: b.fadedSince,
        expiresAt: b.expiresAt,
        fadeReason: b.fadeReason,
      }),
    );

    // Transform checkins into domain records
    const checkins: CheckinRecord[] = rawCheckins.map((c) => {
      const chId = String(c.id);
      const move = moveByCheckinId.get(chId);
      const rawUserId = c.userId || c.user?.id || (c as any).userId;
      return {
        id: chId,
        userId: rawUserId ? String(rawUserId) : '',
        datetime: new Date(c.date),
        taskType: c.taskType,
        contributesTo: c.contributesTo,
        newBadges: move?.newBadges || [],
      };
    });

    // Build player profiles
    const players: PlayerProfile[] = rawUsers.map((u) => {
      const uId = String(u.id);
      const earnedBadges = new Map<string, PlayerEarnedBadge>();
      const projectProfile = u.getGameProfileFromProject(projectId);
      const profileBadges = projectProfile?.badges || [];

      const userCheckins = checkins
        .filter((c) => String(c.userId) === uId)
        .sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

      let runningContribCount = 0;
      userCheckins.forEach((c) => {
        runningContribCount++;
        if (c.newBadges && c.newBadges.length > 0) {
          c.newBadges.forEach((badgeRef) => {
            const matchedBadge = badges.find(
              (b) => b.id === badgeRef || b.name === badgeRef,
            );
            if (matchedBadge && !earnedBadges.has(matchedBadge.id)) {
              earnedBadges.set(matchedBadge.id, {
                badgeId: matchedBadge.id,
                earnedAt: c.datetime,
                contribsAtEarn: runningContribCount,
              });
            }
          });
        }
      });

      profileBadges.forEach((badgeName) => {
        const matchedBadge = badges.find(
          (b) => b.name === badgeName || b.id === badgeName,
        );
        if (matchedBadge && !earnedBadges.has(matchedBadge.id)) {
          earnedBadges.set(matchedBadge.id, {
            badgeId: matchedBadge.id,
            earnedAt: u.createdAt || fallbackDate,
            contribsAtEarn: runningContribCount,
          });
        }
      });

      return {
        id: uId,
        joinDate: u.createdAt || fallbackDate,
        earnedBadges,
      };
    });

    return { badges, checkins, players };
  }

  private parseThreshold(thresholdRaw?: number | string): number {
    if (thresholdRaw !== undefined && thresholdRaw !== '') {
      const parsed = Number(thresholdRaw);
      if (isNaN(parsed) || parsed <= 0) {
        throw new BadRequestException(
          `Invalid threshold value: "${thresholdRaw}". Must be a positive number (e.g. 0.20).`,
        );
      }
      return parsed;
    }
    return 0.2;
  }

  private parseMinActiveCheckins(minRaw?: number | string): number {
    if (minRaw !== undefined && minRaw !== '') {
      const parsed = parseInt(String(minRaw), 10);
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Parses date query parameters supporting:
   * - DD-MM-YYYY or DD/MM/YYYY (e.g. "20-07-2026")
   * - ISO-8601 strings (e.g. "2026-07-20" or "2026-07-20T00:00:00.000Z")
   *
   * @param dateStr Raw date string from query
   * @param boundary 'start' sets time to 00:00:00.000, 'end' sets time to 23:59:59.999
   * @param paramName Parameter name for error messages
   */
  private parseDate(
    dateStr: string | undefined,
    boundary: 'start' | 'end',
    paramName: string,
  ): Date {
    if (!dateStr) {
      return new Date();
    }

    const trimmed = dateStr.trim();

    // Check for DD-MM-YYYY or DD/MM/YYYY format
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
      const year = parseInt(ddmmyyyyMatch[3], 10);
      const parsed =
        boundary === 'start'
          ? new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
          : new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    // Standard ISO parse
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `Invalid ${paramName} format: "${dateStr}". Supported formats: DD-MM-YYYY or ISO-8601 (YYYY-MM-DD)`,
      );
    }

    return parsed;
  }
}
