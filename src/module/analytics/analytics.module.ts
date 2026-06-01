import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsDao } from './analytics.dao';
import {
  CheckInSchema,
  CheckInTemplate,
} from '../checkin/persistence/checkin.schema';
import { MoveSchema, MoveTemplate } from '../checkin/persistence/move.schema';
import {
  ProjectSchema,
  ProjectTemplate,
} from '../project/persistence/project.schema';
import {
  TaskSchema,
  TaskSchemaTemplate,
} from '../task/persistence/task.schema';
import { UserSchema, UserTemplate } from '../auth/users/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CheckInTemplate.collectionName(), schema: CheckInSchema },
      { name: MoveTemplate.collectionName(), schema: MoveSchema },
      { name: ProjectTemplate.collectionName(), schema: ProjectSchema },
      { name: UserTemplate.collectionName(), schema: UserSchema },
      { name: TaskSchemaTemplate.collectionName(), schema: TaskSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsDao],
})
export class AnalyticsModule {}
