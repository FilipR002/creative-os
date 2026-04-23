import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller';
import { LearningService }    from './learning.service';
import { MirofishModule }     from '../mirofish/mirofish.module';

@Module({
  imports:     [MirofishModule],
  controllers: [LearningController],
  providers:   [LearningService],
  exports:     [LearningService],
})
export class LearningModule {}
