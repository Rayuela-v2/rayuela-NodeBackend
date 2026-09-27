import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GamificationIndicatorsService } from './gamification-indicators.service';
import { GetIndicatorsQueryDto } from './dto/get-indicators-query.dto';
import { CommunityIndicatorsResponseDto } from './dto/indicators-response.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/role.decorator';
import { UserRole } from '../auth/users/user.schema';

@ApiTags('Gamification Indicators')
@Controller('gamification-indicators')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class GamificationIndicatorsController {
  constructor(
    private readonly indicatorsService: GamificationIndicatorsService,
  ) {}

  /**
   * Triggers the calculation of adaptive gamification indicators for a project.
   * Computes player metrics (AB(p), i3(p,b), ignored_by(p)), badge metrics (CII(b)),
   * and §4.1/§4.2 vanishing badge adaptation triggers.
   * Restricted to administrators to protect volunteer behavioral telemetry.
   */
  @Get(':projectId')
  @ApiOperation({
    summary:
      'Calculates and returns adaptive gamification indicators (AB, i3, ignored_by, CII) for a project',
  })
  @ApiResponse({
    status: 200,
    description: 'Calculated indicator metrics for the project',
    type: CommunityIndicatorsResponseDto,
  })
  async getIndicators(
    @Param('projectId') projectId: string,
    @Query() query: GetIndicatorsQueryDto,
  ): Promise<CommunityIndicatorsResponseDto> {
    return this.indicatorsService.computeIndicators(projectId, query);
  }
}
