import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BadgeTemplate,
  GamificationTemplate,
  GamificationTemplateDocument,
} from './gamification.schema';
import { CreateBadgeRuleDTO } from '../dto/create-badge-rule-d-t.o';
import {
  BadgeRule,
  Gamification,
  PointRule,
} from '../entities/gamification.entity';
import { UpdateGamificationDto } from '../dto/update-gamification.dto';
import { UpdateBadgeRuleDTO } from '../dto/update-badge-rule-d-t.o';
import { CreateScoreRuleDto } from '../dto/create-score-rule-dto';
import { UpdateScoreRuleDto } from '../dto/update-score-rule.dto';
import { Move } from '../../checkin/entities/move.entity';
import { LeaderboardDao } from '../../leaderboard/persistence/leaderboard.dao';

@Injectable()
export class GamificationDao {
  constructor(
    @InjectModel(GamificationTemplate.collectionName())
    private readonly gamificationModel: Model<GamificationTemplateDocument>,
    private readonly leaderboardDAO: LeaderboardDao,
  ) {}

  async addBadge(
    projectId: string,
    createBadgeDto: CreateBadgeRuleDTO,
  ): Promise<GamificationTemplate | null> {
    const gamificationTemplate = await this.gamificationModel.findOne({
      projectId,
    });
    if (!gamificationTemplate) {
      throw new Error('Project not found');
    }
    if (
      gamificationTemplate.badges.find((b) => b.name === createBadgeDto.name)
    ) {
      throw new Error('Ya existe una insignia con ese nombre');
    }
    gamificationTemplate.badges.push({
      _id: new Types.ObjectId(),
      ...createBadgeDto,
    });
    return gamificationTemplate.save();
  }

  async getBadgesByProject(
    projectId: string,
  ): Promise<GamificationTemplate | null> {
    return this.gamificationModel.findOne({ projectId }, { badges: 1 }).exec();
  }

  async getPointRulesByProject(
    projectId: string,
  ): Promise<GamificationTemplate | null> {
    return this.gamificationModel
      .findOne({ projectId }, { pointRules: 1 })
      .exec();
  }

  async findBadgeById(
    projectId: string,
    badgeId: string,
  ): Promise<GamificationTemplate | null> {
    return this.gamificationModel
      .findOne({ projectId, 'badges._id': badgeId }, { 'badges.$': 1 })
      .exec();
  }

  async updateGamification(
    projectId: string,
    gamificationDto: UpdateGamificationDto,
  ): Promise<GamificationTemplate | null> {
    return this.gamificationModel
      .findOneAndUpdate({ projectId }, gamificationDto, { new: true })
      .exec();
  }

  async deleteBadge(
    projectId: string,
    badgeId: string,
  ): Promise<GamificationTemplate | null> {
    return this.gamificationModel
      .findOneAndUpdate(
        { projectId },
        { $pull: { badges: { _id: badgeId } } },
        { new: true },
      )
      .exec();
  }

  async updateBadgeStatus(
    projectId: string,
    badgeId: string,
    status: string,
  ): Promise<GamificationTemplate | null> {
    return this.gamificationModel
      .findOneAndUpdate(
        { projectId, 'badges._id': badgeId },
        { $set: { 'badges.$.status': status } },
        { new: true },
      )
      .exec();
  }

  async addScoreRule(
    projectId: string,
    pointRule: CreateScoreRuleDto,
  ): Promise<GamificationTemplate | null> {
    const gamificationTemplate = await this.gamificationModel.findOne({
      projectId,
    });
    if (!gamificationTemplate) {
      throw new Error('Project not found');
    }
    gamificationTemplate.pointRules.push({
      _id: new Types.ObjectId(),
      ...pointRule,
    });
    return gamificationTemplate.save();
  }

  async updatePointRule(
    projectId: string,
    updatedRule: UpdateScoreRuleDto,
  ): Promise<GamificationTemplate | null> {
    return this.gamificationModel
      .findOneAndUpdate(
        { projectId, 'pointRules._id': updatedRule._id },
        { $set: { 'pointRules.$': updatedRule } },
      )
      .exec();
  }

  async deletePointRule(
    projectId: string,
    ruleId: string,
  ): Promise<GamificationTemplate | null> {
    return this.gamificationModel
      .findOneAndUpdate(
        { projectId },
        { $pull: { pointRules: { _id: ruleId } } },
        { new: true },
      )
      .exec();
  }

  async getGamificationByProjectId(projectId: string): Promise<Gamification> {
    const saved = await this.gamificationModel.findOne({ projectId }).exec();
    return new Gamification(
      projectId,
      saved.badges.map(
        (b) =>
          new BadgeRule(
            b._id,
            b.projectId,
            b.name,
            b.description,
            b.imageUrl,
            b.checkinsAmount,
            b.mustContribute,
            b.previousBadges,
            b.taskType,
            b.areaId,
            b.timeIntervalId,
            b.status || 'active',
          ),
      ),
      saved.pointRules.map(
        (r) =>
          new PointRule(
            r._id,
            projectId,
            r.taskType,
            r.areaId,
            r.timeIntervalId,
            r.score,
            r.mustContribute,
          ),
      ),
    );
  }

  async updateBadge(id: string, updateBadgeDTO: UpdateBadgeRuleDTO) {
    const gamificationTemplate = await this.gamificationModel.findOne({
      projectId: updateBadgeDTO.projectId,
    });
    if (!gamificationTemplate) {
      throw new Error('Project not found');
    }
    gamificationTemplate.badges = gamificationTemplate.badges
      .filter((b) => b._id !== id)
      .concat([updateBadgeDTO as BadgeTemplate]);
    return gamificationTemplate.save();
  }

  async createNewGamificationFor(projectId: string) {
    return this.gamificationModel.create({
      projectId,
      badges: [],
      pointRules: [],
    });
  }

  saveMove(move: Move) {
    return this.leaderboardDAO.updateLeaderboardUsers(
      move.checkin.projectId,
      move.gameStatus.newLeaderboard,
    );
  }
}
