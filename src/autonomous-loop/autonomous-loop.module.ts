import { Module }                     from '@nestjs/common';
import { AutonomousLoopController }   from './autonomous-loop.controller';
import { AutonomousLoopService }      from './autonomous-loop.service';
import { EvolutionModule }            from '../evolution/evolution.module';

@Module({
  imports:     [EvolutionModule],
  controllers: [AutonomousLoopController],
  providers:   [AutonomousLoopService],
  exports:     [AutonomousLoopService],
})
export class AutonomousLoopModule {}
