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
// W3: Real routing signals — SmartRoutingModule is @Global (no import needed).
// FatigueModule and MirofishModule must be imported explicitly.
import { FatigueModule }           from '../fatigue/fatigue.module';
import { MirofishModule }          from '../mirofish/mirofish.module';

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
    FatigueModule,    // W3: real angle fatigue signals
    MirofishModule,   // W3: real mirofish prediction confidence
  ],
  controllers: [ProductRunController],
  providers:   [ProductRunService],
})
export class ProductRunModule {}
