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
   * Definition 3.1: Achievable Badges AB(p) & t_0(p, b).
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
   * Definition 3.2: Individual Interest Indicator i_3(p, b).
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
   * Definition 3.3: Ignored Badges ignored_by(p).
   * ignored_by(p) = { b in AB(p) - B_p : i_3(p, b) < x }
   */
  computeIgnoredBadges(
    achievableBadgeIds: string[],
    earnedBadgeIds: Set<string>,
    playerI3Map: Record<string, number>,
    threshold: number,
  ): string[];

  /**
   * Definition 3.4: Community Interest Indicator CII(b).
   * Median of i_3(p, b) across all eligible players ep(b) = { p in P : b in AB(p) - B_p }.
   * Returns null if eligible pool is empty.
   */
  computeCommunityInterest(eligibleI3Values: number[]): number | null;
}
