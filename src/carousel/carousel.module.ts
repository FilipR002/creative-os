import { Module, forwardRef } from '@nestjs/common';
import { CarouselController } from './carousel.controller';
import { CarouselService } from './carousel.service';
import { CampaignModule } from '../campaign/campaign.module';
import { ImageModule } from '../image/image.module';
import { CompositorModule } from '../compositor/compositor.module';

@Module({
  imports:     [forwardRef(() => CampaignModule), ImageModule, CompositorModule],
  controllers: [CarouselController],
  providers:   [CarouselService],
  exports:     [CarouselService],
})
export class CarouselModule {}
