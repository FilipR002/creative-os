import { Module } from '@nestjs/common';
import { AngleController }      from './angle.controller';
import { AngleService }         from './angle.service';
import { LearningModule }       from '../learning/learning.module';
import { MirofishModule }       from '../mirofish/mirofish.module';
import { FatigueModule }        from '../fatigue/fatigue.module';
import { ExplorationModule }    from '../exploration/exploration.module';
import { OutcomesModule }       from '../outcomes/outcomes.module';
import { AngleInsightsModule }      from '../angle-insights/angle-insights.module';
import { AutonomousLoopModule }     from '../autonomous-loop/autonomous-loop.module';

@Module({
  imports:     [LearningModule, MirofishModule, FatigueModule, ExplorationModule, OutcomesModule, AngleInsightsModule, AutonomousLoopModule],
  controllers: [AngleController],
  providers:   [AngleService],
  exports:     [AngleService],
})
export class AngleModule {}
