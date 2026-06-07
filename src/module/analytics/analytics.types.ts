export type Granularity = 'day' | 'week' | 'month';

export interface TimeSeries {
  period: string; // ISO date string of the bucket start
  count: number;
}

export interface ActiveUsersSeries {
  period: string;
  uniqueUsers: number;
}

export interface StrategyBreakdown {
  gamificationStrategy: string;
  recommendationStrategy: string;
  leaderboardStrategy: string;
  projectId: string;
  projectName: string;
  checkinCount: number;
  avgPointsPerCheckin: number;
  activeUsers: number;
}

export interface PointsSeries {
  period: string;
  totalPoints: number;
  avgPointsPerCheckin: number;
}

export interface ContributionRate {
  projectId: string;
  projectName: string;
  total: number;
  withContribution: number;
  rate: number; // 0–1
}

export interface SummaryStats {
  totalCheckins: number;
  totalActiveUsers: number; // users with at least 1 checkin
  overallContributionRate: number;
  totalBadgesEarned: number;
  totalPointsAwarded: number;
}

/** Per-area aggregation row returned by `communityStats`. */
export interface AreaStat {
  areaId: string;
  areaName: string;
  checkinsCount: number;
  totalPoints: number;
  totalBadges: number;
}

/** Per-task-type aggregation row returned by `communityStats`. */
export interface TaskTypeStat {
  taskType: string;
  checkinsCount: number;
}

/** Per-time-interval aggregation row returned by `communityStats`. */
export interface IntervalStat {
  timeIntervalId: string;
  checkinsCount: number;
}

/** Shape of the community-stats endpoint response. */
export interface CommunityStats {
  byArea: AreaStat[];
  byTaskType: TaskTypeStat[];
  byInterval: IntervalStat[];
}
