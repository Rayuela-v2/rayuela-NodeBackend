import { Test, TestingModule } from '@nestjs/testing';
import { MapsController } from './maps.controller';
import { DEFAULT_MAP_CONFIG, MapsService } from './maps.service';

describe('MapsController', () => {
  let controller: MapsController;
  let service: MapsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MapsController],
      providers: [
        {
          provide: MapsService,
          useValue: {
            getMapConfig: jest.fn(() => ({ ...DEFAULT_MAP_CONFIG })),
          },
        },
      ],
    }).compile();

    controller = module.get<MapsController>(MapsController);
    service = module.get<MapsService>(MapsService);
  });

  it('delegates GET /maps/config to MapsService.getMapConfig()', () => {
    const result = controller.getConfig();
    expect(service.getMapConfig).toHaveBeenCalledTimes(1);
    expect(result).toEqual(DEFAULT_MAP_CONFIG);
  });
});
