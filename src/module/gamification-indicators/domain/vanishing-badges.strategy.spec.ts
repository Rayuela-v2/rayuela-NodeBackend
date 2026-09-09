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
      daysPerPeriod: 7,
    };

    const res = strategy.calculateIndicators(ctx);

    expect(res.totalPlayers).toBe(2);
    expect(res.activePlayers).toBe(0);
    expect(res.totalContributions).toBe(0);
    expect(res.avgPMI).toBe(0);
    expect(res.CMI).toBe(0);

    // Root badge b1 should be achievable for both players
    const b1Metric = res.badges.find((b) => b.badgeId === 'b1')!;
    expect(b1Metric.eligibleCount).toBe(2);
    expect(b1Metric.earnedCount).toBe(0);
    // Cold start ET_b fallback: reqCheckins (5)
    expect(b1Metric.ET_b).toBe(5);
    // Both players joined on baseDate so elapsed days is 1 -> i3 = 1.0 -> median CII = 1.0
    expect(b1Metric.CII).toBe(1.0);

    // b2 has prereq b1 which is unearned, so eligibleCount = 0 and CII = null
    const b2Metric = res.badges.find((b) => b.badgeId === 'b2')!;
    expect(b2Metric.eligibleCount).toBe(0);
    expect(b2Metric.CII).toBeNull();
    // Fallback ET_b: reqCheckins(b2) + reqCheckins(b1) = 10 + 5 = 15
    expect(b2Metric.ET_b).toBe(15);
  });

  it('should accurately compute PMI and CMI across periods with growing activity', () => {
    const p1Join = new Date('2026-06-01T00:00:00.000Z');
    const players: PlayerProfile[] = [
      { id: 'p1', joinDate: p1Join, earnedBadges: new Map() },
      { id: 'p2', joinDate: p1Join, earnedBadges: new Map() },
    ];

    // Period 1 (Day 1-7): p1 has 2 checkins, p2 has 1
    // Period 2 (Day 8-14): p1 has 4 checkins, p2 has 0
    const checkins = [
      { userId: 'p1', datetime: new Date('2026-06-02T10:00:00.000Z') },
      { userId: 'p1', datetime: new Date('2026-06-03T10:00:00.000Z') },
      { userId: 'p2', datetime: new Date('2026-06-02T10:00:00.000Z') },
      { userId: 'p1', datetime: new Date('2026-06-09T10:00:00.000Z') },
      { userId: 'p1', datetime: new Date('2026-06-10T10:00:00.000Z') },
      { userId: 'p1', datetime: new Date('2026-06-11T10:00:00.000Z') },
      { userId: 'p1', datetime: new Date('2026-06-12T10:00:00.000Z') },
    ];

    const asOfDate = new Date('2026-06-14T23:59:59.000Z');

    const ctx: IndicatorComputationContext = {
      projectId: 'proj1',
      badges: sampleBadges,
      players,
      checkins,
      asOfDate,
      daysPerPeriod: 7,
    };

    const res = strategy.calculateIndicators(ctx);

    const p1Res = res.players.find((p) => p.playerId === 'p1')!;
    const p2Res = res.players.find((p) => p.playerId === 'p2')!;

    expect(p1Res.PMI).toBe(2);
    expect(p2Res.PMI).toBe(1);

    expect(res.avgPMI).toBe(1.5);
    expect(p1Res.relPMI).toBe(1.333);
    expect(p2Res.relPMI).toBe(0.667);
    expect(res.CMI).toBe(1.0);
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
      daysPerPeriod: 7,
    };

    const res = strategy.calculateIndicators(ctx);

    const b2Metric = res.badges.find((b) => b.badgeId === 'b2')!;
    expect(b2Metric.eligibleCount).toBe(1);
    expect(b2Metric.CII).toBe(0.05);

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
      daysPerPeriod: 7,
    };

    const res = strategy.calculateIndicators(ctx);
    const b1Metric = res.badges.find((b) => b.badgeId === 'b1')!;

    expect(b1Metric.earnedCount).toBe(1);
    expect(b1Metric.eligibleCount).toBe(0);
    expect(b1Metric.CII).toBeNull();
  });

  it('should anchor timeline to explicit startDate when provided', () => {
    const explicitStart = new Date('2026-06-01T00:00:00.000Z');
    const asOf = new Date('2026-06-22T00:00:00.000Z'); // 21 days later = 3 periods of 7 days

    const ctx: IndicatorComputationContext = {
      projectId: 'proj1',
      badges: sampleBadges,
      players: [{ id: 'p1', joinDate: explicitStart, earnedBadges: new Map() }],
      checkins: [
        // check-in 2 days after start -> Period 1
        { userId: 'p1', datetime: new Date('2026-06-03T10:00:00.000Z') },
        // check-in 10 days after start -> Period 2
        { userId: 'p1', datetime: new Date('2026-06-11T10:00:00.000Z') },
      ],
      startDate: explicitStart,
      asOfDate: asOf,
      daysPerPeriod: 7,
    };

    const res = strategy.calculateIndicators(ctx);
    expect(res.startDate).toBe(explicitStart.toISOString());
    expect(res.currentPeriod).toBe(4);
    const p1 = res.players.find((p) => p.playerId === 'p1')!;
    expect(p1.periodContributions[1]).toBe(1);
    expect(p1.periodContributions[2]).toBe(1);
  });

  it('should filter active players and evaluate community motivation based on minActiveCheckins', () => {
    const p1Join = new Date('2026-06-01T00:00:00.000Z');
    const players: PlayerProfile[] = [
      { id: 'p1', joinDate: p1Join, earnedBadges: new Map() },
      { id: 'p2', joinDate: p1Join, earnedBadges: new Map() },
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
      asOfDate: new Date('2026-06-14T23:59:59.000Z'),
      daysPerPeriod: 7,
      minActiveCheckins: 2, // p1 qualifies (3 >= 2), p2 does not (1 < 2)
    };

    const res = strategy.calculateIndicators(ctx);
    expect(res.activePlayers).toBe(1);
    expect(res.totalPlayers).toBe(2);

    const p1Res = res.players.find((p) => p.playerId === 'p1')!;
    const p2Res = res.players.find((p) => p.playerId === 'p2')!;

    // p1 is active and sole contributor to community motivation
    expect(p1Res.relPMI).toBe(1.0);
    // p2 is below minActiveCheckins threshold so relPMI is 0.0
    expect(p2Res.relPMI).toBe(0.0);
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
