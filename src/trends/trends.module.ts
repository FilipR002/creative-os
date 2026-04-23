import { Global, Module }              from '@nestjs/common';
import { TrendStore }                  from './trend-store.service';
import { TrendIntelligenceService }    from './trend-intelligence.service';

/**
 * Phase 5.3 — @Global() so orchestrator, HookBooster, and SmartRouter
 * can inject TrendIntelligenceService without importing TrendsModule.
 */
@Global()
@Module({
  providers: [TrendStore, TrendIntelligenceService],
  exports:   [TrendStore, TrendIntelligenceService],
})
export class TrendsModule {}
