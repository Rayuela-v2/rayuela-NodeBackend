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
  asOfDate: Date;
  /** Threshold x for ignored badges (Def 3.3) and adaptation trigger (§4.1), default 0.20 */
  threshold?: number;
  /** Optional minimum check-ins required to include a player in the evaluated pool P */
  minActiveCheckins?: number;
}

export interface BadgeIndicatorResult {
  badgeId: string;
  badgeName: string;
  status: string;
  earnedCount: number;
  earnedUsers: string[];
  /** ep(b): Eligible players who can achieve b (b in AB(p)) and have not yet earned it */
  eligibleCount: number;
  eligibleUsers: string[];
  /** CII(b): Community Interest Indicator [Def 3.4] (median of i3 across eligible players) */
  CII: number | null;
  /** True when CII(b) < threshold x (§4.1) */
  isCommunityIgnored: boolean;
  /** True when badge is in the filtered candidate pool (§4.2.1) */
  isCandidate: boolean;
  isLowestCII: boolean;
}

export interface PlayerIndicatorResult {
  playerId: string;
  totalContributions: number;
  /** B_p: Badge IDs already earned by player p */
  earnedBadges: string[];
  /** AB(p): Achievable badges for player p whose prerequisites are met [Def 3.1] */
  achievableBadges: string[];
  /** ignored_by(p): Achievable unearned badges with i3(p, b) < threshold x [Def 3.3] */
  ignoredBadges: string[];
  /** i_3(p, b): Individual interest score per badge ID [Def 3.2] */
  individualInterest: Record<string, number>;
}

export interface CommunityIndicatorResult {
  projectId: string;
  asOfDate: string;
  /** Reference threshold x used for Def 3.3 and §4.1 */
  threshold: number;
  totalPlayers: number;
  activePlayers: number;
  totalContributions: number;
  /** §4.1 Trigger status: true if there exists a candidate badge b with CII(b) < x */
  isTriggered: boolean;
  /** Candidate badge IDs whose CII(b) < x (§4.1 / §4.2.3) */
  triggerBadges: string[];
  /** Number of badges ignored at the community level (CII(b) < x) */
  communityIgnoredCount: number;
  /** Sum of |ignored_by(p)| across all evaluated players */
  totalPlayerIgnored: number;
  /** §4.2.1 Badges earned by all evaluated players (assigned_badges) */
  allPlayerBadges: string[];
  /** §4.2.1 Badges unreachable by any evaluated player (unreachable_badges) */
  unreachableBadges: string[];
  /** §4.2.1 Filtered candidate badge IDs eligible for vanishing selection */
  candidateBadges: string[];
  /** Lowest CII value across badges with non-empty eligible pools */
  lowestCII: number | null;
  badges: BadgeIndicatorResult[];
  players: PlayerIndicatorResult[];
  /** Lowest CII active candidate badge recommended for fading if adaptation is triggered */
  adaptationCandidateBadge: BadgeIndicatorResult | null;
}
