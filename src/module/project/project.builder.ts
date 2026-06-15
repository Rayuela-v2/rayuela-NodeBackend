import { Project } from './entities/project';
import { TimeInterval } from '../task/entities/time-restriction.entity';
import { Gamification } from '../gamification/entities/gamification.entity';
import {
  FeatureCollection,
  GamificationStrategy,
  LeaderboardStrategy,
  RecommendationStrategy,
} from './dto/create-project.dto';
import { TaskTypeValue } from './entities/task-type';

class ProjectBuilder {
  private id: string;
  private name: string;
  private description: string;
  private image: string;
  private web: string;
  private available: boolean;
  private areas: FeatureCollection;
  private taskTypes: TaskTypeValue[];
  private timeIntervals: TimeInterval[];
  private ownerId: string;
  private gamification: Gamification;
  private gamificationStrategy: GamificationStrategy;
  private leaderboardStrategy: LeaderboardStrategy;
  private recommendationStrategy: RecommendationStrategy;
  private manualLocation: boolean;

  constructor() {
    this.id = 'default-id';
    this.name = 'Default Project';
    this.description = 'Default description';
    this.image = 'default.png';
    this.web = 'default.com';
    this.available = true;
    this.areas = { type: 'FeatureCollection', features: [] };
    this.taskTypes = [];
    this.timeIntervals = [];
    this.ownerId = 'default-owner';
    this.gamification = new Gamification(this.id, [], []);
    this.gamificationStrategy = GamificationStrategy.BASIC;
    this.leaderboardStrategy = LeaderboardStrategy.POINTS_FIRST;
    this.recommendationStrategy = RecommendationStrategy.SIMPLE;
    this.manualLocation = false;
  }

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withName(name: string): this {
    this.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  withImage(image: string): this {
    this.image = image;
    return this;
  }

  withWeb(web: string): this {
    this.web = web;
    return this;
  }

  withAvailable(available: boolean): this {
    this.available = available;
    return this;
  }

  withAreas(areas: FeatureCollection): this {
    this.areas = areas;
    return this;
  }

  withTaskTypes(taskTypes: TaskTypeValue[]): this {
    this.taskTypes = taskTypes;
    return this;
  }

  withTimeIntervals(timeIntervals: TimeInterval[]): this {
    this.timeIntervals = timeIntervals;
    return this;
  }

  withOwnerId(ownerId: string): this {
    this.ownerId = ownerId;
    return this;
  }

  withGamification(gamification: Gamification): this {
    this.gamification = gamification;
    return this;
  }

  withGamificationStrategy(gamificationStrategy: GamificationStrategy): this {
    this.gamificationStrategy = gamificationStrategy;
    return this;
  }

  withLeaderboardStrategy(leaderboardStrategy: LeaderboardStrategy): this {
    this.leaderboardStrategy = leaderboardStrategy;
    return this;
  }

  withRecommendationStrategy(
    recommendationStrategy: RecommendationStrategy,
  ): this {
    this.recommendationStrategy = recommendationStrategy;
    return this;
  }

  withManualLocation(manualLocation: boolean): this {
    this.manualLocation = manualLocation;
    return this;
  }

  build(): Project {
    return new Project(
      this.id,
      this.name,
      this.description,
      this.image,
      this.web,
      this.available,
      this.areas,
      this.taskTypes,
      this.timeIntervals,
      this.ownerId,
      this.gamification,
      this.gamificationStrategy,
      this.leaderboardStrategy,
      this.recommendationStrategy,
      this.manualLocation,
    );
  }
}

export default new ProjectBuilder();
