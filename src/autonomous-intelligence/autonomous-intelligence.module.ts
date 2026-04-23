import { Module }                          from '@nestjs/common';
import { PrismaModule }                    from '../prisma/prisma.module';
import { AutonomousIntelligenceService }   from './autonomous-intelligence.service';
import { AutonomousIntelligenceController } from './autonomous-intelligence.controller';

@Module({
  imports:     [PrismaModule],
  controllers: [AutonomousIntelligenceController],
  providers:   [AutonomousIntelligenceService],
  exports:     [AutonomousIntelligenceService],
})
export class AutonomousIntelligenceModule {}
