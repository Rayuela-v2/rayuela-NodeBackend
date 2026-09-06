import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GamificationIndicatorsService } from './gamification-indicators.service';
import { GetIndicatorsQueryDto } from './dto/get-indicators-query.dto';
import { CommunityIndicatorsResponseDto } from './dto/indicators-response.dto';

@ApiTags('Gamification Indicators')
@Controller('gamification-indicators')
export class GamificationIndicatorsController {
  constructor(
    private readonly indicatorsService: GamificationIndicatorsService,
  ) {}

  /**
   * Triggers the calculation of adaptive gamification indicators for a project.
   * Computes community metrics (CMI, avgPMI) and badge metrics (CII, ET_b).
   */
  @Get(':projectId')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary:
      'Calculates and returns adaptive gamification indicators (CII, CMI, ET_b) for a project',
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
