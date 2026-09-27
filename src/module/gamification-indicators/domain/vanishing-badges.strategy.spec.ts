import { VanishingBadgesStrategy } from './vanishing-badges.strategy';
import {
  BadgeDefinition,
  IndicatorComputationContext,
  PlayerProfile,
} from './indicator.types';

describe('VanishingBadgesStrategy', () => {
  let strategy: VanishingBadgesStrategy;

  beforeEach(() => {
    strategy = new VanishingBadgesStrategy();
  });

  const baseDate = new Date('2026-06-01T00:00:00.000Z');

  const sampleBadges: BadgeDefinition[] = [
    {
      id: 'b1',
      name: 'Pioneer (Root)',
      reqCheckins: 5,
      previousBadges: [],
      status: 'active',
    },
    {
      id: 'b2',
      name: 'Explorer (Child)',
      reqCheckins: 10,
      previousBadges: ['b1'],
      status: 'active',
    },
    {
      id: 'b3',
      name: 'Master (Leaf)',
      reqCheckins: 15,
      previousBadges: ['b2'],
      status: 'active',
    },
  ];

  it('should calculate cold start baseline metrics with zero checkins', () => {
    const players: PlayerProfile[] = [
      { id: 'p1', joinDate: baseDate, earnedBadges: new Map() },
      { id: 'p2', joinDate: baseDate, earnedBadges: new Map() },
    ];

    const ctx: IndicatorComputationContext = {
      projectId: 'proj1',
      badges: sampleBadges,
      players,
      checkins: [],
      asOfDate: baseDate,
    };

    const res = strategy.calculateIndicators(ctx);

    expect(res.totalPlayers).toBe(2);
    expect(res.activePlayers).toBe(0);
    expect(res.totalContributions).toBe(0);
    expect(res.threshold).toBe(0.2);
    expect(res.isTriggered).toBe(false);
    expect(res.triggerBadges).toEqual([]);
    expect(res.allPlayerBadges).toEqual([]);
    expect(res.unreachableBadges).toEqual(['b2', 'b3']);
    expect(res.candidateBadges).toEqual(['b1']);

    // Root badge b1 should be achievable for both players
    const b1Metric = res.badges.find((b) => b.badgeId === 'b1')!;
    expect(b1Metric.eligibleCount).toBe(2);
    expect(b1Metric.earnedCount).toBe(0);
    // Both players joined on baseDate so elapsed days is 1 -> i3 = 1.0 -> median CII = 1.0
    expect(b1Metric.CII).toBe(1.0);
    expect(b1Metric.isCandidate).toBe(true);
    expect(b1Metric.isCommunityIgnored).toBe(false);

    // b2 has prereq b1 which is unearned, so eligibleCount = 0 and CII = null
    const b2Metric = res.badges.find((b) => b.badgeId === 'b2')!;
    expect(b2Metric.eligibleCount).toBe(0);
    expect(b2Metric.CII).toBeNull();
    expect(b2Metric.isCandidate).toBe(false);

    // Player p1 should have b1 in achievableBadges AB(p1) and empty ignoredBadges
    const p1Res = res.players.find((p) => p.playerId === 'p1')!;
    expect(p1Res.earnedBadges).toEqual([]);
    expect(p1Res.achievableBadges).toEqual(['b1']);
    expect(p1Res.ignoredBadges).toEqual([]);
    expect(p1Res.individualInterest).toEqual({
      b1: 1.0,
      b2: 1.0,
      b3: 1.0,
    });
  });

  it('should compute AB(p), ignored_by(p) [Def 3.3], and trigger adaptation [§4.1] when CII(b) < threshold x', () => {
    const p1Join = new Date('2026-06-01T00:00:00.000Z');
    const earnedBadgesP1 = new Map();
    earnedBadgesP1.set('b1', {
      badgeId: 'b1',
      earnedAt: new Date('2026-06-01T00:00:00.000Z'),
      contribsAtEarn: 5,
    });

    const players: PlayerProfile[] = [
      {
        id: 'p1',
        joinDate: p1Join,
        earnedBadges: earnedBadgesP1,
      },
      {
        id: 'p2',
        joinDate: p1Join,
        earnedBadges: new Map(),
      },
    ];

    // 7 days later (now - t0 = 6 days -> i3 = 1/6 = 0.1667 < 0.20)
    const asOfDate = new Date('2026-06-07T00:00:00.000Z');

    const ctx: IndicatorComputationContext = {
      projectId: 'proj1',
      badges: sampleBadges,
      players,
      checkins: [],
      asOfDate,
      threshold: 0.2,
    };

    const res = strategy.calculateIndicators(ctx);

    const p1Res = res.players.find((p) => p.playerId === 'p1')!;
    const p2Res = res.players.find((p) => p.playerId === 'p2')!;

    // p1 earned b1, so AB(p1) = [b1, b2], unearned achievable = [b2] with i3 = 0.1667 < 0.20
    expect(p1Res.earnedBadges).toEqual(['b1']);
    expect(p1Res.achievableBadges).toEqual(['b1', 'b2']);
    expect(p1Res.ignoredBadges).toEqual(['b2']);
    expect(p1Res.individualInterest.b2).toBe(0.1667);
    expect(p1Res.individualInterest.b3).toBe(1.0);

    // p2 earned nothing, so AB(p2) = [b1] with i3 = 0.1667 < 0.20
    expect(p2Res.earnedBadges).toEqual([]);
    expect(p2Res.achievableBadges).toEqual(['b1']);
    expect(p2Res.ignoredBadges).toEqual(['b1']);

    // Both b1 and b2 have CII = 0.1667 < 0.20 -> §4.1 Triggered!
    expect(res.isTriggered).toBe(true);
    expect(res.triggerBadges).toEqual(['b1', 'b2']);
    expect(res.communityIgnoredCount).toBe(2);
    expect(res.totalPlayerIgnored).toBe(2);
    expect(res.candidateBadges).toEqual(['b1', 'b2']);
    expect(res.unreachableBadges).toEqual(['b3']);
  });

  it('should identify lowest CII candidate badge when interest decays', () => {
    const earnedBadgesP1 = new Map();
    earnedBadgesP1.set('b1', {
      badgeId: 'b1',
      earnedAt: new Date('2026-06-01T00:00:00.000Z'),
      contribsAtEarn: 5,
    });

    const players: PlayerProfile[] = [
      {
        id: 'p1',
        joinDate: new Date('2026-06-01T00:00:00.000Z'),
        earnedBadges: earnedBadgesP1,
      },
    ];

    const asOfDate = new Date('2026-06-21T00:00:00.000Z');

    const ctx: IndicatorComputationContext = {
      projectId: 'proj1',
      badges: sampleBadges,
      players,
      checkins: [],
      asOfDate,
    };

    const res = strategy.calculateIndicators(ctx);

    const b2Metric = res.badges.find((b) => b.badgeId === 'b2')!;
    expect(b2Metric.eligibleCount).toBe(1);
    expect(b2Metric.CII).toBe(0.05);
    expect(b2Metric.isCommunityIgnored).toBe(true);
    expect(b2Metric.isCandidate).toBe(true);

    // b1 is earned by all players (p1), so it is in allPlayerBadges and not a candidate (§4.2.1)
    expect(res.allPlayerBadges).toEqual(['b1']);
    expect(res.unreachableBadges).toEqual(['b3']);
    expect(res.candidateBadges).toEqual(['b2']);

    expect(res.adaptationCandidateBadge).not.toBeNull();
    expect(res.adaptationCandidateBadge?.badgeId).toBe('b2');
    expect(b2Metric.isLowestCII).toBe(true);
  });

  it('should return null for CII when eligible pool is empty', () => {
    const earnedBadgesP1 = new Map();
    earnedBadgesP1.set('b1', {
      badgeId: 'b1',
      earnedAt: new Date('2026-06-01T00:00:00.000Z'),
      contribsAtEarn: 5,
    });

    const players: PlayerProfile[] = [
      {
        id: 'p1',
        joinDate: new Date('2026-06-01T00:00:00.000Z'),
        earnedBadges: earnedBadgesP1,
      },
    ];

    const ctx: IndicatorComputationContext = {
      projectId: 'proj1',
      badges: [sampleBadges[0]],
      players,
      checkins: [],
      asOfDate: baseDate,
    };

    const res = strategy.calculateIndicators(ctx);
    const b1Metric = res.badges.find((b) => b.badgeId === 'b1')!;

    expect(b1Metric.earnedCount).toBe(1);
    expect(b1Metric.eligibleCount).toBe(0);
    expect(b1Metric.CII).toBeNull();
    expect(b1Metric.isCandidate).toBe(false);
    expect(res.allPlayerBadges).toEqual(['b1']);
    expect(res.isTriggered).toBe(false);
  });

  it('should restrict the evaluated player pool P based on minActiveCheckins before computing AB(p), ep(b), and CII(b)', () => {
    const p1Join = new Date('2026-06-01T00:00:00.000Z');
    const players: PlayerProfile[] = [
      { id: 'p1', joinDate: p1Join, earnedBadges: new Map() },
      {
        id: 'p2',
        joinDate: new Date('2026-05-01T00:00:00.000Z'),
        earnedBadges: new Map(),
      },
    ];

    // p1 has 3 checkins; p2 has only 1 checkin
    const checkins = [
      { userId: 'p1', datetime: new Date('2026-06-02T10:00:00.000Z') },
      { userId: 'p1', datetime: new Date('2026-06-03T10:00:00.000Z') },
      { userId: 'p1', datetime: new Date('2026-06-04T10:00:00.000Z') },
      { userId: 'p2', datetime: new Date('2026-06-02T10:00:00.000Z') },
    ];

    const ctx: IndicatorComputationContext = {
      projectId: 'proj1',
      badges: sampleBadges,
      players,
      checkins,
      asOfDate: new Date('2026-06-03T23:59:59.000Z'),
      minActiveCheckins: 2, // p1 qualifies (2 checkins up to June 3 >= 2), p2 does not (1 < 2)
    };

    const res = strategy.calculateIndicators(ctx);
    expect(res.activePlayers).toBe(1);
    expect(res.totalPlayers).toBe(2);
    expect(res.players.map((p) => p.playerId)).toEqual(['p1']);

    // Only p1 is in the eligible pool for b1 (elapsed 3 days -> i3 = 0.3333)
    const b1Metric = res.badges.find((b) => b.badgeId === 'b1')!;
    expect(b1Metric.eligibleCount).toBe(1);
    expect(b1Metric.eligibleUsers).toEqual(['p1']);
    expect(b1Metric.CII).toBe(0.3333);
  });

  describe('computeMedian', () => {
    it('should return 0 for empty array', () => {
      expect(strategy.computeMedian([])).toBe(0);
    });

    it('should return middle element for odd length array', () => {
      expect(strategy.computeMedian([5, 1, 3])).toBe(3);
    });

    it('should return average of two middle elements for even length array', () => {
      expect(strategy.computeMedian([1, 2, 3, 4])).toBe(2.5);
    });
  });
});
