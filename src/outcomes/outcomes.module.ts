import { Module }                   from '@nestjs/common';
import { OutcomesController }       from './outcomes.controller';
import { OutcomesService }          from './outcomes.service';
import { AutonomousLoopModule }     from '../autonomous-loop/autonomous-loop.module';
import { CreativeDNAModule }        from '../creative-dna/creative-dna.module';
import { CausalAttributionModule }  from '../causal-attribution/causal-attribution.module';
import { UserInsightModule }        from '../user-insight/user-insight.module';
import { RealityModule }            from '../reality/reality.module';

@Module({
  imports:     [AutonomousLoopModule, CreativeDNAModule, CausalAttributionModule, UserInsightModule, RealityModule],
  controllers: [OutcomesController],
  providers:   [OutcomesService],
  exports:     [OutcomesService],
})
export class OutcomesModule {}
