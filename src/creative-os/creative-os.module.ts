/**
 * creative-os.module.ts
 *
 * Phase 3 — Execution Gateway Fix
 *
 * All creative generation now routes through ExecutionGatewayService.
 * RoutingContext is populated with real signals from FatigueService + MirofishService.
 * CreativePlan from Creative Director is generated in parallel and passed as first-class input.
 *
 * Module imports:
 *   - VideoModule / CarouselModule / BannerModule  — consumed by ExecutionGatewayService only
 *   - FatigueModule                                — provides FatigueService (real routing signal)
 *   - MirofishModule                               — provides MirofishService (real routing signal)
 *   - SmartRoutingModule                           — @Global, no import needed
 *
 * All cross-module imports use forwardRef() to prevent circular dependency issues.
 */

import { Module, forwardRef } from '@nestjs/common';

import { CreativeOSController }      from './creative-os.controller';
import { CreativeOSService }         from './creative-os.service';
import { ProductionPipelineService } from './lib/production-pipeline';

import { ExecutionGatewayModule }    from './lib/execution-gateway.module';

import { CampaignModule }      from '../campaign/campaign.module';
import { ConceptModule }       from '../concept/concept.module';
import { HookBoosterModule }   from '../hook-booster/hook-booster.module';
import { SceneRewriterModule } from '../scene-rewriter/scene-rewriter.module';
import { CreativeDNAModule }   from '../creative-dna/creative-dna.module';
import { FatigueModule }       from '../fatigue/fatigue.module';
import { MirofishModule }      from '../mirofish/mirofish.module';
import { ScoringModule }       from '../scoring/scoring.module';
import { AutoWinnerModule }    from '../auto-winner/auto-winner.module';
import { OutcomesModule }      from '../outcomes/outcomes.module';
import { LearningModule }      from '../learning/learning.module';
import { PrismaModule }        from '../prisma/prisma.module';

@Module({
  imports: [
    forwardRef(() => CampaignModule),
    forwardRef(() => ConceptModule),
    // All render services (Video, Carousel, Banner, Kling, Veo, Stitcher) are
    // provided by ExecutionGatewayModule. CreativeOSModule never imports them directly.
    ExecutionGatewayModule,
    HookBoosterModule,
    SceneRewriterModule,
    CreativeDNAModule,
    // Real routing signal providers (replace hardcoded constants)
    FatigueModule,
    forwardRef(() => MirofishModule),
    forwardRef(() => ScoringModule),
    AutoWinnerModule,
    OutcomesModule,
    LearningModule,
    // FIX 7: PrismaModule for blueprint persistence in ProductionPipelineService
    PrismaModule,
  ],
  controllers: [CreativeOSController],
  providers: [
    CreativeOSService,
    ProductionPipelineService,
  ],
  exports: [CreativeOSService],
})
export class CreativeOSModule {}
