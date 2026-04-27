/**
 * video-queue.module.ts
 *
 * Wires the BullMQ video-render queue, worker, and jobs controller.
 *
 * Exports VideoQueueService so ProductRunModule can inject it.
 * JobsController is registered here — AppModule imports this module.
 *
 * Dependencies:
 *   - ExecutionGatewayModule  (gateway for video rendering)
 *   - ScoringModule, MemoryModule, LearningModule, EvolutionModule
 *   - SmartRoutingModule      (@Global — no explicit import needed)
 *   - FatigueModule, MirofishModule
 */

import { Module }                  from '@nestjs/common';
import { VideoQueueService }       from './video-queue.service';
import { VideoWorkerService }      from './video-worker.service';
import { JobsController }          from './jobs.controller';
import { ExecutionGatewayModule }  from '../creative-os/lib/execution-gateway.module';
import { ScoringModule }           from '../scoring/scoring.module';
import { MemoryModule }            from '../memory/memory.module';
import { LearningModule }          from '../learning/learning.module';
import { EvolutionModule }         from '../evolution/evolution.module';
import { FatigueModule }           from '../fatigue/fatigue.module';
import { MirofishModule }          from '../mirofish/mirofish.module';

@Module({
  imports: [
    ExecutionGatewayModule,
    ScoringModule,
    MemoryModule,
    LearningModule,
    EvolutionModule,
    FatigueModule,
    MirofishModule,
  ],
  controllers: [JobsController],
  providers:   [VideoQueueService, VideoWorkerService],
  exports:     [VideoQueueService],
})
export class VideoQueueModule {}
