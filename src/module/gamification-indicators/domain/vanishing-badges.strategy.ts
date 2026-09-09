import { Injectable } from '@nestjs/common';
import { IndicatorFormulaStrategy } from './formula-strategy.interface';
import {
  BadgeDefinition,
  BadgeIndicatorResult,
  CommunityIndicatorResult,
  IndicatorComputationContext,
  PlayerEarnedBadge,
  PlayerIndicatorResult,
  PlayerProfile,
} from './indicator.types';

/**
 * Standard implementation of the vanishing badges indicator framework:
 * Adaptive Gamification Mechanism for Citizen Science platforms.
 *
 * Encapsulates Definitions 3.1 through 3.5 as pure, stateless mathematical operations.
 */
@Injectable()
export class VanishingBadgesStrategy implements IndicatorFormulaStrategy {
  /**
   * Orchestrates the complete indicator calculation pipeline.
   *
   * 1. Sorts and segments checkins into periods s in S based on `daysPerPeriod`.
   * 2. Resolves earned badge state and historical contributions at time of award.
   * 3. Calculates t_0(p, b) and achievability for each player and badge.
   * 4. Calculates individual interest i_3(p, b) [Def 3.2].
   * 5. Computes badge-level metrics ET_b [Def 3.1] and CII(b) [Def 3.3].
   * 6. Computes player-level motivation PMI(p), relPMI(p) [Def 3.4], and CMI [Def 3.5].
   * 7. Identifies the lowest CII candidate badge for adaptation recommendation.
   */
  calculateIndicators(
    ctx: IndicatorComputationContext,
  ): CommunityIndicatorResult {
    const {
      projectId,
      badges,
      players,
      checkins,
      startDate,
      asOfDate,
      daysPerPeriod,
    } = ctx;

    // Filter checkins up to asOfDate
    const validCheckins = checkins
      .filter((c) => new Date(c.datetime).getTime() <= asOfDate.getTime())
      .sort(
        (a, b) =>
          new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
      );

    /**
     * Timeline Origin Determination for Period Partitioning (Period 1, 2, ...):
     *
     * - IF `startDate` IS PROVIDED:
     *   The timeline explicitly anchors to `startDate`. Period 1 begins on `startDate`.
     *   Contributions occurring prior to `startDate` are excluded from period-over-period
     *   motivation (PMI) evaluation.
     *
     * - IF `startDate` IS NOT PROVIDED (Default Behavior):
     *   The engine dynamically detects the earliest recorded check-in across the project
     *   (`validCheckins[0].datetime`). Period 1 begins at the exact moment the community
     *   started contributing. If no check-ins exist yet (cold start), it defaults to `asOfDate`.
     */
    const timelineStart = startDate
      ? new Date(startDate).getTime()
      : validCheckins.length > 0
        ? new Date(validCheckins[0].datetime).getTime()
        : asOfDate.getTime();

    const periodMs = Math.max(1, daysPerPeriod) * 24 * 60 * 60 * 1000;
    const currentPeriod = Math.max(
      1,
      Math.ceil((asOfDate.getTime() - timelineStart + 1) / periodMs),
    );

    // 1. Group contributions per player and per period
    const playerTotalContribs: Record<string, number> = {};
    const playerPeriodContribs: Record<string, Record<number, number>> = {};
    const playerEarnedBadgesMap: Map<
      string,
      Map<string, PlayerEarnedBadge>
    > = new Map();

    players.forEach((p) => {
      playerTotalContribs[p.id] = 0;
      playerPeriodContribs[p.id] = {};
      playerEarnedBadgesMap.set(p.id, new Map(p.earnedBadges || []));
    });

    validCheckins.forEach((c) => {
      const pId = c.userId;
      if (!playerPeriodContribs[pId]) {
        playerTotalContribs[pId] = 0;
        playerPeriodContribs[pId] = {};
        playerEarnedBadgesMap.set(pId, new Map());
      }

      playerTotalContribs[pId] = (playerTotalContribs[pId] || 0) + 1;
      const checkinTime = new Date(c.datetime).getTime();
      if (checkinTime >= timelineStart) {
        const s = Math.max(
          1,
          Math.ceil((checkinTime - timelineStart + 1) / periodMs),
        );
        playerPeriodContribs[pId][s] = (playerPeriodContribs[pId][s] || 0) + 1;
      }

      // Track newly awarded badges if present on checkin
      if (c.newBadges && c.newBadges.length > 0) {
        c.newBadges.forEach((badgeRef) => {
          const matchedBadge = badges.find(
            (b) => b.id === badgeRef || b.name === badgeRef,
          );
          if (matchedBadge) {
            const playerBadgeMap = playerEarnedBadgesMap.get(pId)!;
            if (!playerBadgeMap.has(matchedBadge.id)) {
              playerBadgeMap.set(matchedBadge.id, {
                badgeId: matchedBadge.id,
                earnedAt: new Date(c.datetime),
                contribsAtEarn: playerTotalContribs[pId],
              });
            }
          }
        });
      }
    });

    // 2. Compute achievability and t_0(p, b) for every player and badge
    const playerBadgeT0: Record<string, Record<string, Date>> = {};
    const playerBadgeAchievable: Record<string, Record<string, boolean>> = {};
    const playerBadgeI3: Record<string, Record<string, number>> = {};

    players.forEach((p) => {
      playerBadgeT0[p.id] = {};
      playerBadgeAchievable[p.id] = {};
      playerBadgeI3[p.id] = {};

      const earned = playerEarnedBadgesMap.get(p.id) || new Map();

      badges.forEach((b) => {
        const { isAchievable, t0Date } = this.computeAchievabilityAndT0(
          p,
          b,
          badges,
          earned,
        );
        playerBadgeAchievable[p.id][b.id] = isAchievable;
        playerBadgeT0[p.id][b.id] = t0Date;

        const isEarned = earned.has(b.id);
        const earnedDate = isEarned ? earned.get(b.id)!.earnedAt : null;

        playerBadgeI3[p.id][b.id] = this.computeIndividualInterest(
          isAchievable,
          isEarned,
          t0Date,
          earnedDate,
          asOfDate,
        );
      });
    });

    // 3. Compute badge metrics: ET_b, eligible pool ep(b), and CII(b)
    const badgeMetrics: BadgeIndicatorResult[] = badges.map((b) => {
      // U_b: Players who have earned badge b
      const UbPlayers: { playerId: string; contribsAtEarn: number }[] = [];
      players.forEach((p) => {
        const earned = playerEarnedBadgesMap.get(p.id);
        if (earned && earned.has(b.id)) {
          UbPlayers.push({
            playerId: p.id,
            contribsAtEarn: earned.get(b.id)!.contribsAtEarn,
          });
        }
      });

      const ET_b = this.computeEstimatedAwardingTime(b, badges, UbPlayers);

      // ep(b): Eligible players who can achieve b but have NOT earned it yet
      const eligiblePlayers = players.filter((p) => {
        const isAchievable = playerBadgeAchievable[p.id]?.[b.id] ?? false;
        const hasEarned = playerEarnedBadgesMap.get(p.id)?.has(b.id) ?? false;
        return isAchievable && !hasEarned;
      });

      const eligibleI3Values = eligiblePlayers.map(
        (p) => playerBadgeI3[p.id][b.id],
      );
      const CII = this.computeCommunityInterest(eligibleI3Values);

      return {
        badgeId: b.id,
        badgeName: b.name,
        status: b.status,
        earnedCount: UbPlayers.length,
        earnedUsers: UbPlayers.map((u) => u.playerId),
        ET_b,
        eligibleCount: eligiblePlayers.length,
        eligibleUsers: eligiblePlayers.map((p) => p.id),
        CII,
        isLowestCII: false,
      };
    });

    const minCheckins =
      ctx.minActiveCheckins !== undefined && Number(ctx.minActiveCheckins) > 0
        ? Number(ctx.minActiveCheckins)
        : 1;

    // 4. Compute Player Motivation Indicator PMI(p) and relative relPMI(p)
    const allPlayerPMIs = players.map((p) => {
      const pmi = this.computePlayerMotivation(
        playerPeriodContribs[p.id] || {},
        currentPeriod,
      );
      return { playerId: p.id, pmi };
    });

    // P: set of active players meeting the minActiveCheckins threshold
    const activePlayerPMIs = allPlayerPMIs.filter(
      (item) => (playerTotalContribs[item.playerId] || 0) >= minCheckins,
    );

    const { avgPMI, playerRelPMIs, CMI } =
      this.computeCommunityMotivation(activePlayerPMIs);

    const playerResults: PlayerIndicatorResult[] = players.map((p) => ({
      playerId: p.id,
      totalContributions: playerTotalContribs[p.id] || 0,
      periodContributions: playerPeriodContribs[p.id] || {},
      PMI: allPlayerPMIs.find((item) => item.playerId === p.id)?.pmi || 0,
      relPMI: playerRelPMIs[p.id] || 0.0,
    }));

    // 5. Rank candidate badges by ascending CII to determine adaptation candidate
    // Candidate badges must be 'active' and have an active eligible pool (CII !== null)
    const rankedCandidates = badgeMetrics
      .filter((b) => b.status === 'active' && b.CII !== null)
      .sort((a, b) => (a.CII ?? 999) - (b.CII ?? 999));

    const topCandidate =
      rankedCandidates.length > 0 ? rankedCandidates[0] : null;
    if (topCandidate) {
      const match = badgeMetrics.find(
        (b) => b.badgeId === topCandidate.badgeId,
      );
      if (match) {
        match.isLowestCII = true;
      }
    }

    const activePlayersCount = activePlayerPMIs.length;

    return {
      projectId,
      currentPeriod,
      startDate: new Date(timelineStart).toISOString(),
      asOfDate: asOfDate.toISOString(),
      daysPerPeriod,
      totalPlayers: players.length,
      activePlayers: activePlayersCount,
      totalContributions: validCheckins.length,
      avgPMI,
      CMI,
      badges: badgeMetrics,
      players: playerResults,
      adaptationCandidateBadge: topCandidate,
    };
  }

