import { Module, forwardRef } from '@nestjs/common';
import { BannerController }   from './banner.controller';
import { BannerService }      from './banner.service';
import { CampaignModule }     from '../campaign/campaign.module';
import { ImageModule }        from '../image/image.module';
import { CompositorModule }   from '../compositor/compositor.module';
import { UserStyleModule }    from '../user-style/user-style.module';

@Module({
  imports:     [forwardRef(() => CampaignModule), ImageModule, CompositorModule, UserStyleModule],
  controllers: [BannerController],
  providers:   [BannerService],
  exports:     [BannerService],
})
export class BannerModule {}
