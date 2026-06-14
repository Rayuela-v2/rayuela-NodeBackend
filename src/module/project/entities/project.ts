import { TimeInterval } from '../../task/entities/time-restriction.entity';
import { Gamification } from '../../gamification/entities/gamification.entity';
import {
  FeatureCollection,
  GamificationStrategy,
  LeaderboardStrategy,
  RecommendationStrategy,
} from '../dto/create-project.dto';
import { TaskTypeValue } from './task-type';

export class Project {
  constructor(
    id: string,
    name: string,
    description: string,
    image: string,
    web: string,
    available: boolean,
    areas: FeatureCollection,
    taskTypes: TaskTypeValue[],
    timeIntervals: TimeInterval[],
    ownerId: string,
    gamification: Gamification,
    gamificationStrategy: GamificationStrategy,
    leaderboardStrategy: LeaderboardStrategy,
    recommendationStrategy: RecommendationStrategy,
    manualLocation: boolean = false,
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.image = image;
    this.web = web;
    this.available = available;
    this.areas = areas;
    this.taskTypes = taskTypes;
    this.timeIntervals = timeIntervals;
    this.ownerId = ownerId;
    this.gamification = gamification;
    this.gamificationStrategy = gamificationStrategy;
    this.recommendationStrategy = recommendationStrategy;
    this.manualLocation = manualLocation;
    this.leaderboardStrategy = leaderboardStrategy;
  }

  id: string;
  name: string;
  description: string;
  image: string;
  web: string;
  available: boolean;
  areas: FeatureCollection;
  taskTypes: TaskTypeValue[];
  timeIntervals: TimeInterval[];
  ownerId: string;
  gamification: Gamification;
  gamificationStrategy: GamificationStrategy;
  recommendationStrategy: RecommendationStrategy;
  manualLocation: boolean;
  leaderboardStrategy: LeaderboardStrategy;
}
