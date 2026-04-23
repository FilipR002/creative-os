import { Module }               from '@nestjs/common';
import { ExplorationController } from './exploration.controller';
import { ExplorationService }    from './exploration.service';
import { PrismaModule }          from '../prisma/prisma.module';
import { FatigueModule }         from '../fatigue/fatigue.module';
import { RedisModule }           from '../redis/redis.module';
import { ExplorationDeltaStore } from './exploration-delta.store';
import { RedisExplorationDeltaStore } from './stores/redis-exploration-delta.store';

@Module({
  imports:     [PrismaModule, FatigueModule, RedisModule],
  controllers: [ExplorationController],
  providers:   [
    ExplorationService,
    { provide: ExplorationDeltaStore, useClass: RedisExplorationDeltaStore },
  ],
  exports:     [ExplorationService],
})
export class ExplorationModule {}