  /**
   * Definition 3.1: Estimated Awarding Time (ET_b)
   *
   * Formula:
   *   ET_b = (1 / |U_b|) * SUM_{p in U_b} (cnum(p, t_earned(p, b)))
   *
   * Explanation:
   *   Represents the historical average number of check-ins/contributions a player
   *   accumulated at the exact moment they earned badge b.
   *
   * Fallback:
   *   When |U_b| = 0 (cold start / no player has unlocked the badge yet),
   *   the estimate defaults to the sum of the badge's required check-ins plus
   *   the required check-ins of all its direct prerequisites.
   */
  computeEstimatedAwardingTime(
    badge: BadgeDefinition,
    allBadges: BadgeDefinition[],
    earnedPlayers: { playerId: string; contribsAtEarn: number }[],
  ): number {
    if (earnedPlayers.length > 0) {
      const sum = earnedPlayers.reduce((acc, p) => acc + p.contribsAtEarn, 0);
      return parseFloat((sum / earnedPlayers.length).toFixed(2));
    }

    // Cold-start fallback: required checkins + direct prerequisite requirements
    let fallback = badge.reqCheckins;
    (badge.previousBadges || []).forEach((prevRef) => {
      const prevBadge = allBadges.find(
        (b) => b.id === prevRef || b.name === prevRef,
      );
      if (prevBadge) {
        fallback += prevBadge.reqCheckins;
      }
    });

    return parseFloat(fallback.toFixed(2));
  }

