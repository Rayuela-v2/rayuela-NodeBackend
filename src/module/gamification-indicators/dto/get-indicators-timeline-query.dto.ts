import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Query parameters for fetching historical indicators timeline.
 */
export class GetIndicatorsTimelineQueryDto {
  /**
   * Start date for the timeline window. Accepts DD-MM-YYYY or ISO-8601 (default: 30 days before endDate).
   */
  @ApiPropertyOptional({
    description:
      'Start date for timeline window. Accepts DD-MM-YYYY or ISO-8601 format',
    example: '27-08-2026',
  })
  startDate?: string;

  /**
   * End date for the timeline window. Accepts DD-MM-YYYY or ISO-8601 (default: current server time).
   */
  @ApiPropertyOptional({
    description:
      'End date for timeline window. Accepts DD-MM-YYYY or ISO-8601 format',
    example: '27-09-2026',
  })
  endDate?: string;

  /**
   * Optional sampling interval in days (e.g. 1 for daily, 7 for weekly).
   * If omitted, dynamically calculated to target between 10 and 30 sample points.
   */
  @ApiPropertyOptional({
    description:
      'Sampling interval in days between snapshots (e.g. 1 for daily, 7 for weekly)',
    example: 1,
  })
  stepDays?: number | string;

  /**
   * Reference threshold x for ignored badges (Def 3.3) and adaptation trigger (§4.1). Default: 0.20.
   */
  @ApiPropertyOptional({
    description:
      'Reference threshold x for ignored badges (Def 3.3) and adaptation trigger (§4.1)',
    default: 0.2,
    example: 0.2,
  })
  threshold?: number | string;

  /**
   * Optional filter for a specific badge ID. If omitted, returns series for all project badges.
   */
  @ApiPropertyOptional({
    description: 'Filter timeline by a specific badge ID',
    example: '6a4a7e9b59f9a50103a3cda7',
  })
  badgeId?: string;

  /**
   * Optional minimum check-ins to restrict the evaluated player pool P.
   */
  @ApiPropertyOptional({
    description:
      'Minimum contributions required for a player to be included in the evaluated pool P',
    default: 0,
    example: 1,
  })
  minActiveCheckins?: number | string;
}
