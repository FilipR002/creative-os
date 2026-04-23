import { Module, forwardRef }         from '@nestjs/common';
import { ScoringController }           from './scoring.controller';
import { ScoringService }              from './scoring.service';
import { MemoryModule }                from '../memory/memory.module';
import { LearningModule }              from '../learning/learning.module';
import { MirofishModule }              from '../mirofish/mirofish.module';
import { EvolutionModule }             from '../evolution/evolution.module';
import { CausalAttributionModule }     from '../causal-attribution/causal-attribution.module';
import { UserInsightModule }           from '../user-insight/user-insight.module';

@Module({
  imports: [
    forwardRef(() => MemoryModule),
    LearningModule,
    MirofishModule,
    EvolutionModule,
    CausalAttributionModule,
    UserInsightModule,
  ],
  controllers: [ScoringController],
  providers:   [ScoringService],
  exports:     [ScoringService],
})
export class ScoringModule {}
