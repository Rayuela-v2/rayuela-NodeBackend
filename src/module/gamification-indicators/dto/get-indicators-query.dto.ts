import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Query parameters for the project indicator calculation endpoint.
 */
export class GetIndicatorsQueryDto {
  /**
   * Number of days per evaluation period s in S (default: 7).
   */
  @ApiPropertyOptional({
    description: 'Number of days per period s in S',
    default: 7,
    example: 7,
  })
  daysPerPeriod?: number | string;

  /**
   * Optional timeline origin for period partitioning (Period 1 Day 1).
   * Accepts DD-MM-YYYY (e.g. "01-06-2026") or ISO-8601.
   * If omitted, defaults to the timestamp of the project's earliest recorded check-in
   * (or asOfDate if no check-ins exist).
   */
  @ApiPropertyOptional({
    description:
      'Timeline origin for period partitioning. Accepts DD-MM-YYYY or ISO-8601 format. If omitted, defaults to earliest check-in timestamp.',
    example: '01-06-2026',
  })
  startDate?: string;

  /**
   * Point-in-time calculation horizon. Accepts DD-MM-YYYY (e.g. "20-07-2026") or ISO-8601 (default: current server time).
   */
  @ApiPropertyOptional({
    description:
      'Point-in-time calculation horizon. Accepts DD-MM-YYYY or ISO-8601 format',
    example: '20-07-2026',
  })
  asOfDate?: string;

  /**
   * Optional minimum check-ins to filter active players.
   */
  @ApiPropertyOptional({
    description:
      'Minimum contributions required for player to be considered active',
    default: 0,
    example: 1,
  })
  minActiveCheckins?: number | string;
}
