import { ApiProperty } from '@nestjs/swagger';

export class MapConfigResponseDto {
  @ApiProperty({
    description: 'Slippy-map tile URL template with {z}/{x}/{y} placeholders',
    example: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  })
  urlTemplate: string;

  @ApiProperty({
    description: 'Optional list of subdomains for {s} placeholder replacement',
    example: [],
    type: [String],
  })
  subdomains: string[];

  @ApiProperty({
    description: 'Visible licence attribution text required by the tile provider',
    example: '© OpenStreetMap contributors',
  })
  attributionText: string;

  @ApiProperty({
    description: 'URL to the tile provider copyright/licence page',
    example: 'https://www.openstreetmap.org/copyright',
  })
  attributionUrl: string;

  @ApiProperty({
    description: 'URL for reporting map data issues',
    example: 'https://www.openstreetmap.org/fixthemap',
  })
  fixMapUrl: string;

  @ApiProperty({
    description: 'Minimum supported zoom level',
    example: 2,
  })
  minZoom: number;

  @ApiProperty({
    description: 'Maximum supported zoom level',
    example: 19,
  })
  maxZoom: number;

  @ApiProperty({
    description: 'Compliant HTTP User-Agent string for native/mobile tile requests',
    example: 'RayuelaMobile/1.0 (+https://github.com/Rayuela-v2)',
  })
  userAgent: string;

  @ApiProperty({
    description: 'Minimum local disk cache retention in days (>= 7 per OSM policy)',
    example: 14,
  })
  cacheMaxAgeDays: number;

  @ApiProperty({
    description:
      'Whether bulk offline tile prefetching is permitted by the active tile provider policy (false for standard OSM servers)',
    example: false,
  })
  allowBulkPrefetch: boolean;
}
