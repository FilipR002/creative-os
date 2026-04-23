import { Global, Module }       from '@nestjs/common';
import { SmartRoutingService }  from './routing.service';
import { RoutingController }    from './routing.controller';

/**
 * Phase 5.5 — @Global() so orchestrator, HookBooster, and Dashboard
 * can inject SmartRoutingService without importing RoutingModule.
 */
@Global()
@Module({
  providers:   [SmartRoutingService],
  controllers: [RoutingController],
  exports:     [SmartRoutingService],
})
export class SmartRoutingModule {}
