/**
 * govolo.module.ts
 *
 * Registers GovoloController and GovoloService.
 * Uses forwardRef on every imported module to avoid circular dependency issues
 * (GovoloService injects services from modules that also import CampaignModule etc.).
 */

import { Module, forwardRef } from '@nestjs/common';

import { GovoloController } from './govolo.controller';
import { GovoloService }    from './govolo.service';

import { CampaignModule }  from '../campaign/campaign.module';
import { ConceptModule }   from '../concept/concept.module';
import { VideoModule }     from '../video/video.module';
import { CarouselModule }  from '../carousel/carousel.module';
import { BannerModule }    from '../banner/banner.module';

@Module({
  imports: [
    forwardRef(() => CampaignModule),
    forwardRef(() => ConceptModule),
    forwardRef(() => VideoModule),
    forwardRef(() => CarouselModule),
    forwardRef(() => BannerModule),
  ],
  controllers: [GovoloController],
  providers:   [GovoloService],
  exports:     [GovoloService],
})
export class GovoloModule {}
