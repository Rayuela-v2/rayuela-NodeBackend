import { Injectable } from '@nestjs/common';
import { CreateBadgeRuleDTO } from './dto/create-badge-rule-d-t.o';
import { GamificationDao } from './persistence/gamification-dao.service';
import { UpdateGamificationDto } from './dto/update-gamification.dto';
import { UpdateBadgeRuleDTO } from './dto/update-badge-rule-d-t.o';
import { CreateScoreRuleDto } from './dto/create-score-rule-dto';
import { UpdateScoreRuleDto } from './dto/update-score-rule.dto';
import { Move } from '../checkin/entities/move.entity';

@Injectable()
export class GamificationService {
  constructor(private readonly gamificationDao: GamificationDao) {}

  createBadge(createBadgeDto: CreateBadgeRuleDTO) {
    return this.gamificationDao.addBadge(
      createBadgeDto.projectId,
      createBadgeDto,
    );
  }

  findByProjectId(projectId: string) {
    return this.gamificationDao.getGamificationByProjectId(projectId);
  }

  update(projectId: string, gamificationDto: UpdateGamificationDto) {
    return this.gamificationDao.updateGamification(projectId, gamificationDto);
  }

  removeBadge(projectId: string, id: string) {
    return this.gamificationDao.deleteBadge(projectId, id);
  }

  updateBadgeStatus(projectId: string, id: string, status: string) {
    return this.gamificationDao.updateBadgeStatus(projectId, id, status);
  }

  updateBadge(id: string, updateBadgeDTO: UpdateBadgeRuleDTO) {
    return this.gamificationDao.updateBadge(id, updateBadgeDTO);
  }

  createScoreRule(dto: CreateScoreRuleDto) {
    return this.gamificationDao.addScoreRule(dto.projectId, dto);
  }

  updateScoreRule(dto: UpdateScoreRuleDto) {
    return this.gamificationDao.updatePointRule(dto.projectId, dto);
  }

  removeScoreRule(projectId: string, id: string) {
    return this.gamificationDao.deletePointRule(projectId, id);
  }

  saveMove(move: Move) {
    return this.gamificationDao.saveMove(move);
  }
}
