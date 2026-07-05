import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GamificationService } from './gamification.service';
import { CreateBadgeRuleDTO } from './dto/create-badge-rule-d-t.o';
import { UpdateGamificationDto } from './dto/update-gamification.dto';
import { UpdateBadgeRuleDTO } from './dto/update-badge-rule-d-t.o';
import { CreateScoreRuleDto } from './dto/create-score-rule-dto';
import { UpdateScoreRuleDto } from './dto/update-score-rule.dto';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Post('badge')
  create(@Body() createBadgeDto: CreateBadgeRuleDTO) {
    return this.gamificationService.createBadge(createBadgeDto);
  }

  @Patch('badge/:id')
  updateBadge(
    @Body() updateBadgeDTO: UpdateBadgeRuleDTO,
    @Param('id') id: string,
  ) {
    return this.gamificationService.updateBadge(id, updateBadgeDTO);
  }

  @Delete('/:projectId/badge/:id')
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.gamificationService.removeBadge(projectId, id);
  }

  @Patch('/:projectId/badge/:id/status/:status')
  @UseGuards(AuthGuard('jwt'))
  updateBadgeStatus(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Param('status') status: string,
  ) {
    return this.gamificationService.updateBadgeStatus(projectId, id, status);
  }

  @Post('score-rule')
  createScoreRule(@Body() dto: CreateScoreRuleDto) {
    return this.gamificationService.createScoreRule(dto);
  }

  @Patch('score-rule')
  updateScoreRule(@Body() dto: UpdateScoreRuleDto) {
    return this.gamificationService.updateScoreRule(dto);
  }

  @Delete('/:projectId/score-rule/:id')
  removeScoreRule(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.gamificationService.removeScoreRule(projectId, id);
  }

  @Patch(':projectId')
  update(
    @Param('projectId') projectId: string,
    @Body() updateGamificationDTO: UpdateGamificationDto,
  ) {
    return this.gamificationService.update(projectId, updateGamificationDTO);
  }

  @Get(':projectId')
  findAll(@Param('projectId') projectId: string) {
    return this.gamificationService.findByProjectId(projectId);
  }
}
