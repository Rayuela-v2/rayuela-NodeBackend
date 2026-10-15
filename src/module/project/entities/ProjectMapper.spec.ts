import { ProjectMapper } from './ProjectMapper';
import { Project } from './project';
import {
  GamificationStrategy,
  LeaderboardStrategy,
  RecommendationStrategy,
} from '../dto/create-project.dto';
import { DEFAULT_PROJECT_TIMEZONE } from '../project.constants';
import { TimeInterval } from '../../task/entities/time-restriction.entity';

describe('ProjectMapper', () => {
  const template = {
    _id: '1',
    name: 'p1',
    description: 'desc',
    image: 'img',
    web: 'web',
    available: true,
    areas: { type: 'FeatureCollection', features: [] },
    taskTypes: [],
    timeIntervals: [
      {
        name: 'T1',
        days: [1, 2],
        time: { start: '08:00', end: '12:00' },
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    ],
    ownerId: 'o1',
    gamificationStrategy: GamificationStrategy.BASIC,
    leaderboardStrategy: LeaderboardStrategy.POINTS_FIRST,
    recommendationStrategy: RecommendationStrategy.SIMPLE,
    manualLocation: false,
  } as any;

  it('should map template to entity with default timezone when missing', () => {
    const entity = ProjectMapper.toEntity(template);
    expect(entity.id).toBe('1');
    expect(entity.name).toBe('p1');
    expect(entity.timezone).toBe(DEFAULT_PROJECT_TIMEZONE);
    expect(entity.timeIntervals[0]).toBeInstanceOf(TimeInterval);
    expect(entity.timeIntervals[0].timezone).toBe(DEFAULT_PROJECT_TIMEZONE);
  });

  it('should map template to entity with explicit timezone when present', () => {
    const templateWithTz = {
      ...template,
      timezone: 'Europe/Madrid',
    };
    const entity = ProjectMapper.toEntity(templateWithTz);
    expect(entity.timezone).toBe('Europe/Madrid');
    expect(entity.timeIntervals[0].timezone).toBe('Europe/Madrid');
  });

  it('should map entity to template including timezone', () => {
    const entity = new Project(
      '1',
      'p1',
      'desc',
      'img',
      'web',
      true,
      { type: 'FeatureCollection', features: [] } as any,
      [],
      [],
      'o1',
      null,
      GamificationStrategy.BASIC,
      LeaderboardStrategy.POINTS_FIRST,
      RecommendationStrategy.SIMPLE,
      false,
      'America/Sao_Paulo',
    );
    const result = ProjectMapper.toTemplate(entity);
    expect(result.name).toBe('p1');
    expect(result.ownerId).toBe('o1');
    expect(result.timezone).toBe('America/Sao_Paulo');
  });
});
