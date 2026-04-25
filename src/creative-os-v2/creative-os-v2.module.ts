/**
 * creative-os-v2.module.ts
 *
 * Creative OS v2 Module — Unified Master Schema Engine (Phase 2)
 *
 * External dependencies:
 *   - ExecutionGatewayModule → carousel + banner generation  [FIX 1]
 *   - FunnelRouterModule     → CrossFormatSyncService (shared core builder)
 *   - UGCModule              → ViralTestService (A/B/C UGC pipeline)
 *   - MemoryModule           → MemoryService (learning block + feedback)
 *   - OutcomesModule         → OutcomesService (angle weight update)
 *
 * V2 does NOT import CarouselModule or BannerModule directly.
 * All carousel/banner generation routes through ExecutionGatewayModule (FIX 1).
 *
 * FeedbackService removed — V2 no longer calls submitRealMetrics()
 * with synthetic ugcScoreEstimate data (FIX 5).
 */

import { Module }          from '@nestjs/common';

import { ExecutionGatewayModule } from '../creative-os/lib/execution-gateway.module';
import { FunnelRouterModule }     from '../funnel-router/funnel-router.module';
import { UGCModule }              from '../ugc/ugc.module';
import { MemoryModule }           from '../memory/memory.module';
import { OutcomesModule }         from '../outcomes/outcomes.module';

import { V2BrainService }        from './v2.brain.service';
import { V2OrchestratorService } from './v2.orchestrator.service';
import { V2Controller }          from './v2.controller';

@Module({
  imports: [
    ExecutionGatewayModule,
    FunnelRouterModule,
    UGCModule,
    MemoryModule,
    OutcomesModule,
  ],
  controllers: [V2Controller],
  providers: [
    V2BrainService,
    V2OrchestratorService,
  ],
  exports: [V2OrchestratorService],
})
export class CreativeOSV2Module {}
