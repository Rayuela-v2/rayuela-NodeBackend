import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Query parameters for the project indicator calculation endpoint.
 */
export class GetIndicatorsQueryDto {
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
   * Reference threshold x for Ignored Badges (Def 3.3: i3 < x) and Adaptation Trigger (§4.1: CII < x).
   * Default: 0.20 (corresponding to > 5 days elapsed since badge became achievable).
   */
  @ApiPropertyOptional({
    description:
      'Reference threshold x for ignored badges (Def 3.3) and adaptation trigger (§4.1)',
    default: 0.2,
    example: 0.2,
  })
  threshold?: number | string;

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
