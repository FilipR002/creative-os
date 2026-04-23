import { Module } from '@nestjs/common';
import { GenerationsService } from './generations.service';
import {
  FeedbackController,
  GenerationsController,
  VersionsController,
} from './generations.controller';

@Module({
  controllers: [GenerationsController, VersionsController, FeedbackController],
  providers:   [GenerationsService],
  exports:     [GenerationsService],
})
export class GenerationsModule {}
