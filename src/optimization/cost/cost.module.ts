import { Global, Module }              from '@nestjs/common';
import { GlobalMemoryModule }          from '../../global-memory/global-memory.module';
import { ExecutionCacheService }       from './execution-cache.service';
import { ComputeDeduplicatorService }  from './compute-deduplicator.service';
import { OrchestrationCacheService }   from './orchestration-cache.service';
import { CostOptimizerService }        from './cost-optimizer.service';
import { CostController }              from './cost.controller';

// TrendsModule is @Global() — TrendStore injected without an import here.

@Global()
@Module({
  imports: [GlobalMemoryModule],
  providers: [
    ExecutionCacheService,
    ComputeDeduplicatorService,
    OrchestrationCacheService,
    CostOptimizerService,
  ],
  controllers: [CostController],
  exports: [
    ExecutionCacheService,
    ComputeDeduplicatorService,
    OrchestrationCacheService,
    CostOptimizerService,
  ],
})
export class CostOptimizationModule {}
