import { TimeInterval } from '../../task/entities/time-restriction.entity';
import { TaskTypeValue } from '../entities/task-type';

export enum GamificationStrategy {
  BASIC = 'SIN ADAPTACION',
  ELASTIC = 'ELASTICA',
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
