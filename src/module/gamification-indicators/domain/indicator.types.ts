/**
 * Domain types for Adaptive Gamification Indicator calculations.
 * Reference: Vanishing Badges Adaptive Gamification Framework
 */

export interface BadgeDefinition {
  id: string;
  name: string;
  reqCheckins: number;
  previousBadges: string[];
  status: string;
  fadedSince?: Date | null;
  expiresAt?: Date | null;
  fadeReason?: string | null;
}

export interface PlayerEarnedBadge {
  badgeId: string;
  earnedAt: Date;
  contribsAtEarn: number;
}

export interface PlayerProfile {
  id: string;
  joinDate: Date;
  earnedBadges: Map<string, PlayerEarnedBadge>;
}

export interface CheckinRecord {
  id?: string;
  userId: string;
  datetime: Date;
  taskType?: string;
  contributesTo?: string;
  newBadges?: string[];
}

export interface IndicatorComputationContext {
  projectId: string;
  badges: BadgeDefinition[];
  players: PlayerProfile[];
  checkins: CheckinRecord[];
  startDate?: Date;
  asOfDate: Date;
  daysPerPeriod: number;
  minActiveCheckins?: number;
}

export interface BadgeIndicatorResult {
  badgeId: string;
  badgeName: string;
  status: string;
  earnedCount: number;
  earnedUsers: string[];
  /** ET_b: Estimated Awarding Time (historical average contributions at award time) */
  ET_b: number;
  /** ep(b): Eligible players who can achieve b and have not yet earned it */
  eligibleCount: number;
  eligibleUsers: string[];
  /** CII(b): Community Interest Indicator (median of i3 across eligible players) */
  CII: number | null;
  isLowestCII: boolean;
}

export interface PlayerIndicatorResult {
  playerId: string;
  totalContributions: number;
  periodContributions: Record<number, number>;
  /** PMI(p): Player Motivation Indicator (count of periods with positive/non-declining activity) */
  PMI: number;
  /** relPMI(p): Relative Player Motivation normalized to community average */
  relPMI: number;
}

export interface CommunityIndicatorResult {
  projectId: string;
  currentPeriod: number;
  startDate: string;
  asOfDate: string;
  daysPerPeriod: number;
  totalPlayers: number;
  activePlayers: number;
  totalContributions: number;
  /** Community average PMI across players */
  avgPMI: number;
  /** CMI: Community Motivation Indicator (median relPMI across players) */
  CMI: number;
  badges: BadgeIndicatorResult[];
  players: PlayerIndicatorResult[];
  /** Lowest CII candidate badge recommended for fading if adaptation is triggered */
  adaptationCandidateBadge: BadgeIndicatorResult | null;
}
