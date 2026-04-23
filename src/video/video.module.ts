import { Module, forwardRef } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { HookBoosterService } from './hook-booster.service';
import { CampaignModule } from '../campaign/campaign.module';
import { ImageModule } from '../image/image.module';

@Module({
  imports:     [forwardRef(() => CampaignModule), ImageModule],
  controllers: [VideoController],
  providers:   [VideoService, HookBoosterService],
  exports:     [VideoService, HookBoosterService],
})
export class VideoModule {}
