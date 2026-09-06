import { Module } from '@nestjs/common';
import { GamificationIndicatorsController } from './gamification-indicators.controller';
import { GamificationIndicatorsService } from './gamification-indicators.service';
import { VanishingBadgesStrategy } from './domain/vanishing-badges.strategy';
import { INDICATOR_FORMULA_STRATEGY } from './domain/formula-strategy.interface';
import { CheckinModule } from '../checkin/checkin.module';
import { AuthModule } from '../auth/auth.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [CheckinModule, AuthModule, GamificationModule],
  controllers: [GamificationIndicatorsController],
  providers: [
    GamificationIndicatorsService,
    VanishingBadgesStrategy,
    {
      provide: INDICATOR_FORMULA_STRATEGY,
      useClass: VanishingBadgesStrategy,
    },
  ],
  exports: [GamificationIndicatorsService],
})
export class GamificationIndicatorsModule {}
