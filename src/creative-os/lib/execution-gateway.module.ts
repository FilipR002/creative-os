/**
 * execution-gateway.module.ts
 *
 * Standalone module that provides and exports ExecutionGatewayService.
 *
 * Import this module wherever you need to call ExecutionGatewayService.
 * This is the ONLY way to access render services (Video, Carousel, Banner,
 * Kling, Veo). No other module may import VideoService / CarouselService /
 * BannerService directly for creative generation.
 *
 * Imported by:
 *   - CreativeOSModule     (main creative-os pipeline)
 *   - ProductRunModule     (product-run pipeline)
 *   - FunnelRouterModule   (funnel router dispatch)
 *   - CreativeOSV2Module   (v2 orchestrator)
 */

import { Module, forwardRef } from '@nestjs/common';

import { VideoModule }       from '../../video/video.module';
import { CarouselModule }    from '../../carousel/carousel.module';
import { BannerModule }      from '../../banner/banner.module';
import { VeoModule }         from '../../veo/veo.module';
import { UGCModule }         from '../../ugc/ugc.module';
import { PrismaModule }      from '../../prisma/prisma.module';
import { BillingModule }     from '../../billing/billing.module';
import { ElevenLabsModule }  from '../../elevenlabs/elevenlabs.module';

import { ExecutionGatewayService } from './execution-gateway';

@Module({
  imports: [
    forwardRef(() => VideoModule),
    forwardRef(() => CarouselModule),
    forwardRef(() => BannerModule),
    VeoModule,
    UGCModule,
    PrismaModule,
    BillingModule,
    ElevenLabsModule,   // Phase 5 — TTS voiceover for video renders
  ],
  providers: [ExecutionGatewayService],
  exports:   [ExecutionGatewayService],
})
export class ExecutionGatewayModule {}
