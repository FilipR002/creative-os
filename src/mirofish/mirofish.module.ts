import { Module } from '@nestjs/common';
import { MirofishController }        from './mirofish.controller';
import { MirofishService }           from './mirofish.service';
import { MirofishLearningService }   from './mirofish.learning.service';
import { RedisModule }               from '../redis/redis.module';

@Module({
  imports:     [RedisModule],
  controllers: [MirofishController],
  providers:   [MirofishService, MirofishLearningService],
  exports:     [MirofishService, MirofishLearningService],
})
export class MirofishModule {}
