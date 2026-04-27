import { Module }           from '@nestjs/common';
import { ProductRunController }    from './product-run.controller';
import { ProductRunService }       from './product-run.service';
import { CampaignModule }          from '../campaign/campaign.module';
import { ConceptModule }           from '../concept/concept.module';
import { AngleModule }             from '../angle/angle.module';
import { ScoringModule }           from '../scoring/scoring.module';
import { MemoryModule }            from '../memory/memory.module';
import { LearningModule }          from '../learning/learning.module';
import { EvolutionModule }         from '../evolution/evolution.module';
import { UsersModule }             from '../users/users.module';
import { ExecutionGatewayModule }  from '../creative-os/lib/execution-gateway.module';
import { FatigueModule }           from '../fatigue/fatigue.module';
import { MirofishModule }          from '../mirofish/mirofish.module';
import { VideoQueueModule }        from '../video-queue/video-queue.module';

@Module({
  imports: [
    CampaignModule,
    ConceptModule,
    AngleModule,
    ScoringModule,
    MemoryModule,
    LearningModule,
    EvolutionModule,
    UsersModule,
    ExecutionGatewayModule,
    FatigueModule,
    MirofishModule,
    VideoQueueModule,   // async video-render queue + worker
  ],
  controllers: [ProductRunController],
  providers:   [ProductRunService],
})
export class ProductRunModule {}
