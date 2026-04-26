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
 *   - FatigueModule          → FatigueService (real per-angle fatigue state) [FIX 2]
 *   - MirofishModule         → MirofishService (real confidence signal)       [FIX 2]
 *
 * TrendIntelligenceService is @Global — no import needed.
 * SmartRoutingService is @Global — no import needed.
 *
 * V2 does NOT import CarouselModule or BannerModule directly.
 * All carousel/banner generation routes through ExecutionGatewayModule (FIX 1).
 *
 * FeedbackService removed — V2 no longer calls submitRealMetrics()
 * with synthetic ugcScoreEstimate data.
 */

import { Module }          from '@nestjs/common';

import { ExecutionGatewayModule } from '../creative-os/lib/execution-gateway.module';
import { FunnelRouterModule }     from '../funnel-router/funnel-router.module';
import { UGCModule }              from '../ugc/ugc.module';
import { MemoryModule }           from '../memory/memory.module';
import { OutcomesModule }         from '../outcomes/outcomes.module';
import { FatigueModule }          from '../fatigue/fatigue.module';   // Fix 2
import { MirofishModule }         from '../mirofish/mirofish.module'; // Fix 2

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
    FatigueModule,   // Fix 2: real fatigueState + signals
    MirofishModule,  // Fix 2: real mirofishConfidence
  ],
  controllers: [V2Controller],
  providers: [
    V2BrainService,
    V2OrchestratorService,
  ],
  exports: [V2OrchestratorService],
})
export class CreativeOSV2Module {}
