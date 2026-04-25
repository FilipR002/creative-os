/**
 * ugc.module.ts
 *
 * UGC Engine Module — Phase 1 + Phase 1.1
 *
 * External module dependencies:
 *   - PrismaModule     — campaign / concept DB access
 *   - RedisModule      — queue storage (global, auto-available)
 *   - ScoringModule    — creative scoring after render
 *   - LearningModule   — learning cycle trigger after render
 *   - MemoryModule     — winner pattern storage (Phase 1.1)
 *   - FeedbackModule   — real-metric feedback (Phase 1.1)
 *   - OutcomesModule   — angle weight updates (Phase 1.1)
 */

import { Module }          from '@nestjs/common';

import { PrismaModule }    from '../prisma/prisma.module';
import { BillingModule }   from '../billing/billing.module';
import { ScoringModule }   from '../scoring/scoring.module';
import { LearningModule }  from '../learning/learning.module';
import { MemoryModule }    from '../memory/memory.module';
import { FeedbackModule }  from '../feedback/feedback.module';
import { OutcomesModule }  from '../outcomes/outcomes.module';

// ── Phase 1 services ──────────────────────────────────────────────────────────
import { PersonaService }       from './persona.service';
import { UGCBrainService }      from './ugc-brain.service';
import { VariantService }       from './variant.service';
import { KlingCompilerService } from './kling-compiler.service';
import { KlingApiService }      from './kling-api.service';
import { UGCQueueService }      from './queue/queue.service';
import { UGCQueueProcessor }    from './queue/queue.processor';
import { StitcherService }      from './stitcher/stitcher.service';
import { UGCService }           from './ugc.service';
import { UGCController }        from './ugc.controller';

// ── Phase 1.1 services ────────────────────────────────────────────────────────
import { PersonaSplitterService }    from './persona-splitter.service';
import { ExpandedVariantService }    from './expanded-variant.service';
import { UGCScoringService }         from './ugc-scoring.service';
import { UGCWinnerService }          from './ugc-winner.service';
import { UGCMemoryFeedbackService }  from './ugc-memory-feedback.service';
import { ViralTestService }          from './viral-test.service';
import { ViralTestController }       from './viral-test.controller';

@Module({
  imports: [
    PrismaModule,
    BillingModule,
    ScoringModule,
    LearningModule,
    MemoryModule,
    FeedbackModule,
    OutcomesModule,
  ],
  controllers: [
    UGCController,
    ViralTestController,
  ],
  providers: [
    // ── Brain layer (Phase 1) ────────────────────────────────────────────────
    PersonaService,
    UGCBrainService,
    VariantService,

    // ── Phase 1.1: Multi-persona splitter + expanded variant matrix ──────────
    PersonaSplitterService,
    ExpandedVariantService,

    // ── Compilation ──────────────────────────────────────────────────────────
    KlingCompilerService,

    // ── API ──────────────────────────────────────────────────────────────────
    KlingApiService,

    // ── Queue infrastructure ─────────────────────────────────────────────────
    UGCQueueService,
    UGCQueueProcessor,

    // ── Stitching ────────────────────────────────────────────────────────────
    StitcherService,

    // ── Phase 1.1: Scoring + Winner + Memory Feedback ────────────────────────
    UGCScoringService,
    UGCWinnerService,
    UGCMemoryFeedbackService,

    // ── Orchestrators ─────────────────────────────────────────────────────────
    UGCService,
    ViralTestService,
  ],
  exports: [
    UGCService,
    UGCQueueService,
    ViralTestService,
    // Exported so ExecutionGatewayService can use them for scene rendering in the main pipeline
    KlingApiService,
    StitcherService,
  ],
})
export class UGCModule {}
