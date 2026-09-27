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
 * Standard implementation of the Vanishing Badges indicator framework (Sept 18, 2026 Revision):
 * Adaptive Gamification Mechanism for Citizen Science platforms (Torres & Dalponte Ayastuy).
 *
 * Encapsulates Definitions 3.1 through 3.4 and Section 4.1–4.2 heuristic pipeline
 * as pure, stateless mathematical operations:
 * - Def 3.1: Achievable Badges AB(p)
 * - Def 3.2: Individual Interest Indicator i_3(p, b)
 * - Def 3.3: Ignored Badges ignored_by(p)
 * - Def 3.4: Community Interest Indicator CII(b)
 * - §4.1: Adaptation Trigger (exists b in Candidates : CII(b) < x)
 * - §4.2: Candidate Badge Filtering, Sorting & Selection
 */
@Injectable()
export class VanishingBadgesStrategy implements IndicatorFormulaStrategy {
  /** Default reference threshold x (e.g., 0.20 <=> 5 days elapsed without earning) */
  private static readonly DEFAULT_THRESHOLD_X = 0.2;

  /**
   * Orchestrates the complete indicator calculation pipeline.
   *
   * 1. Filters and sorts check-ins up to `asOfDate`, resolving cumulative contributions
   *    and earned badges B_p per player.
   * 2. Determines the evaluated player pool P (optionally filtered by `minActiveCheckins`).
   * 3. Computes Achievable Badges AB(p) and t_0(p, b) [Def 3.1].
   * 4. Computes Individual Interest i_3(p, b) [Def 3.2] and Ignored Badges ignored_by(p) [Def 3.3].
   * 5. Computes Eligible Players ep(b) and Community Interest CII(b) [Def 3.4].
   * 6. Applies Candidate Badge Filtering (§4.2.1: excluding all-earned, unreachable, and expired badges).
   * 7. Evaluates Adaptation Trigger (§4.1: exists b : CII(b) < x) and ranks candidate badges (§4.2.2).
   */
  calculateIndicators(
    ctx: IndicatorComputationContext,
  ): CommunityIndicatorResult {
    const { projectId, badges, players, checkins, asOfDate } = ctx;

    const threshold =
      ctx.threshold !== undefined && Number(ctx.threshold) > 0
        ? Number(ctx.threshold)
        : VanishingBadgesStrategy.DEFAULT_THRESHOLD_X;

    // 1. Filter check-ins up to asOfDate and sort chronologically
    const validCheckins = checkins
      .filter((c) => new Date(c.datetime).getTime() <= asOfDate.getTime())
      .sort(
        (a, b) =>
          new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
      );

    const playerTotalContribs: Record<string, number> = {};
    const playerEarnedBadgesMap: Map<
      string,
      Map<string, PlayerEarnedBadge>
    > = new Map();

    players.forEach((p) => {
      playerTotalContribs[p.id] = 0;
      playerEarnedBadgesMap.set(p.id, new Map(p.earnedBadges || []));
    });

    validCheckins.forEach((c) => {
      const pId = c.userId;
      if (playerTotalContribs[pId] === undefined) {
        playerTotalContribs[pId] = 0;
        playerEarnedBadgesMap.set(pId, new Map());
      }

      playerTotalContribs[pId] = (playerTotalContribs[pId] || 0) + 1;

      // Track newly awarded badges if present on check-in
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

    // 2. Determine evaluated player pool P based on optional minActiveCheckins filter
    const minCheckins =
      ctx.minActiveCheckins !== undefined && Number(ctx.minActiveCheckins) > 0
        ? Number(ctx.minActiveCheckins)
        : 0;

    const evaluatedPlayers =
      minCheckins > 0
        ? players.filter((p) => (playerTotalContribs[p.id] || 0) >= minCheckins)
        : players;

    const activePlayersCount =
      minCheckins > 0
        ? evaluatedPlayers.length
        : players.filter((p) => (playerTotalContribs[p.id] || 0) >= 1).length;

    // 3. Compute AB(p) [Def 3.1], t_0(p, b), i_3(p, b) [Def 3.2], and ignored_by(p) [Def 3.3]
    const playerBadgeT0: Record<string, Record<string, Date>> = {};
    const playerBadgeAchievable: Record<string, Record<string, boolean>> = {};
    const playerBadgeI3: Record<string, Record<string, number>> = {};
    const playerABList: Record<string, string[]> = {};
    const playerIgnoredList: Record<string, string[]> = {};

    players.forEach((p) => {
      playerBadgeT0[p.id] = {};
      playerBadgeAchievable[p.id] = {};
      playerBadgeI3[p.id] = {};
      playerABList[p.id] = [];

      const earned = playerEarnedBadgesMap.get(p.id) || new Map();
      const earnedIds = new Set<string>(earned.keys());

      badges.forEach((b) => {
        const { isAchievable, t0Date } = this.computeAchievabilityAndT0(
          p,
          b,
          badges,
          earned,
        );
        playerBadgeAchievable[p.id][b.id] = isAchievable;
        playerBadgeT0[p.id][b.id] = t0Date;

        if (isAchievable) {
          playerABList[p.id].push(b.id);
        }

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

      playerIgnoredList[p.id] = this.computeIgnoredBadges(
        playerABList[p.id],
        earnedIds,
        playerBadgeI3[p.id],
        threshold,
      );
    });

    // 4. Section 4.2.1 Candidate Filtering (over evaluatedPlayers pool P)
    // all_player_badges = assigned_badges(players, badges) (earned by everyone in P)
    // unreachable_badges = unreachable_badges(players, badges) (no player in P has b in AB(p))
    const allPlayerBadges: string[] = [];
    const unreachableBadges: string[] = [];
    const candidateBadges: string[] = [];

    // 5. Compute badge metrics: U_b, eligible pool ep(b), and CII(b) [Def 3.4]
    let lowestCII: number | null = null;
    let communityIgnoredCount = 0;

    const badgeMetrics: BadgeIndicatorResult[] = badges.map((b) => {
      // U_b: Players in P who have earned badge b
      const UbPlayers = evaluatedPlayers.filter((p) =>
        playerEarnedBadgesMap.get(p.id)?.has(b.id),
      );

      // ep(b) = { p in P : b in AB(p) - B_p }
      const eligiblePlayers = evaluatedPlayers.filter((p) => {
        const isAchievable = playerBadgeAchievable[p.id]?.[b.id] ?? false;
        const hasEarned = playerEarnedBadgesMap.get(p.id)?.has(b.id) ?? false;
        return isAchievable && !hasEarned;
      });

      const eligibleI3Values = eligiblePlayers.map(
        (p) => playerBadgeI3[p.id][b.id],
      );
      const CII = this.computeCommunityInterest(eligibleI3Values);

      if (CII !== null && (lowestCII === null || CII < lowestCII)) {
        lowestCII = CII;
      }

      const isCommunityIgnored = CII !== null && CII < threshold;
      if (isCommunityIgnored) {
        communityIgnoredCount++;
      }

      const isAllEarned =
        evaluatedPlayers.length > 0 &&
        UbPlayers.length === evaluatedPlayers.length;
      const canAnyoneAchieve = evaluatedPlayers.some(
        (p) => playerBadgeAchievable[p.id]?.[b.id] ?? false,
      );
      const isUnreachable = !canAnyoneAchieve;
      const isExpired = b.status === 'expired';

      if (isAllEarned) {
        allPlayerBadges.push(b.id);
      }
      if (isUnreachable) {
        unreachableBadges.push(b.id);
      }

      const isCandidate = !isAllEarned && !isUnreachable && !isExpired;
      if (isCandidate) {
        candidateBadges.push(b.id);
      }

      return {
        badgeId: b.id,
        badgeName: b.name,
        status: b.status,
        earnedCount: UbPlayers.length,
        earnedUsers: UbPlayers.map((u) => u.id),
        eligibleCount: eligiblePlayers.length,
        eligibleUsers: eligiblePlayers.map((p) => p.id),
        CII,
        isCommunityIgnored,
        isCandidate,
        isLowestCII: false,
      };
    });

    // 6. Section 4.1 Trigger Condition:
    // Adaptation is triggered when a candidate badge has CII(b) < x
    const triggerBadges = badgeMetrics
      .filter((b) => b.isCandidate && b.CII !== null && b.CII < threshold)
      .map((b) => b.badgeId);
    const isTriggered = triggerBadges.length > 0;

    // 7. Section 4.2.2 Sorting & Selection:
    // Rank active candidate badges by ascending CII(b) to identify adaptation candidate
    const rankedCandidates = badgeMetrics
      .filter((b) => b.status === 'active' && b.isCandidate && b.CII !== null)
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

    // Build player indicator results for the evaluated player pool P
    let totalPlayerIgnored = 0;
    const playerResults: PlayerIndicatorResult[] = evaluatedPlayers.map((p) => {
      const earned = playerEarnedBadgesMap.get(p.id) || new Map();
      const ignored = playerIgnoredList[p.id] || [];
      totalPlayerIgnored += ignored.length;

      return {
        playerId: p.id,
        totalContributions: playerTotalContribs[p.id] || 0,
        earnedBadges: Array.from(earned.keys()),
        achievableBadges: playerABList[p.id] || [],
        ignoredBadges: ignored,
        individualInterest: playerBadgeI3[p.id] || {},
      };
    });

    return {
      projectId,
      asOfDate: asOfDate.toISOString(),
      threshold,
      totalPlayers: players.length,
      activePlayers: activePlayersCount,
      totalContributions: validCheckins.length,
      isTriggered,
      triggerBadges,
      communityIgnoredCount,
      totalPlayerIgnored,
      allPlayerBadges,
      unreachableBadges,
      candidateBadges,
      lowestCII,
      badges: badgeMetrics,
      players: playerResults,
      adaptationCandidateBadge: topCandidate,
    };
  }

  /**
   * Definition 3.1: Achievable Badges AB(p) and t_0(p, b).
   *
   * Formula:
   *   AB(p) = { b in Badges | forall prev in prerequisites(b), prev in B_p }
   *
   * Explanation:
   *   A badge is achievable to a player when all the previous badges (prerequisites)
   *   have been earned.
   *   t_0(p, b) represents the timestamp when badge b became achievable for player p:
   *   - Root badges (no prerequisites): t_0 = player's join date.
   *   - Child badges: t_0 = MAX(earnedAt(prereq)) across all direct prerequisites.
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
      const prereqDef = allBadges.find(
        (b) => b.id === prereqRef || b.name === prereqRef,
      );
      const prereqId = prereqDef ? prereqDef.id : prereqRef;
      const earnedInfo = earnedBadges.get(prereqId);

      if (!earnedInfo) {
        // Prerequisite missing: badge is locked/unachievable (b not in AB(p))
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
   *   i_3(p, b) = 1.0 / (now - t_0(p, b))   if b in AB(p) (b is achievable by p)
   *   i_3(p, b) = 1.0                       if b not in AB(p) (b is not achievable by p)
   *
   * Explanation:
   *   Captures the inverse of the time elapsed since the prerequisites for badge b
   *   were met by player p (t_0). As elapsed days grow without earning the badge,
   *   i_3 decays towards 0, reflecting waning interest.
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
   * Definition 3.3: Ignored Badges ignored_by(p)
   *
   * Formula:
   *   ignored_by(p) = { b in AB(p) - B_p : i_3(p, b) < x }
   *
   * Explanation:
   *   The set of ignored badges by a player p is a subset of AB(p) that have not
   *   yet been earned (AB(p) - B_p) whose individual interest i_3 is below threshold x.
   */
  computeIgnoredBadges(
    achievableBadgeIds: string[],
    earnedBadgeIds: Set<string>,
    playerI3Map: Record<string, number>,
    threshold: number,
  ): string[] {
    return achievableBadgeIds.filter((badgeId) => {
      if (earnedBadgeIds.has(badgeId)) {
        return false;
      }
      const i3 = playerI3Map[badgeId] ?? 1.0;
      return i3 < threshold;
    });
  }

  /**
   * Definition 3.4: Community Interest Indicator CII(b)
   *
   * Formula:
   *   CII(b) = median({ i_3(p, b) : p in ep(b) })
   *   where ep(b) = { p in P : b in AB(p) - B_p }
   *
   * Explanation:
   *   Aggregates the median individual interest across all players who are currently
   *   eligible for badge b. Low CII(b) (< x) identifies badges ignored by the community (§4.1).
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