  /**
   * Computes Achievability and t_0(p, b) for a player and badge.
   *
   * Definition:
   *   t_0(p, b) represents the moment in time when badge b became available/achievable
   *   for player p:
   *   - Root badges (no prerequisites): t_0 = player's join date.
   *   - Child badges: t_0 = MAX(earnedAt(prereq)) across all direct prerequisites.
   *
   * Achievability:
   *   A badge is achievable for player p if and only if all prerequisite badges
   *   specified in `previousBadges` have been completed.
   */
  computeAchievabilityAndT0(
    player: PlayerProfile,
    badge: BadgeDefinition,
    allBadges: BadgeDefinition[],
    earnedBadges: Map<string, PlayerEarnedBadge>,
  ): { isAchievable: boolean; t0Date: Date } {
    const prereqs = badge.previousBadges || [];

    if (prereqs.length === 0) {
      // Root badge is achievable from player's join date
      return { isAchievable: true, t0Date: player.joinDate };
    }

    // Check if every prerequisite badge has been earned
    let maxEarnedDate = player.joinDate;
    for (const prereqRef of prereqs) {
      // Resolve prerequisite badge by id or name
      const prereqDef = allBadges.find(
        (b) => b.id === prereqRef || b.name === prereqRef,
      );
      const prereqId = prereqDef ? prereqDef.id : prereqRef;
      const earnedInfo = earnedBadges.get(prereqId);

      if (!earnedInfo) {
        // Prerequisite missing: badge is locked/unachievable
        return { isAchievable: false, t0Date: player.joinDate };
      }

      if (new Date(earnedInfo.earnedAt).getTime() > maxEarnedDate.getTime()) {
        maxEarnedDate = new Date(earnedInfo.earnedAt);
      }
    }

    return { isAchievable: true, t0Date: maxEarnedDate };
  }

  /**
   * Definition 3.2: Individual Interest Indicator i_3(p, b)
   *
   * Formula:
   *   i_3(p, b) = 1.0 / (now - t_0(p, b))   if badge b is achievable
   *   i_3(p, b) = 1.0                      if badge b is NOT achievable (locked)
   *
   * Explanation:
   *   Captures the urgency/momentum of player p towards badge b. As elapsed days
   *   grow without earning the badge, i_3 decays towards 0, reflecting waning interest
   *   or a bottleneck. If already earned, elapsed days is fixed to (earnedAt - t_0).
   *
   * Note on Units:
   *   Elapsed time is measured in whole days (minimum 1 day to prevent division by zero).
   */
  computeIndividualInterest(
    isAchievable: boolean,
    isEarned: boolean,
    t0Date: Date,
    earnedDate: Date | null,
    asOfDate: Date,
  ): number {
    if (!isAchievable) {
      // Per Definition 3.2: 1.0 when not achievable
      return 1.0;
    }

    const t0Ms = new Date(t0Date).getTime();
    const targetMs =
      isEarned && earnedDate
        ? new Date(earnedDate).getTime()
        : new Date(asOfDate).getTime();

    const elapsedMs = Math.max(0, targetMs - t0Ms);
    const elapsedDays = Math.max(
      1,
      Math.ceil(elapsedMs / (1000 * 60 * 60 * 24)),
    );

    return parseFloat((1.0 / elapsedDays).toFixed(4));
  }

