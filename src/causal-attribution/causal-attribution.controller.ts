import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags }     from '@nestjs/swagger';
import { CausalAttributionService }            from './causal-attribution.service';

@ApiTags('causal-attribution')
@Controller('api/causal-attribution')
export class CausalAttributionController {
  constructor(private readonly service: CausalAttributionService) {}

  @Post('analyze/:campaignId')
  @ApiOperation({ summary: 'Run causal attribution for a campaign (uses most recent outcome)' })
  analyze(@Param('campaignId') campaignId: string) {
    return this.service.analyzeOutcome(campaignId);
  }

  @Get('campaign/:campaignId')
  @ApiOperation({ summary: 'Fetch all causal traces for a campaign' })
  forCampaign(@Param('campaignId') campaignId: string) {
    return this.service.getTracesForCampaign(campaignId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Aggregate causal attribution summary across all campaigns' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  summary(@Query('days') days?: string) {
    return this.service.getSystemCausalSummary(days ? parseInt(days, 10) : 30);
  }
}
