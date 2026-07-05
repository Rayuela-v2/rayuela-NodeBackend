import { BadgeEngine } from '../../../../checkin/entities/game.entity';
import { User } from '../../../../auth/users/user.entity';
import { Checkin } from '../../../../checkin/entities/checkin.entity';
import { Project } from '../../../../project/entities/project';
import { BadgeRule } from '../../gamification.entity';
import { BadRequestException } from '@nestjs/common';
import { TimeInterval } from '../../../../task/entities/time-restriction.entity';
import { GeoUtils } from '../../../../task/utils/geoUtils';
import { GamificationStrategy } from '../../../../project/dto/create-project.dto';
import { getTaskTypeName } from '../../../../project/entities/task-type';
export class BasicBadgeEngine implements BadgeEngine {
  assignableTo(project: Project): boolean {
    return project.gamificationStrategy === GamificationStrategy.BASIC;
  }

  newBadgesFor(u: User, ch: Checkin, project: Project): BadgeRule[] {
    const memo = new Map<string, boolean>();
    const allCheckins = [...(u.checkins || []), ch];
    const currentBadges = u.getGameProfileFromProject(project.id)?.badges || [];

    const satisfiedBadges = project.gamification.badgesRules.filter((badge) =>
      this.isBadgeSatisfied(badge, allCheckins, project, currentBadges, memo),
    );

    const earnableBadges = satisfiedBadges.filter(
      (badge) => badge.status === 'active',
    );

    return earnableBadges.filter(
      (badge) => !currentBadges.includes(badge.name),
    );
  }

  /**
   * Recursively evaluates if a badge is satisfied based on check-in history.
   * A badge is satisfied if:
   * 1. All previous prerequisite badges are recursively satisfied.
   * 2. The user has enough check-ins satisfying the criteria for this badge specifically.
   */
  isBadgeSatisfied(
    badge: BadgeRule,
    checkins: Checkin[],
    project: Project,
    currentBadges: string[],
    memo: Map<string, boolean>,
  ): boolean {
    if (memo.has(badge.name)) {
      return memo.get(badge.name)!;
    }

    // 1. Evaluate prerequisite badges recursively (DAG evaluation)
    let prereqsSatisfied = true;
    for (const prereqName of badge.previousBadges || []) {
      const prereqRule = project.gamification.badgesRules.find(
        (rule) => rule.name === prereqName,
      );
      if (!prereqRule) {
        prereqsSatisfied = false;
        break;
      }

      const isPrereqSatisfied = this.isBadgeSatisfied(
        prereqRule,
        checkins,
        project,
        currentBadges,
        memo,
      );

      if (!isPrereqSatisfied) {
        prereqsSatisfied = false;
        break;
      }
    }

    if (!prereqsSatisfied) {
      memo.set(badge.name, false);
      return false;
    }

    // 2. Validate current badge's own check-in requirements
    const matchingCheckins = checkins.filter((ch) =>
      this.matchesBadgeCriteria(badge, ch, project),
    );
    const selfSatisfied =
      matchingCheckins.length >= (badge.checkinsAmount || 1);

    const isSatisfied = selfSatisfied;
    memo.set(badge.name, isSatisfied);
    return isSatisfied;
  }

  matchesBadgeCriteria(
    badge: BadgeRule,
    ch: Checkin,
    project: Project,
  ): boolean {
    return (
      this.matchTaskType(badge, ch, project) &&
      this.matchTimeInterval(badge, ch, project) &&
      this.matchArea(badge, ch, project) &&
      this.verifyContributes(badge, ch)
    );
  }

  private matchTaskType(r: BadgeRule, checkin: Checkin, project: Project) {
    const taskTypeNames = (project.taskTypes || []).map(getTaskTypeName);
    return (
      r.taskType === 'Cualquiera' ||
      (checkin.taskType === r.taskType && taskTypeNames.includes(r.taskType))
    );
  }

  private matchTimeInterval(r: BadgeRule, checkin: Checkin, project: Project) {
    if (r.timeIntervalId === 'Cualquiera') {
      return true;
    }
    const timeInterval = this.getTimeInterval(r, project);
    return timeInterval.satisfy(checkin.date);
  }

  private getTimeInterval(r: BadgeRule, project: Project): TimeInterval {
    const interval = project.timeIntervals.find(
      (ti) => r.timeIntervalId === ti.name,
    );
    if (!interval) {
      throw new BadRequestException(
        'Error during badge assignation in time interval ' + r.timeIntervalId,
      );
    }
    return new TimeInterval(
      interval.name,
      interval.days,
      interval.time,
      interval.startDate,
      interval.endDate,
    );
  }

  private matchArea(r: BadgeRule, checkin: Checkin, project: Project) {
    if (r.areaId === 'Cualquiera') {
      return true;
    }
    const polygon = project.areas.features.find(
      (f) => f.properties.id == r.areaId,
    );
    return (
      polygon &&
      GeoUtils.isPointInPolygon(
        parseFloat(checkin.longitude),
        parseFloat(checkin.latitude),
        polygon.geometry,
      )
    );
  }

  private verifyContributes(r: BadgeRule, checkin: Checkin) {
    if (r.mustContribute) {
      return !!checkin.contributesTo;
    }
    return true;
  }
}
