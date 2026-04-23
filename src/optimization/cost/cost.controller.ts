import { Body, Controller, Get, Post } from '@nestjs/common';
import { CostOptimizerService }        from './cost-optimizer.service';
import { ExecutionCacheService }       from './execution-cache.service';
import { FingerprintInput }            from './cost.types';

@Controller('api/optimization')
export class CostController {
  constructor(
    private readonly optimizer: CostOptimizerService,
    private readonly cache:     ExecutionCacheService,
  ) {}

  /**
   * Cost and cache-efficiency metrics.
   * GET /api/optimization/metrics
   */
  @Get('metrics')
  getMetrics() {
    return {
      ...this.optimizer.getMetrics(),
      cacheStats: this.cache.stats(),
    };
  }

  /**
   * INTERNAL ONLY — NO DIRECT UI ACCESS
   * Debug helper for inspecting cache fingerprint construction.
   * POST /api/optimization/fingerprint
   */
  @Post('fingerprint')
  getFingerprint(@Body() input: FingerprintInput) {
    return this.optimizer.buildFingerprint(input);
  }

  /**
   * INTERNAL ONLY — NO DIRECT UI ACCESS
   * Evict expired cache entries on demand (admin maintenance).
   * POST /api/optimization/evict
   */
  @Post('evict')
  evict() {
    const evicted = this.cache.evict();
    return { evicted };
  }
}
