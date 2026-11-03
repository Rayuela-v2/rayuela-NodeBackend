import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MapsService } from './maps.service';
import { MapConfigResponseDto } from './dto/map-config.dto';

@ApiTags('maps')
@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Get centralized map tile provider configuration',
    description:
      'Returns the active map tile URL template, attribution metadata, zoom bounds, User-Agent string, cache TTL, and bulk-prefetch policy for Web and Mobile clients.',
  })
  @ApiOkResponse({ type: MapConfigResponseDto })
  getConfig(): MapConfigResponseDto {
    return this.mapsService.getMapConfig();
  }
}
