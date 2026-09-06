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
  IndicatorComputationContext,
  PlayerEarnedBadge,
  PlayerProfile,
} from './domain/indicator.types';
import { GetIndicatorsQueryDto } from './dto/get-indicators-query.dto';
import { CommunityIndicatorsResponseDto } from './dto/indicators-response.dto';
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
    const daysPerPeriod = Math.max(1, Number(query?.daysPerPeriod) || 7);
    const startDate = query?.startDate
      ? this.parseDate(query.startDate, 'start', 'startDate')
      : undefined;
    const asOfDate = query?.asOfDate
      ? this.parseDate(query.asOfDate, 'end', 'asOfDate')
      : new Date();

    if (startDate && startDate.getTime() > asOfDate.getTime()) {
      throw new BadRequestException('startDate cannot be after asOfDate');
    }

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

    // Index moves by checkinId for quick lookup
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
      return {
        id: chId,
        userId: c.userId || c.user?.id || (c as any).userId,
        datetime: new Date(c.date),
        taskType: c.taskType,
        contributesTo: c.contributesTo,
        newBadges: move?.newBadges || [],
      };
    });

    // Build player profiles and resolve earned badges with timestamps & contribution counts
    const players: PlayerProfile[] = rawUsers.map((u) => {
      const earnedBadges = new Map<string, PlayerEarnedBadge>();
      const projectProfile = u.getGameProfileFromProject(projectId);
      const profileBadges = projectProfile?.badges || [];

      // Find user check-ins sorted chronologically
      const userCheckins = checkins
        .filter((c) => c.userId === u.id)
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

      // Fallback for badges in profile not captured in moves
      profileBadges.forEach((badgeName) => {
        const matchedBadge = badges.find(
          (b) => b.name === badgeName || b.id === badgeName,
        );
        if (matchedBadge && !earnedBadges.has(matchedBadge.id)) {
          earnedBadges.set(matchedBadge.id, {
            badgeId: matchedBadge.id,
            earnedAt: u.createdAt || asOfDate,
            contribsAtEarn: runningContribCount,
          });
        }
      });

      return {
        id: u.id,
        joinDate: u.createdAt || asOfDate,
        earnedBadges,
      };
    });

    const minActiveCheckins = query.minActiveCheckins
      ? parseInt(String(query.minActiveCheckins), 10)
      : 1;

    // 5. Build computation context and delegate to formula strategy
    const ctx: IndicatorComputationContext = {
      projectId,
      badges,
      players,
      checkins,
      startDate,
      asOfDate,
      daysPerPeriod,
      minActiveCheckins: isNaN(minActiveCheckins) ? 1 : minActiveCheckins,
    };

    return this.formulaStrategy.calculateIndicators(ctx);
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
