import { TimeInterval } from '../../task/entities/time-restriction.entity';
import { TaskTypeValue } from '../entities/task-type';

export enum GamificationStrategy {
  BASIC = 'SIN ADAPTACION',
  ELASTIC = 'ELASTICA',
  /**
   * Community badge fading. Points and badges are awarded exactly as under
   * {@link GamificationStrategy.BASIC} — the adaptation acts on the badge
   * *set* over time, not on how a single check-in is scored.
   *
   * Picking it is what enables the admin panel; the lifecycle machinery
   * itself keys off each badge's own `status`, not off this value.
   */
  BADGE_FADING = 'DESVANECIMIENTO',
}

export enum LeaderboardStrategy {
  POINTS_FIRST = 'PUNTOS PRIMERO',
  BADGES_FIRST = 'MEDALLAS PRIMERO',
}

export enum RecommendationStrategy {
  SIMPLE = 'SIMPLE',
  ADAPTIVE = 'ADAPTATIVO',
}

export class CreateProjectDto {
  name: string;
  description?: string;
  image: string;
  web?: string;
  available: boolean;
  manualLocation: boolean;
  areas: FeatureCollection;
  taskTypes: TaskTypeValue[];
  timeIntervals: TimeInterval[];
  ownerId: string;
  gamificationStrategy?: GamificationStrategy;
  recommendationStrategy?: RecommendationStrategy;
  /**
   * Was missing from this DTO even though the schema persists it and the
   * admin UI sends it on every save, so a typo here type-checked fine.
   */
  leaderboardStrategy?: LeaderboardStrategy;
  timezone?: string;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

export interface Feature {
  type: string;
  properties: Record<string, any> & { id: string | number };
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}
