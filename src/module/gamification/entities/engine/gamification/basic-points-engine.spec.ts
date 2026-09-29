import { BasicPointsEngine } from './basic-points-engine';
import { GamificationStrategy } from '../../../../project/dto/create-project.dto';
import { GeoUtils } from '../../../../task/utils/geoUtils';

describe('BasicPointsEngine', () => {
  let engine: BasicPointsEngine;

  beforeEach(() => {
    engine = new BasicPointsEngine();
  });

  it('should be assignable to BASIC strategy', () => {
    const project = { gamificationStrategy: GamificationStrategy.BASIC } as any;
    expect(engine.assignableTo(project)).toBe(true);
  });

  it('should be assignable to BADGE_FADING too', () => {
    // Fading leaves scoring alone, so basic points still apply.
    const project = {
      gamificationStrategy: GamificationStrategy.BADGE_FADING,
    } as any;
    expect(engine.assignableTo(project)).toBe(true);
  });

  it('should not claim the elastic strategy', () => {
    const project = {
      gamificationStrategy: GamificationStrategy.ELASTIC,
    } as any;
    expect(engine.assignableTo(project)).toBe(false);
  });

  describe('reward', () => {
    it('should calculate points based on rules', () => {
      const ch = {
        latitude: '0',
        longitude: '0',
        taskType: 'type1',
        date: new Date(),
        contributesTo: 'task1',
      } as any;
      const game = {
        project: {
          areas: { features: [] },
          timeIntervals: [],
          gamification: {
            pointRules: [
              {
                taskType: 'type1',
                areaId: 'Cualquiera',
                timeIntervalId: 'Cualquiera',
                score: 10,
                mustContribute: true,
              },
              {
                taskType: 'type2',
                areaId: 'Cualquiera',
                timeIntervalId: 'Cualquiera',
                score: 5,
                mustContribute: false,
              },
            ],
          },
        },
      } as any;

      const result = engine.reward(ch, game);
      expect(result).toBe(10);
    });

    it('should return 0 if area is not found and not "Cualquiera"', () => {
      const ch = {
        latitude: '0',
        longitude: '0',
        taskType: 'type1',
        date: new Date(),
        contributesTo: 'task1',
      } as any;
      const game = {
        project: {
          areas: { features: [] },
          timeIntervals: [],
          gamification: {
            pointRules: [
              {
                taskType: 'type1',
                areaId: 'specificArea',
                timeIntervalId: 'Cualquiera',
                score: 10,
                mustContribute: false,
              },
            ],
          },
        },
      } as any;
      expect(engine.reward(ch, game)).toBe(0);
    });

    it('should return points if area matches via GeoUtils', () => {
      const ch = {
        latitude: '0.5',
        longitude: '0.5',
        taskType: 'type1',
        date: new Date(),
        contributesTo: 'task1',
      } as any;
      const area = { properties: { id: 'a1' }, geometry: {} };
      const game = {
        project: {
          areas: { features: [area] },
          timeIntervals: [],
          gamification: {
            pointRules: [
              {
                taskType: 'type1',
                areaId: 'a1',
                timeIntervalId: 'Cualquiera',
                score: 10,
                mustContribute: false,
              },
            ],
          },
        },
      } as any;

      jest.spyOn(GeoUtils, 'isPointInPolygon').mockReturnValue(true);
      expect(engine.reward(ch, game)).toBe(10);
      (GeoUtils.isPointInPolygon as jest.Mock).mockRestore();
    });

    it('should return 0 if area matches but point is not inside', () => {
      const ch = {
        latitude: '0.5',
        longitude: '0.5',
        taskType: 'type1',
        date: new Date(),
        contributesTo: 'task1',
      } as any;
      const area = { properties: { id: 'a1' }, geometry: {} };
      const game = {
        project: {
          areas: { features: [area] },
          timeIntervals: [],
          gamification: {
            pointRules: [
              {
                taskType: 'type1',
                areaId: 'a1',
                timeIntervalId: 'Cualquiera',
                score: 10,
                mustContribute: false,
              },
            ],
          },
        },
      } as any;

      jest.spyOn(GeoUtils, 'isPointInPolygon').mockReturnValue(false);
      expect(engine.reward(ch, game)).toBe(0);
      (GeoUtils.isPointInPolygon as jest.Mock).mockRestore();
    });
  });

  describe('calculatePoints', () => {
    it('should calculate points for a task', () => {
      const task = {} as any;
      const project = {
        gamification: {
          pointRules: [
            {
              matchTask: jest.fn().mockReturnValue(true),
              score: 10,
              mustContribute: true,
            },
            {
              matchTask: jest.fn().mockReturnValue(false),
              score: 5,
              mustContribute: true,
            },
          ],
        },
      } as any;

      const result = engine.calculatePoints(task, project);
      expect(result).toBe(10);
    });

    it('should count matching rules even if mustContribute is false', () => {
      const project = {
        gamification: {
          pointRules: [
            {
              matchTask: jest.fn().mockReturnValue(true),
              score: 15,
              mustContribute: false,
            },
            {
              matchTask: jest.fn().mockReturnValue(true),
              score: 5,
              mustContribute: false,
            },
          ],
        },
      } as any;

      expect(engine.calculatePoints({} as any, project)).toBe(20);
    });

    it('should return 0 if no rule matches', () => {
      const task = {} as any;
      const project = {
        gamification: {
          pointRules: [
            {
              matchTask: jest.fn().mockReturnValue(false),
              score: 10,
              mustContribute: true,
            },
          ],
        },
      } as any;

      const result = engine.calculatePoints(task, project);
      expect(result).toBe(0);
    });
  });
});