  /**
   * Definition 3.3: Community Interest Indicator CII(b)
   *
   * Formula:
   *   CII(b) = median({ i_3(p, b) : p in ep(b) })
   *   where ep(b) = { p in P : b is achievable for p AND p has not earned b }
   *
   * Explanation:
   *   Aggregates the median interest across all players who actively could earn badge b
   *   right now. Low CII(b) identifies badges that players have unlocked but are neglecting.
   *
   * Edge Cases:
   *   If ep(b) is empty (no player currently eligible), returns null.
   */
  computeCommunityInterest(eligibleI3Values: number[]): number | null {
    if (eligibleI3Values.length === 0) {
      return null;
    }

    const medianVal = this.computeMedian(eligibleI3Values);
    return parseFloat(medianVal.toFixed(4));
  }

  /**
   * Definition 3.4: Player Motivation Indicator PMI(p)
   *
   * Formula:
   *   PMI(p) = SUM_{s in S} [ cnum(p, s) >= cnum(p, prev(s)) AND (cnum(p, s) + cnum(p, prev(s)) > 0) ]
   *
   * Explanation:
   *   Measures consistency of player engagement across periods s in S.
   *   A period awards +1 point if the player made contributions and their volume
   *   did not drop compared to the preceding period (prev(s)).
   */
  computePlayerMotivation(
    periodContributions: Record<number, number>,
    currentPeriod: number,
  ): number {
    let pmiCount = 0;

    for (let s = 1; s <= currentPeriod; s++) {
      const currC = periodContributions[s] || 0;
      const prevC = s > 1 ? periodContributions[s - 1] || 0 : 0;

      // Both zero -> inactive period, no point
      if (currC + prevC > 0) {
        if (currC >= prevC) {
          pmiCount++;
        }
      }
    }

    return pmiCount;
  }

  /**
   * Definitions 3.4 & 3.5: Relative Motivation relPMI(p) and Community Motivation Indicator CMI
   *
   * Formulas:
   *   avgPMI = (1 / |P|) * SUM_{p in P} PMI(p)
   *   relPMI(p) = PMI(p) / avgPMI
   *   CMI = median({ relPMI(p) : p in P })
   *
   * Explanation:
   *   relPMI normalizes individual motivation against the community standard.
   *   CMI takes the community median. A drop in CMI below 1.0 indicates community-wide
   *   motivation decay, triggering the vanishing badge adaptation heuristic (§4).
   *
   * Edge Case Handling:
   *   If avgPMI = 0 (community cold start or complete inactivity), relPMI evaluates
   *   to 0.0 for inactive players, preventing division-by-zero or NaN values.
   */
  computeCommunityMotivation(playerPMIs: { playerId: string; pmi: number }[]): {
    avgPMI: number;
    playerRelPMIs: Record<string, number>;
    CMI: number;
  } {
    const totalPlayers = playerPMIs.length;
    if (totalPlayers === 0) {
      return { avgPMI: 0, playerRelPMIs: {}, CMI: 0.0 };
    }

    const totalPMI = playerPMIs.reduce((acc, item) => acc + item.pmi, 0);
    const avgPMI = totalPMI / totalPlayers;

    const playerRelPMIs: Record<string, number> = {};

    playerPMIs.forEach((item) => {
      if (avgPMI > 0) {
        playerRelPMIs[item.playerId] = parseFloat(
          (item.pmi / avgPMI).toFixed(3),
        );
      } else {
        // Cold start fallback: 1.0 if player alone has activity, else 0.0
        playerRelPMIs[item.playerId] = item.pmi > 0 ? 1.0 : 0.0;
      }
    });

    const relValues = playerPMIs.map((item) => playerRelPMIs[item.playerId]);
    const medianCMI = this.computeMedian(relValues);

    return {
      avgPMI: parseFloat(avgPMI.toFixed(2)),
      playerRelPMIs,
      CMI: isNaN(medianCMI) ? 0.0 : parseFloat(medianCMI.toFixed(3)),
    };
  }

  /**
   * Helper to compute the statistical median of a numerical array.
   */
  computeMedian(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2.0;
  }
}
