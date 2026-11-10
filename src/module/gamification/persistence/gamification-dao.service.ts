import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
  BadgeStatus,
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
    let gamificationTemplate = await this.gamificationModel.findOne({
      projectId,
    });
    if (!gamificationTemplate) {
      gamificationTemplate = await this.createNewGamificationFor(projectId);
    }
    if (!gamificationTemplate || !gamificationTemplate.badges) {
      throw new NotFoundException('Project not found');
    }
    if (
      gamificationTemplate.badges.find((b) => b.name === createBadgeDto.name)
    ) {
      throw new ConflictException('Ya existe una insignia con ese nombre');
    }
    gamificationTemplate.badges.push({
      _id: new Types.ObjectId(),
      ...createBadgeDto,
      checkinsAmount: Math.max(1, createBadgeDto.checkinsAmount || 1),
    });
    try {
      return await gamificationTemplate.save();
    } catch (err: any) {
      if (err.name === 'ValidationError') {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
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

  /**
   * Moves a badge rule through the fading lifecycle, keeping the window
   * fields consistent with the status so `effectiveBadgeStatus` never has
   * to reconcile a contradictory row:
   *
   *   → faded   opens the window (`fadedSince` now, `expiresAt` as given).
   *   → expired closes it immediately, back-dating `expiresAt` so the
   *             derived status agrees with the stored one.
   *   → active  is the manual restitution: the whole fade record is dropped.
   */
  async updateBadgeStatus(
    projectId: string,
    badgeId: string,
    status: BadgeStatus,
    window: { expiresAt?: Date; fadeReason?: string } = {},
  ): Promise<GamificationTemplate | null> {
    const now = new Date();
    const set: Record<string, unknown> = { 'badges.$.status': status };
    const unset: Record<string, ''> = {};

    if (status === BadgeStatus.Faded) {
      set['badges.$.fadedSince'] = now;
      if (window.expiresAt) {
        set['badges.$.expiresAt'] = window.expiresAt;
      } else {
        unset['badges.$.expiresAt'] = '';
      }
      if (window.fadeReason) {
        set['badges.$.fadeReason'] = window.fadeReason;
      } else {
        unset['badges.$.fadeReason'] = '';
      }
    } else if (status === BadgeStatus.Expired) {
      set['badges.$.expiresAt'] = now;
      if (window.fadeReason) {
        set['badges.$.fadeReason'] = window.fadeReason;
      }
    } else {
      unset['badges.$.fadedSince'] = '';
      unset['badges.$.expiresAt'] = '';
      unset['badges.$.fadeReason'] = '';
    }

    // Mongo rejects an empty `$unset`, so only attach it when it has keys.
    const update: Record<string, unknown> = { $set: set };
    if (Object.keys(unset).length > 0) {
      update.$unset = unset;
    }

    const updated = await this.gamificationModel
      .findOneAndUpdate({ projectId, 'badges._id': badgeId }, update, {
        new: true,
      })
      .exec();

    if (!updated) {
      throw new NotFoundException('Insignia no encontrada');
    }
    return updated;
  }

  async addScoreRule(
    projectId: string,
    pointRule: CreateScoreRuleDto,
  ): Promise<GamificationTemplate | null> {
    let gamificationTemplate = await this.gamificationModel.findOne({
      projectId,
    });
    if (!gamificationTemplate) {
      gamificationTemplate = await this.createNewGamificationFor(projectId);
    }
    if (!gamificationTemplate || !gamificationTemplate.pointRules) {
      throw new NotFoundException('Project not found');
    }
    gamificationTemplate.pointRules.push({
      _id: new Types.ObjectId(),
      ...pointRule,
    });
    try {
      return await gamificationTemplate.save();
    } catch (err: any) {
      if (err.name === 'ValidationError') {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
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
    let saved = await this.gamificationModel.findOne({ projectId }).exec();
    if (!saved) {
      saved = await this.createNewGamificationFor(projectId);
    }
    return new Gamification(
      projectId,
      (saved?.badges || []).map(
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
            b.fadedSince,
            b.expiresAt,
            b.fadeReason,
          ),
      ),
      (saved?.pointRules || []).map(
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
    let gamificationTemplate = await this.gamificationModel.findOne({
      projectId: updateBadgeDTO.projectId,
    });
    if (!gamificationTemplate) {
      gamificationTemplate = await this.createNewGamificationFor(
        updateBadgeDTO.projectId,
      );
    }
    if (!gamificationTemplate || !gamificationTemplate.badges) {
      throw new NotFoundException('Project not found');
    }
    const existingIndex = gamificationTemplate.badges.findIndex(
      (b) => String(b._id) === String(id),
    );

    if (existingIndex === -1) {
      throw new NotFoundException('Insignia no encontrada');
    }

    const duplicate = gamificationTemplate.badges.find(
      (b, idx) => idx !== existingIndex && b.name === updateBadgeDTO.name,
    );
    if (duplicate) {
      throw new ConflictException('Ya existe una insignia con ese nombre');
    }

    gamificationTemplate.badges[existingIndex] = {
      ...gamificationTemplate.badges[existingIndex],
      ...updateBadgeDTO,
      checkinsAmount: Math.max(1, updateBadgeDTO.checkinsAmount || 1),
      _id: gamificationTemplate.badges[existingIndex]._id,
    } as BadgeTemplate;

    try {
      return await gamificationTemplate.save();
    } catch (err: any) {
      if (err.name === 'ValidationError') {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
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
