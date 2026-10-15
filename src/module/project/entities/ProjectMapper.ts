import { ProjectTemplate } from '../persistence/project.schema';
import { Project } from './project';
import {
  GamificationStrategy,
  LeaderboardStrategy,
  RecommendationStrategy,
} from '../dto/create-project.dto';
import { TimeInterval } from '../../task/entities/time-restriction.entity';
import { DEFAULT_PROJECT_TIMEZONE } from '../project.constants';

export class ProjectMapper {
  static toEntity(template: ProjectTemplate & { _id: string }): Project {
    const timezone = template.timezone || DEFAULT_PROJECT_TIMEZONE;
    const timeIntervals = (template.timeIntervals || []).map(
      (ti) =>
        new TimeInterval(
          ti.name,
          ti.days,
          ti.time,
          new Date(ti.startDate),
          new Date(ti.endDate),
          ti.timezone || timezone,
        ),
    );

    return new Project(
      template._id,
      template.name,
      template.description,
      template.image,
      template.web,
      template.available,
      template.areas,
      template.taskTypes,
      timeIntervals,
      template.ownerId,
      null,
      template.gamificationStrategy as GamificationStrategy,
      template.leaderboardStrategy as LeaderboardStrategy,
      template.recommendationStrategy as RecommendationStrategy,
      template.manualLocation,
      timezone,
    );
  }

  static toTemplate(entity: Project): Partial<ProjectTemplate> {
    return {
      name: entity.name,
      description: entity.description,
      image: entity.image,
      web: entity.web,
      available: entity.available,
      areas: entity.areas,
      taskTypes: entity.taskTypes,
      timeIntervals: entity.timeIntervals,
      ownerId: entity.ownerId,
      manualLocation: entity.manualLocation,
      timezone: entity.timezone || DEFAULT_PROJECT_TIMEZONE,
    };
  }
}
