import { BasicBadgeEngine } from './basic-badge-engine';
import { GamificationStrategy } from '../../../../project/dto/create-project.dto';
import { User } from '../../../../auth/users/user.entity';
import { BadgeRule } from '../../gamification.entity';
import { TimeInterval } from '../../../../task/entities/time-restriction.entity';
import { BadRequestException } from '@nestjs/common';

describe('BasicBadgeEngine', () => {
  let engine: BasicBadgeEngine;

  beforeEach(() => {
    engine = new BasicBadgeEngine();
  });

  it('should be assignable to BASIC strategy', () => {
    const project = { gamificationStrategy: GamificationStrategy.BASIC } as any;
    expect(engine.assignableTo(project)).toBe(true);
  });

  describe('newBadgesFor', () => {
    it('should return badges the user does not have and matches the rule', () => {
      const rule = new BadgeRule(
        'r1',
        'p1',
        'Badge1',
        'desc',
        'img',
        1,
        false,
        [],
        'Cualquiera',
        'Cualquiera',
        'Cualquiera',
      );
      const project = {
        id: 'p1',
        gamification: { badgesRules: [rule] },
        taskTypes: ['type1'],
        timeIntervals: [],
        areas: { features: [] },
      } as any;
      const user = new User('t@t.com', 'u', 'p', 'T');
      user.id = 'u1';
      user.addProject('p1');

      const checkin = {
        date: new Date(),
        taskType: 'type1',
        longitude: '0',
        latitude: '0',
        contributesTo: '',
        projectId: 'p1',
      } as any;

      const result = engine.newBadgesFor(user, checkin, project);
      expect(result).toContain(rule);
    });

    it('should bypass faded prerequisite badges and award active child badge', () => {
      const ruleA = new BadgeRule(
        'rA',
        'p1',
        'BadgeA',
        'desc',
        'img',
        1,
        false,
        [],
        'Cualquiera',
        'A1',
        'Cualquiera',
        'faded',
      );
      const ruleB = new BadgeRule(
        'rB',
        'p1',
        'BadgeB',
        'desc',
        'img',
        1,
        false,
        ['BadgeA'],
        'Cualquiera',
        'A2',
        'Cualquiera',
        'active',
      );

      const featureA1 = {
        properties: { id: 'A1' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
      };
      const featureA2 = {
        properties: { id: 'A2' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [2, 2],
              [3, 2],
              [3, 3],
              [2, 3],
              [2, 2],
            ],
          ],
        },
      };

      const project = {
        id: 'p1',
        gamification: { badgesRules: [ruleA, ruleB] },
        taskTypes: ['type1'],
        timeIntervals: [],
        areas: { features: [featureA1, featureA2] },
      } as any;

      const user = new User('t@t.com', 'u', 'p', 'T');
      user.id = 'u1';
      user.addProject('p1');
      const checkin1 = {
        date: new Date(),
        taskType: 'type1',
        longitude: '0.5',
        latitude: '0.5',
        contributesTo: '',
        projectId: 'p1',
      } as any;
      user.checkins = [checkin1];

      const checkin2 = {
        date: new Date(),
        taskType: 'type1',
        longitude: '2.5',
        latitude: '2.5',
        contributesTo: '',
        projectId: 'p1',
      } as any;

      const result = engine.newBadgesFor(user, checkin2, project);
      expect(result).toContain(ruleB);
      expect(result).not.toContain(ruleA);
    });
  });

  describe('internal matches', () => {
    it('should match task type', () => {
      const rule = new BadgeRule(
        'r1',
        'p1',
        'B1',
        'd',
        'i',
        1,
        false,
        [],
        'Type1',
        'Cualquiera',
        'Cualquiera',
      );
      const project = { taskTypes: ['Type1'] } as any;
      const checkin = { taskType: 'Type1' } as any;
      expect((engine as any).matchTaskType(rule, checkin, project)).toBe(true);
      expect(
        (engine as any).matchTaskType(rule, { taskType: 'Other' }, project),
      ).toBe(false);
    });

    it('should match time interval', () => {
      const rule = { timeIntervalId: 'Cualquiera' } as any;
      expect((engine as any).matchTimeInterval(rule, {}, {})).toBe(true);

      const rule2 = { timeIntervalId: 'Morning' } as any;
      const morning = new TimeInterval(
        'Morning',
        [1, 2, 3, 4, 5, 6, 7],
        { start: '08:00', end: '12:00' },
        new Date(2020, 0, 1),
        new Date(2030, 0, 1),
      );
      const project = { timeIntervals: [morning] } as any;
      const checkin = { date: new Date(2023, 0, 1, 9, 0) } as any;
      expect((engine as any).matchTimeInterval(rule2, checkin, project)).toBe(
        true,
      );
    });

    it('should match any task type', () => {
      const rule = { taskType: 'Cualquiera' } as any;
      expect((engine as any).matchTaskType(rule, {}, {})).toBe(true);
    });

    it('should check if user already has badge', () => {
      const user = {
        getGameProfileFromProject: () => ({ badges: ['B1'] }),
      } as any;
      const project = {
        id: 'p1',
        taskTypes: [],
        timeIntervals: [],
        areas: { features: [] },
        gamification: {
          badgesRules: [
            {
              name: 'B1',
              previousBadges: [],
              taskType: 'Cualquiera',
              timeIntervalId: 'Cualquiera',
              areaId: 'Cualquiera',
            },
          ],
        },
      } as any;
      const res = engine.newBadgesFor(user, {} as any, project);
      expect(res).toHaveLength(0);
    });

    it('should verify contributes', () => {
      const rule = { mustContribute: true } as any;
      const checkin = { contributesTo: 'T1' } as any;
      expect((engine as any).verifyContributes(rule, checkin)).toBe(true);
      expect(
        (engine as any).verifyContributes(rule, { contributesTo: '' }),
      ).toBe(false);
    });

    it('should throw if time interval not found', () => {
      const rule = { timeIntervalId: 'Missing' } as any;
      const project = { timeIntervals: [] } as any;
      expect(() => (engine as any).getTimeInterval(rule, project)).toThrow(
        BadRequestException,
      );
    });

    it('should return falsy if area not found', () => {
      const rule = { areaId: 'A' } as any;
      const project = { areas: { features: [] } } as any;
      expect((engine as any).matchArea(rule, {}, project)).toBeFalsy();
    });

    it('should match area', () => {
      const rule = { areaId: 'Cualquiera' } as any;
      expect((engine as any).matchArea(rule, {}, {})).toBe(true);

      const rule2 = { areaId: 'A1' } as any;
      const feature = {
        properties: { id: 'A1' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
      };
      const project = { areas: { features: [feature] } } as any;
      const checkin = { longitude: '0.5', latitude: '0.5' } as any;
      expect((engine as any).matchArea(rule2, checkin, project)).toBe(true);
    });
    it('should check if user has previous badges satisfied recursively', () => {
      const b1 = new BadgeRule(
        'r1',
        'p1',
        'B1',
        'd',
        'i',
        1,
        false,
        [],
        'Cualquiera',
        'Cualquiera',
        'Cualquiera',
        'faded',
      );
      const b2 = new BadgeRule(
        'r2',
        'p1',
        'B2',
        'd',
        'i',
        1,
        false,
        ['B1'],
        'Cualquiera',
        'Cualquiera',
        'Cualquiera',
      );
      const proj = {
        gamification: { badgesRules: [b1, b2] },
      } as any;

      const checkinsEmpty: any[] = [];
      const checkinOk = {
        date: new Date(),
        taskType: 'type1',
        longitude: '0',
        latitude: '0',
      } as any;

      expect(
        engine.isBadgeSatisfied(b2, checkinsEmpty, proj, [], new Map()),
      ).toBe(false);
      expect(
        engine.isBadgeSatisfied(
          b2,
          [checkinOk, checkinOk],
          proj,
          [],
          new Map(),
        ),
      ).toBe(true);
    });

    it('should evaluate 3-layer faded badge chain (A -> B -> C) as satisfied recursively with check-ins', () => {
      const a = new BadgeRule(
        'rA',
        'p1',
        'A',
        'd',
        'i',
        1,
        false,
        [],
        'Cualquiera',
        'Cualquiera',
        'Cualquiera',
        'faded',
      );
      const b = new BadgeRule(
        'rB',
        'p1',
        'B',
        'd',
        'i',
        1,
        false,
        ['A'],
        'Cualquiera',
        'Cualquiera',
        'Cualquiera',
        'faded',
      );
      const c = new BadgeRule(
        'rC',
        'p1',
        'C',
        'd',
        'i',
        1,
        false,
        ['B'],
        'Cualquiera',
        'Cualquiera',
        'Cualquiera',
        'active',
      );
      const proj = {
        gamification: { badgesRules: [a, b, c] },
      } as any;

      const ch = {
        date: new Date(),
        taskType: 'type1',
        longitude: '0',
        latitude: '0',
      } as any;

      // 0 check-ins should NOT satisfy C
      expect(engine.isBadgeSatisfied(c, [], proj, [], new Map())).toBe(false);

      // 1 check-in should satisfy C recursively
      expect(engine.isBadgeSatisfied(c, [ch], proj, [], new Map())).toBe(true);
    });

    it('should evaluate branching faded prerequisites correctly (B, C -> A) recursively', () => {
      const b = new BadgeRule(
        'rB',
        'p1',
        'B',
        'd',
        'i',
        1,
        false,
        [],
        'Cualquiera',
        'Cualquiera',
        'Cualquiera',
        'faded',
      );
      const c = new BadgeRule(
        'rC',
        'p1',
        'C',
        'd',
        'i',
        1,
        false,
        [],
        'Cualquiera',
        'Cualquiera',
        'Cualquiera',
        'faded',
      );
      const a = new BadgeRule(
        'rA',
        'p1',
        'A',
        'd',
        'i',
        1,
        false,
        ['B', 'C'],
        'Cualquiera',
        'Cualquiera',
        'Cualquiera',
        'active',
      );
      const proj = {
        gamification: { badgesRules: [b, c, a] },
      } as any;

      const ch = {
        date: new Date(),
        taskType: 'type1',
        longitude: '0',
        latitude: '0',
      } as any;

      // 0 check-ins should NOT satisfy A
      expect(engine.isBadgeSatisfied(a, [], proj, [], new Map())).toBe(false);

      // 1 check-in should satisfy A recursively
      expect(engine.isBadgeSatisfied(a, [ch], proj, [], new Map())).toBe(true);
    });
  });
});
