import { Module, forwardRef } from '@nestjs/common';
import { ImprovementController } from './improvement.controller';
import { ImprovementService } from './improvement.service';
import { ScoringModule } from '../scoring/scoring.module';
import { VideoModule } from '../video/video.module';
import { CampaignModule } from '../campaign/campaign.module';

@Module({
  imports:     [ScoringModule, VideoModule, forwardRef(() => CampaignModule)],
  controllers: [ImprovementController],
  providers:   [ImprovementService],
  exports:     [ImprovementService],
})
export class ImprovementModule {}
