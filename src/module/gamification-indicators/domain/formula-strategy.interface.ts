import {
  BadgeDefinition,
  CommunityIndicatorResult,
  IndicatorComputationContext,
  PlayerEarnedBadge,
  PlayerProfile,
} from './indicator.types';

export const INDICATOR_FORMULA_STRATEGY = 'INDICATOR_FORMULA_STRATEGY';

/**
 * Strategy interface for calculating gamification indicators.
 * Encapsulates all mathematical formulations to allow easy iteration,
 * algorithm swapping, and regression-free enhancements.
 */
export interface IndicatorFormulaStrategy {
  /**
   * Main entry point to compute all indicators for a project context.
   */
  calculateIndicators(
    ctx: IndicatorComputationContext,
  ): CommunityIndicatorResult;

  /**
   * Definition 3.1: Estimated Awarding Time (ET_b).
   * Historical average of contributions at award time for players who earned badge b.
   */
  computeEstimatedAwardingTime(
    badge: BadgeDefinition,
    allBadges: BadgeDefinition[],
    earnedPlayers: { playerId: string; contribsAtEarn: number }[],
  ): number;

  /**
   * Evaluates if badge b is achievable by player p (all prerequisites met)
   * and calculates t_0(p, b), the timestamp when badge b became achievable.
   */
  computeAchievabilityAndT0(
    player: PlayerProfile,
    badge: BadgeDefinition,
    allBadges: BadgeDefinition[],
    earnedBadges: Map<string, PlayerEarnedBadge>,
  ): { isAchievable: boolean; t0Date: Date };

  /**
   * Definition 3.2: Individual Interest Indicator i3(p, b).
   * 1 / (now - t0) for achievable badges; 1.0 if not achievable.
   */
  computeIndividualInterest(
    isAchievable: boolean,
    isEarned: boolean,
    t0Date: Date,
    earnedDate: Date | null,
    asOfDate: Date,
  ): number;

  /**
   * Definition 3.3: Community Interest Indicator CII(b).
   * Median of i3(p, b) across all eligible players ep(b).
   * Returns null if eligible pool is empty.
   */
  computeCommunityInterest(eligibleI3Values: number[]): number | null;

  /**
   * Definition 3.4: Player Motivation Indicator PMI(p).
   * Counts periods s in S where contributions grew or held steady with non-zero activity.
   */
  computePlayerMotivation(
    periodContributions: Record<number, number>,
    currentPeriod: number,
  ): number;

  /**
   * Definitions 3.4 & 3.5: Relative PMI and Community Motivation Indicator (CMI).
   * relPMI(p) = PMI(p) / avgPMI
   * CMI = median({ relPMI(p) : p in P })
   */
  computeCommunityMotivation(playerPMIs: { playerId: string; pmi: number }[]): {
    avgPMI: number;
    playerRelPMIs: Record<string, number>;
    CMI: number;
  };
}
