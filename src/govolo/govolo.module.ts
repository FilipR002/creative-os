/**
 * govolo.module.ts
 *
 * Phase 2 — registers CreativeOSController, CreativeOSService, and the new
 * ProductionPipelineService with all its sub-system dependencies.
 *
 * All cross-module imports use forwardRef() to avoid circular dependency issues.
 * SmartRoutingService is @Global — no import needed here.
 */

import { Module, forwardRef } from '@nestjs/common';

import { CreativeOSController }    from './govolo.controller';
import { CreativeOSService }       from './govolo.service';
import { ProductionPipelineService } from './lib/production-pipeline';

import { CampaignModule }      from '../campaign/campaign.module';
import { ConceptModule }       from '../concept/concept.module';
import { VideoModule }         from '../video/video.module';
import { CarouselModule }      from '../carousel/carousel.module';
import { BannerModule }        from '../banner/banner.module';
import { HookBoosterModule }   from '../hook-booster/hook-booster.module';
import { SceneRewriterModule } from '../scene-rewriter/scene-rewriter.module';
import { CreativeDNAModule }   from '../creative-dna/creative-dna.module';
import { ScoringModule }       from '../scoring/scoring.module';
import { AutoWinnerModule }    from '../auto-winner/auto-winner.module';
import { OutcomesModule }      from '../outcomes/outcomes.module';
import { LearningModule }      from '../learning/learning.module';

@Module({
  imports: [
    forwardRef(() => CampaignModule),
    forwardRef(() => ConceptModule),
    forwardRef(() => VideoModule),
    forwardRef(() => CarouselModule),
    forwardRef(() => BannerModule),
    HookBoosterModule,
    SceneRewriterModule,
    CreativeDNAModule,
    forwardRef(() => ScoringModule),
    AutoWinnerModule,
    OutcomesModule,
    LearningModule,
  ],
  controllers: [CreativeOSController],
  providers:   [CreativeOSService, ProductionPipelineService],
  exports:     [CreativeOSService],
})
export class CreativeOSModule {}
