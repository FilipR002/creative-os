import { Module }                    from '@nestjs/common';
import { OrchestratorController }    from './orchestrator.controller';
import { OrchestratorService }       from './orchestrator.service';
import { ExecutionStoreService }     from './execution/execution-store.service';
import { AngleModule }               from '../angle/angle.module';
import { LearningModule }            from '../learning/learning.module';
import { MirofishModule }            from '../mirofish/mirofish.module';
import { FatigueModule }             from '../fatigue/fatigue.module';
import { ExplorationModule }         from '../exploration/exploration.module';

@Module({
  imports:     [AngleModule, LearningModule, MirofishModule, FatigueModule, ExplorationModule],
  controllers: [OrchestratorController],
  providers:   [OrchestratorService, ExecutionStoreService],
  exports:     [OrchestratorService, ExecutionStoreService],
})
export class OrchestratorModule {}
