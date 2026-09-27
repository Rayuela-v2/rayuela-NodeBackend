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
    description: 'User IDs who have earned this badge (U_b)',
    type: [String],
  })
  earnedUsers: string[];

  @ApiProperty({
    description:
      'Number of eligible players who unlocked prerequisites (b in AB(p)) but have not yet earned it',
  })
  eligibleCount: number;

  @ApiProperty({
    description: 'User IDs of eligible players ep(b)',
    type: [String],
  })
  eligibleUsers: string[];

  @ApiProperty({
    description:
      'Community Interest Indicator [Def 3.4] (median individual interest i3 across eligible players)',
    nullable: true,
  })
  CII: number | null;

  @ApiProperty({
    description:
      'True if CII(b) is below reference threshold x (§4.1 ignored by community)',
  })
  isCommunityIgnored: boolean;

  @ApiProperty({
    description:
      'True if badge belongs to the filtered candidate pool (§4.2.1: not all-earned, not unreachable, not expired)',
  })
  isCandidate: boolean;

  @ApiProperty({
    description:
      'True if this badge has the lowest CII among active candidates',
  })
  isLowestCII: boolean;
}

export class PlayerIndicatorDto {
  @ApiProperty({ description: 'Player user ID' })
  playerId: string;

  @ApiProperty({ description: 'Total lifetime check-in contributions' })
  totalContributions: number;

  @ApiProperty({
    description: 'Badge IDs already earned by the player (B_p)',
    type: [String],
  })
  earnedBadges: string[];

  @ApiProperty({
    description:
      'Achievable Badges AB(p) [Def 3.1]: badge IDs whose prerequisites have been met',
    type: [String],
  })
  achievableBadges: string[];

  @ApiProperty({
    description:
      'Ignored Badges ignored_by(p) [Def 3.3]: achievable unearned badges with i3(p, b) < threshold x',
    type: [String],
  })
  ignoredBadges: string[];

  @ApiProperty({
    description:
      'Individual Interest Indicator i3(p, b) [Def 3.2] mapped by badgeId',
  })
  individualInterest: Record<string, number>;
}

export class CommunityIndicatorsResponseDto {
  @ApiProperty({ description: 'Project unique identifier' })
  projectId: string;

  @ApiProperty({
    description: 'Horizon timestamp used for evaluation (ISO-8601)',
  })
  asOfDate: string;

  @ApiProperty({
    description:
      'Reference threshold x used for ignored badges (Def 3.3) and adaptation trigger (§4.1)',
  })
  threshold: number;

  @ApiProperty({ description: 'Total registered players in project' })
  totalPlayers: number;

  @ApiProperty({
    description: 'Active players meeting the contribution threshold',
  })
  activePlayers: number;

  @ApiProperty({ description: 'Total valid contributions recorded' })
  totalContributions: number;

  @ApiProperty({
    description:
      'Section 4.1 Trigger status: true if there exists a candidate badge b with CII(b) < threshold x',
  })
  isTriggered: boolean;

  @ApiProperty({
    description: 'Candidate badge IDs triggering adaptation (CII(b) < x)',
    type: [String],
  })
  triggerBadges: string[];

  @ApiProperty({
    description: 'Count of badges ignored by the community (CII(b) < x)',
  })
  communityIgnoredCount: number;

  @ApiProperty({
    description:
      'Sum of |ignored_by(p)| across all players in the evaluated pool',
  })
  totalPlayerIgnored: number;

  @ApiProperty({
    description:
      'Section 4.2.1: Badge IDs earned by all evaluated players (assigned_badges)',
    type: [String],
  })
  allPlayerBadges: string[];

  @ApiProperty({
    description:
      'Section 4.2.1: Badge IDs unreachable by any evaluated player (unreachable_badges)',
    type: [String],
  })
  unreachableBadges: string[];

  @ApiProperty({
    description:
      'Section 4.2.1: Filtered candidate badge IDs eligible for vanishing selection',
    type: [String],
  })
  candidateBadges: string[];

  @ApiProperty({
    description: 'Lowest CII value across badges with non-empty eligible pools',
    nullable: true,
  })
  lowestCII: number | null;

  @ApiProperty({
    description: 'Badge indicators list',
    type: [BadgeIndicatorDto],
  })
  badges: BadgeIndicatorDto[];

  @ApiProperty({
    description:
      'Player indicators (AB(p), ignored_by(p), and individual interest i3)',
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
