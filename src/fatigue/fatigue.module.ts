import { Module }             from '@nestjs/common';
import { FatigueController }  from './fatigue.controller';
import { FatigueService }     from './fatigue.service';
import { PrismaModule }       from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [FatigueController],
  providers:   [FatigueService],
  exports:     [FatigueService],
})
export class FatigueModule {}
