import { Module }               from '@nestjs/common';
import { FatigueModule }        from '../../fatigue/fatigue.module';
import { GlobalMemoryModule }   from '../../global-memory/global-memory.module';
import { PerformanceService }   from './performance.service';
import { PerformanceController } from './performance.controller';

// CrossClientLearningModule, TrendsModule, and PlatformModule are @Global()
// and do not need to be imported here.

@Module({
  imports:     [FatigueModule, GlobalMemoryModule],
  providers:   [PerformanceService],
  controllers: [PerformanceController],
  exports:     [PerformanceService],
})
export class PerformanceDashboardModule {}
