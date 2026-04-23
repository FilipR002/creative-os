import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { SmartRoutingService }  from './routing.service';
import { RoutingContext }        from './routing.types';

@Controller('api/routing')
export class RoutingController {
  constructor(private readonly routing: SmartRoutingService) {}

  /**
   * INTERNAL ONLY — NO DIRECT UI ACCESS
   * Called internally by the generation pipeline to select AI model / routing strategy.
   *
   * POST /api/routing/decide
   * Body: RoutingContext
   * Response: RoutingDecision
   * Idempotent — same context always produces the same decision.
   */
  @Post('decide')
  decide(@Body() ctx: RoutingContext) {
    return this.routing.decide(ctx);
  }
}
