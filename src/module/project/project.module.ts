import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectTemplate, ProjectSchema } from './persistence/project.schema';
import { ProjectDao } from './persistence/project.dao';
import { AuthModule } from '../auth/auth.module';
import { GamificationModule } from '../gamification/gamification.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

import {
  CheckInSchema,
  CheckInTemplate,
} from '../checkin/persistence/checkin.schema';

@Module({
  imports: [
    LeaderboardModule,
    MongooseModule.forFeature([
      { name: ProjectTemplate.collectionName(), schema: ProjectSchema },
      { name: CheckInTemplate.collectionName(), schema: CheckInSchema },
    ]),
    AuthModule,
    GamificationModule,
  ],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectDao],
  exports: [ProjectService, ProjectDao],
})
export class ProjectModule {}
