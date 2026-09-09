import { ApiProperty } from '@nestjs/swagger';

export class BadgeIndicatorDto {
  @ApiProperty({ description: 'Badge unique identifier' })
  badgeId: string;

  @ApiProperty({ description: 'Badge display name' })
  badgeName: string;

  @ApiProperty({
    description: 'Current badge status',
    enum: ['active', 'faded', 'expired'],
  })
  status: string;

  @ApiProperty({ description: 'Number of players who have earned this badge' })
  earnedCount: number;

  @ApiProperty({
    description: 'User IDs who have earned this badge',
    type: [String],
  })
  earnedUsers: string[];

  @ApiProperty({
    description:
      'Estimated Awarding Time (historical average contributions at award)',
  })
  ET_b: number;

  @ApiProperty({
    description:
      'Number of eligible players who unlocked prerequisites but not yet earned',
  })
  eligibleCount: number;

  @ApiProperty({ description: 'User IDs of eligible players', type: [String] })
  eligibleUsers: string[];

  @ApiProperty({
    description:
      'Community Interest Indicator (median individual interest across eligible players)',
    nullable: true,
  })
  CII: number | null;

  @ApiProperty({
    description: 'True if this badge has the lowest CII in the community',
  })
  isLowestCII: boolean;
}

export class PlayerIndicatorDto {
  @ApiProperty({ description: 'Player user ID' })
  playerId: string;

  @ApiProperty({ description: 'Total lifetime check-in contributions' })
  totalContributions: number;

  @ApiProperty({ description: 'Contributions count per period key' })
  periodContributions: Record<number, number>;

  @ApiProperty({
    description:
      'Player Motivation Indicator (periods with growth/sustained activity)',
  })
  PMI: number;

  @ApiProperty({
    description: 'Relative PMI normalized against community average',
  })
  relPMI: number;
}

export class CommunityIndicatorsResponseDto {
  @ApiProperty({ description: 'Project unique identifier' })
  projectId: string;

  @ApiProperty({ description: 'Current evaluated period number s' })
  currentPeriod: number;

  @ApiProperty({
    description: 'Timeline origin timestamp used for Period 1 (ISO-8601)',
  })
  startDate: string;

  @ApiProperty({
    description: 'Horizon timestamp used for evaluation (ISO-8601)',
  })
  asOfDate: string;

  @ApiProperty({ description: 'Period length in days' })
  daysPerPeriod: number;

  @ApiProperty({ description: 'Total registered players in project' })
  totalPlayers: number;

  @ApiProperty({ description: 'Players with at least one contribution' })
  activePlayers: number;

  @ApiProperty({ description: 'Total valid contributions recorded' })
  totalContributions: number;

  @ApiProperty({ description: 'Average PMI across community players' })
  avgPMI: number;

  @ApiProperty({
    description:
      'Community Motivation Indicator (median relPMI across players)',
  })
  CMI: number;

  @ApiProperty({
    description: 'Badge indicators list sorted by CII ascending',
    type: [BadgeIndicatorDto],
  })
  badges: BadgeIndicatorDto[];

  @ApiProperty({
    description: 'Player motivation indicators',
    type: [PlayerIndicatorDto],
  })
  players: PlayerIndicatorDto[];

  @ApiProperty({
    description: 'Top candidate badge for adaptation fading (lowest CII)',
    nullable: true,
    type: BadgeIndicatorDto,
  })
  adaptationCandidateBadge: BadgeIndicatorDto | null;
}
