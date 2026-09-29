import { Game, PointsEngine } from '../../../../checkin/entities/game.entity';
import { Checkin } from '../../../../checkin/entities/checkin.entity';
import { PointRule } from '../../gamification.entity';
import { Project } from '../../../../project/entities/project';
import {
  Feature,
  FeatureCollection,
  GamificationStrategy,
} from '../../../../project/dto/create-project.dto';
import { GeoUtils } from '../../../../task/utils/geoUtils';
import { TimeInterval } from '../../../../task/entities/time-restriction.entity';
import { UserStatus } from '../../../../project/project.service';
import { Task } from '../../../../task/entities/task.entity';

export class BasicPointsEngine implements PointsEngine {
  assignableTo(project: Project): boolean {
    return (
      project.gamificationStrategy === GamificationStrategy.BASIC ||
      project.gamificationStrategy === GamificationStrategy.BADGE_FADING
    );
  }

  reward(ch: Checkin, game: Game): number {
    let newPoints = 0;
    game.project.gamification.pointRules.forEach((r) => {
      if (
        this.checkinMatchRule(
          ch,
          r,
          this.findArea(game.project.areas, r.areaId),
          this.findTimeInterval(game.project.timeIntervals, r.timeIntervalId),
        )
      ) {
        newPoints += r.score;
      }
    });
    return newPoints;
  }

  private checkinMatchRule(
    checkin: Checkin,
    r: PointRule,
    area: Feature,
    ti: TimeInterval,
  ) {
    const matchType =
      checkin.taskType === r.taskType || r.taskType === 'Cualquiera';
    const matchArea =
      (area &&
        GeoUtils.isPointInPolygon(
          Number(checkin.longitude),
          Number(checkin.latitude),
          area.geometry,
        )) ||
      r.areaId === 'Cualquiera';
    const matchTime =
      ti?.satisfy(checkin.date) || r.timeIntervalId === 'Cualquiera';

    const contributes = r.mustContribute ? checkin.contributesTo : true;

    return matchType && matchArea && matchTime && contributes;
  }

  private findArea(areas: FeatureCollection, areaId: string) {
    // Find area in areas with id areaId
    return areas.features.find((f) => f.properties.id === areaId);
  }

  private findTimeInterval(
    timeIntervals: TimeInterval[],
    timeIntervalId: string,
  ) {
    // Find time interval in timeIntervals with name timeIntervalId
    return timeIntervals.find((t) => t.name === timeIntervalId);
  }

  calculatePoints(task: Task, project: Project & { user?: UserStatus }) {
    // mustContribute only applies to check-ins, not to the points shown on a task.
    return project.gamification.pointRules.reduce(
      (acc, rule) => acc + (rule.matchTask(task) ? rule.score : 0),
      0,
    );
  }
}
