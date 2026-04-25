/**
 * funnel-router.module.ts
 *
 * Full Funnel Creative OS Router Module — Phase 1.2
 *
 * External dependencies:
 *   - ExecutionGatewayModule → all carousel/banner generation (FIX 1)
 *   - UGCModule              → ViralTestService (UGC A/B/C pipeline)
 *   - PrismaModule           → campaign + concept DB access (CrossFormatSync)
 *   - MemoryModule           → pattern storage (feedback loop)
 *   - FeedbackModule         → real-metrics feedback (feedback loop)
 *   - OutcomesModule         → angle weight updates (feedback loop)
 *
 * CarouselModule and BannerModule are NO LONGER imported here directly.
 * All carousel and banner generation routes through ExecutionGatewayModule.
 */

import { Module }         from '@nestjs/common';

import { PrismaModule }   from '../prisma/prisma.module';
import { MemoryModule }   from '../memory/memory.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { OutcomesModule } from '../outcomes/outcomes.module';
import { UGCModule }      from '../ugc/ugc.module';
// FIX 1: ExecutionGatewayModule replaces direct CarouselModule + BannerModule imports
import { ExecutionGatewayModule } from '../creative-os/lib/execution-gateway.module';

import { CrossFormatSyncService }      from './cross-format-sync.service';
import { FunnelDispatchService }       from './funnel-dispatch.service';
import { FunnelMemoryFeedbackService } from './funnel-memory-feedback.service';
import { FunnelRouterService }         from './funnel-router.service';
import { FunnelRouterController }      from './funnel-router.controller';

@Module({
  imports: [
    PrismaModule,
    MemoryModule,
    FeedbackModule,
    OutcomesModule,
    UGCModule,
    ExecutionGatewayModule,
  ],
  controllers: [FunnelRouterController],
  providers: [
    CrossFormatSyncService,
    FunnelDispatchService,
    FunnelMemoryFeedbackService,
    FunnelRouterService,
  ],
  exports: [FunnelRouterService],
})
export class FunnelRouterModule {}
