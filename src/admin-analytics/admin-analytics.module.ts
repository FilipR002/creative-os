import { Module } from '@nestjs/common';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  controllers: [AdminAnalyticsController],
  providers:   [AdminAnalyticsService, AdminGuard],
})
export class AdminAnalyticsModule {}
