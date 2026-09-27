import { ApiProperty } from '@nestjs/swagger';

export class BadgeTimelineSeriesDto {
  @ApiProperty({ description: 'Badge unique identifier' })
  badgeId: string;

  @ApiProperty({ description: 'Badge display name' })
  badgeName: string;

  @ApiProperty({
    description: 'Current badge status',
    enum: ['active', 'faded', 'expired'],
  })
  status: string;

  @ApiProperty({
    description:
      'Community Interest Indicator (CII) points across the sample timestamps. Null if no eligible players on date.',
    type: [Number],
  })
  points: (number | null)[];

  @ApiProperty({
    description:
      'True if the badge is an active candidate for adaptation fading',
  })
  isCandidate: boolean;

  @ApiProperty({
    description:
      'True if this badge has the lowest CII among active candidates',
  })
  isLowestCII: boolean;

  @ApiProperty({
    description: 'Most recent CII value in the timeline window',
    nullable: true,
  })
  currentCII: number | null;
}

export class IndicatorsTimelineResponseDto {
  @ApiProperty({ description: 'Project unique identifier' })
  projectId: string;

  @ApiProperty({
    description:
      'Reference threshold x used for adaptation trigger (Def 3.3, §4.1)',
    example: 0.2,
  })
  threshold: number;

  @ApiProperty({
    description: 'Window start timestamp (ISO-8601 UTC)',
  })
  startDate: string;

  @ApiProperty({
    description: 'Window end timestamp (ISO-8601 UTC)',
  })
  endDate: string;

  @ApiProperty({
    description: 'Sampling step in days between points',
    example: 1,
  })
  stepDays: number;

  @ApiProperty({
    description:
      'Chronological list of ISO-8601 timestamps corresponding to points in series',
    type: [String],
  })
  timestamps: string[];

  @ApiProperty({
    description: 'Timeseries per badge',
    type: [BadgeTimelineSeriesDto],
  })
  series: BadgeTimelineSeriesDto[];
}
