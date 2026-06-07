import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import {
  ActiveUsersSeries,
  ContributionRate,
  Granularity,
  PointsSeries,
  StrategyBreakdown,
  SummaryStats,
  TimeSeries,
} from './analytics.types';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/role.decorator';
import { UserRole } from '../auth/users/user.schema';

import { AdminCheckinQueryDto } from '../checkin/dto/admin-checkin-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('checkins-over-time')
  getCheckinsOverTime(
    @Query('projectId') projectId?: string,
    @Query('granularity') granularity: Granularity = 'week',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<TimeSeries[]> {
    return this.analyticsService.getCheckinsOverTime(
      projectId,
      granularity,
      startDate,
      endDate,
    );
  }

  @Get('active-users-over-time')
  getActiveUsersOverTime(
    @Query('projectId') projectId?: string,
    @Query('granularity') granularity: Granularity = 'week',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ActiveUsersSeries[]> {
    return this.analyticsService.getActiveUsersOverTime(
      projectId,
      granularity,
      startDate,
      endDate,
    );
  }

  @Get('by-strategy')
  getByStrategy(): Promise<StrategyBreakdown[]> {
    return this.analyticsService.getByStrategy();
  }

  @Get('points-over-time')
  getPointsOverTime(
    @Query('projectId') projectId?: string,
    @Query('granularity') granularity: Granularity = 'week',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PointsSeries[]> {
    return this.analyticsService.getPointsOverTime(
      projectId,
      granularity,
      startDate,
      endDate,
    );
  }

  @Get('contribution-rate')
  getContributionRate(
    @Query('projectId') projectId?: string,
  ): Promise<ContributionRate[]> {
    return this.analyticsService.getContributionRate(projectId);
  }

  @Get('badge-acquisition-over-time')
  getBadgeAcquisitionOverTime(
    @Query('projectId') projectId?: string,
    @Query('granularity') granularity: Granularity = 'week',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<TimeSeries[]> {
    return this.analyticsService.getBadgeAcquisitionOverTime(
      projectId,
      granularity,
      startDate,
      endDate,
    );
  }

  @Get('project/:projectId/community-stats')
  getCommunityStats(
    @Param('projectId') projectId: string,
    @Query() query: AdminCheckinQueryDto,
  ): Promise<any> {
    return this.analyticsService.getCommunityStats(projectId, query);
  }

  @Get('summary')
  getSummary(
    @Query('projectId') projectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<SummaryStats> {
    return this.analyticsService.getSummary(projectId, startDate, endDate);
  }
}
