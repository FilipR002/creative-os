import { Module }               from '@nestjs/common';
import { CreativeAiController } from './creative-ai.controller';
import { CreativeAiService }    from './creative-ai.service';
import { AngleInsightsModule }  from '../angle-insights/angle-insights.module';
import { AutonomousLoopModule } from '../autonomous-loop/autonomous-loop.module';
import { CreativeDNAModule }    from '../creative-dna/creative-dna.module';

@Module({
  imports:     [AngleInsightsModule, AutonomousLoopModule, CreativeDNAModule],
  controllers: [CreativeAiController],
  providers:   [CreativeAiService],
  exports:     [CreativeAiService],
})
export class CreativeAiModule {}
