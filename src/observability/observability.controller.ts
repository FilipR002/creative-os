import { Controller, Get, Param, Query } from '@nestjs/common';
import { ObservabilityService }           from './observability.service';
import { ReplayService }                  from './replay.service';

@Controller('api/observability')
export class ObservabilityController {
  constructor(
    private readonly obs:    ObservabilityService,
    private readonly replay: ReplayService,
  ) {}

  @Get('trace/:traceId')
  getTrace(@Param('traceId') traceId: string) {
    return this.obs.getTrace(traceId);
  }

  @Get('trace/:traceId/replay')
  replayTrace(@Param('traceId') traceId: string) {
    return this.replay.replay(traceId);
  }

  @Get('campaign/:campaignId/traces')
  getByCreative(
    @Param('campaignId') campaignId: string,
    @Query('limit') limit?: string,
  ) {
    return this.obs.getTracesByCreative(campaignId, limit ? parseInt(limit, 10) : 20);
  }

  @Get('campaign/:campaignId/drift')
  analyzeDrift(@Param('campaignId') campaignId: string) {
    return this.replay.analyzeDrift(campaignId);
  }

  @Get('compare')
  compareTraces(@Query('t1') t1: string, @Query('t2') t2: string) {
    return this.replay.compareTraces(t1, t2);
  }

  @Get('status')
  status() {
    return { ok: true, engine: 'observability-v1' };
  }
}
