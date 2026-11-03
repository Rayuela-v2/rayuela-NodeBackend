import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_MAP_CONFIG, MapsService } from './maps.service';

describe('MapsService', () => {
  let service: MapsService;
  let envStore: Record<string, string | undefined>;

  beforeEach(async () => {
    envStore = {};
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => envStore[key]),
          },
        },
      ],
    }).compile();

    service = module.get<MapsService>(MapsService);
  });

  it('returns compliant OSM defaults when no environment variables are set', () => {
    const config = service.getMapConfig();
    expect(config).toEqual(DEFAULT_MAP_CONFIG);
    expect(config.urlTemplate).toBe(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    expect(config.allowBulkPrefetch).toBe(false);
    expect(config.cacheMaxAgeDays).toBe(14);
    expect(config.userAgent).toBe(
      'RayuelaMobile/1.0 (+https://github.com/Rayuela-v2)',
    );
  });

  it('applies custom environment variable overrides', () => {
    envStore = {
      MAP_TILE_URL_TEMPLATE:
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      MAP_TILE_SUBDOMAINS: 'a, b, c',
      MAP_TILE_ATTRIBUTION_TEXT: '© OpenStreetMap contributors, © CARTO',
      MAP_TILE_ATTRIBUTION_URL: 'https://carto.com/attributions',
      MAP_TILE_FIX_MAP_URL: 'https://www.openstreetmap.org/fixthemap',
      MAP_TILE_MIN_ZOOM: '3',
      MAP_TILE_MAX_ZOOM: '20',
      MAP_TILE_USER_AGENT: 'CustomRayuela/2.0',
      MAP_TILE_CACHE_MAX_AGE_DAYS: '30',
      MAP_TILE_ALLOW_BULK_PREFETCH: 'true',
    };

    const config = service.getMapConfig();
    expect(config).toEqual({
      urlTemplate:
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c'],
      attributionText: '© OpenStreetMap contributors, © CARTO',
      attributionUrl: 'https://carto.com/attributions',
      fixMapUrl: 'https://www.openstreetmap.org/fixthemap',
      minZoom: 3,
      maxZoom: 20,
      userAgent: 'CustomRayuela/2.0',
      cacheMaxAgeDays: 30,
      allowBulkPrefetch: true,
    });
  });

  it('enforces a minimum cacheMaxAgeDays of 7 per OSM policy and falls back on invalid numbers', () => {
    envStore = {
      MAP_TILE_CACHE_MAX_AGE_DAYS: '2',
      MAP_TILE_MIN_ZOOM: 'not-a-number',
      MAP_TILE_ALLOW_BULK_PREFETCH: '0',
    };

    const config = service.getMapConfig();
    expect(config.cacheMaxAgeDays).toBe(7);
    expect(config.minZoom).toBe(DEFAULT_MAP_CONFIG.minZoom);
    expect(config.allowBulkPrefetch).toBe(false);
  });
});
