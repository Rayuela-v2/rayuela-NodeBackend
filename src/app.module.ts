import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectModule } from './module/project/project.module';
import { AuthModule } from './module/auth/auth.module';
import { TaskModule } from './module/task/task.module';
import { CheckinModule } from './module/checkin/checkin.module';
import { VolunteerModule } from './module/volunteer/volunteer.module';
import { GamificationModule } from './module/gamification/gamification.module';
import { LeaderboardModule } from './module/leaderboard/leaderboard.module';
import { StorageModule } from './module/storage/storage.module';
import { AnalyticsModule } from './module/analytics/analytics.module';
import { HealthModule } from './module/health/health.module';
import { GamificationIndicatorsModule } from './module/gamification-indicators/gamification-indicators.module';

console.log(process.env.DB_CONNECTION as string);
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Hace que las variables estén disponibles globalmente
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`, // Carga el archivo según el entorno
    }),
    MongooseModule.forRoot(process.env.DB_CONNECTION as string),
    ProjectModule,
    AuthModule,
    TaskModule,
    CheckinModule,
    VolunteerModule,
    GamificationModule,
    GamificationIndicatorsModule,
    LeaderboardModule,
    StorageModule,
    AnalyticsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
