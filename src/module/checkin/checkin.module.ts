import { Module } from '@nestjs/common';
import { CheckinService } from './checkin.service';
import { CheckinController } from './checkin.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CheckInSchema, CheckInTemplate } from './persistence/checkin.schema';
import { CheckInDao } from './persistence/checkin.dao';
import { TaskModule } from '../task/task.module';
import { ProjectModule } from '../project/project.module';
import { MoveSchema, MoveTemplate } from './persistence/move.schema';
import { MoveDao } from './persistence/move.dao';
import { GamificationModule } from '../gamification/gamification.module';
import { StorageModule } from '../storage/storage.module';
import {
  CheckinIdempotencySchema,
  CheckinIdempotencyTemplate,
} from './persistence/checkin-idempotency.schema';
import { CheckinIdempotencyDao } from './persistence/checkin-idempotency.dao';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CheckInTemplate.collectionName(), schema: CheckInSchema },
      { name: MoveTemplate.collectionName(), schema: MoveSchema },
      {
        name: CheckinIdempotencyTemplate.collectionName(),
        schema: CheckinIdempotencySchema,
      },
    ]),
    AuthModule,
    TaskModule,
    ProjectModule,
    GamificationModule,
    StorageModule,
  ],

  exports: [CheckinService, CheckInDao, MoveDao],
  controllers: [CheckinController],
  providers: [CheckinService, CheckInDao, MoveDao, CheckinIdempotencyDao],
})
export class CheckinModule {}
