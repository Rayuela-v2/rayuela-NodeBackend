import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MapConfigResponseDto } from './dto/map-config.dto';

export const DEFAULT_MAP_CONFIG: Readonly<MapConfigResponseDto> = Object.freeze({
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  subdomains: [],
  attributionText: '© OpenStreetMap contributors',
  attributionUrl: 'https://www.openstreetmap.org/copyright',
  fixMapUrl: 'https://www.openstreetmap.org/fixthemap',
  minZoom: 2,
  maxZoom: 19,
  userAgent: 'RayuelaMobile/1.0 (+https://github.com/Rayuela-v2)',
  cacheMaxAgeDays: 14,
  allowBulkPrefetch: false,
});

@Injectable()
export class MapsService {
  constructor(private readonly configService: ConfigService) {}

  getMapConfig(): MapConfigResponseDto {
    const rawSubdomains = this.configService.get<string>('MAP_TILE_SUBDOMAINS');
    const subdomains = rawSubdomains
      ? rawSubdomains
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [...DEFAULT_MAP_CONFIG.subdomains];

    const minZoom = this.parseNumber(
      this.configService.get<string>('MAP_TILE_MIN_ZOOM'),
      DEFAULT_MAP_CONFIG.minZoom,
    );
    const maxZoom = this.parseNumber(
      this.configService.get<string>('MAP_TILE_MAX_ZOOM'),
      DEFAULT_MAP_CONFIG.maxZoom,
    );
    const cacheMaxAgeDays = Math.max(
      7,
      this.parseNumber(
        this.configService.get<string>('MAP_TILE_CACHE_MAX_AGE_DAYS'),
        DEFAULT_MAP_CONFIG.cacheMaxAgeDays,
      ),
    );
    const allowBulkPrefetch = this.parseBoolean(
      this.configService.get<string>('MAP_TILE_ALLOW_BULK_PREFETCH'),
      DEFAULT_MAP_CONFIG.allowBulkPrefetch,
    );

    return {
      urlTemplate:
        this.configService.get<string>('MAP_TILE_URL_TEMPLATE')?.trim() ||
        DEFAULT_MAP_CONFIG.urlTemplate,
      subdomains,
      attributionText:
        this.configService.get<string>('MAP_TILE_ATTRIBUTION_TEXT')?.trim() ||
        this.configService.get<string>('MAP_TILE_ATTRIBUTION')?.trim() ||
        DEFAULT_MAP_CONFIG.attributionText,
      attributionUrl:
        this.configService.get<string>('MAP_TILE_ATTRIBUTION_URL')?.trim() ||
        DEFAULT_MAP_CONFIG.attributionUrl,
      fixMapUrl:
        this.configService.get<string>('MAP_TILE_FIX_MAP_URL')?.trim() ||
        DEFAULT_MAP_CONFIG.fixMapUrl,
      minZoom,
      maxZoom,
      userAgent:
        this.configService.get<string>('MAP_TILE_USER_AGENT')?.trim() ||
        DEFAULT_MAP_CONFIG.userAgent,
      cacheMaxAgeDays,
      allowBulkPrefetch,
    };
  }

  private parseNumber(value: string | undefined, fallback: number): number {
    if (value === undefined || value.trim() === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value.trim() === '') return fallback;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    return fallback;
  }
}
