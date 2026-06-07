import { Injectable } from '@nestjs/common';
import { AnalyticsDao } from './analytics.dao';
import { Granularity } from './analytics.types';
import { AdminCheckinQueryDto } from '../checkin/dto/admin-checkin-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsDao: AnalyticsDao) {}

  getCheckinsOverTime(
    projectId?: string,
    granularity?: Granularity,
    startDate?: string,
    endDate?: string,
  ) {
    return this.analyticsDao.checkinsOverTime(
      projectId,
      granularity ?? 'week',
      startDate,
      endDate,
    );
  }

  getActiveUsersOverTime(
    projectId?: string,
    granularity?: Granularity,
    startDate?: string,
    endDate?: string,
  ) {
    return this.analyticsDao.activeUsersOverTime(
      projectId,
      granularity ?? 'week',
      startDate,
      endDate,
    );
  }

  getByStrategy() {
    return this.analyticsDao.byStrategy();
  }

  getPointsOverTime(
    projectId?: string,
    granularity?: Granularity,
    startDate?: string,
    endDate?: string,
  ) {
    return this.analyticsDao.pointsOverTime(
      projectId,
      granularity ?? 'week',
      startDate,
      endDate,
    );
  }

  getContributionRate(projectId?: string) {
    return this.analyticsDao.contributionRate(projectId);
  }

  getBadgeAcquisitionOverTime(
    projectId?: string,
    granularity?: Granularity,
    startDate?: string,
    endDate?: string,
  ) {
    return this.analyticsDao.badgeAcquisitionOverTime(
      projectId,
      granularity ?? 'week',
      startDate,
      endDate,
    );
  }

  getCommunityStats(projectId: string, query?: AdminCheckinQueryDto) {
    return this.analyticsDao.communityStats(projectId, query);
  }

  getSummary(projectId?: string, startDate?: string, endDate?: string) {
    return this.analyticsDao.summary(projectId, startDate, endDate);
  }
}
