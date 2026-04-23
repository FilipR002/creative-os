import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiOperation, ApiTags }              from '@nestjs/swagger';
import { AdIntelligenceService }              from './ad-intelligence.service';

@ApiTags('Ad Intelligence')
@Controller('api/ads')
export class AdIntelligenceController {
  constructor(private readonly svc: AdIntelligenceService) {}

  @Post('aggregate')
  @ApiOperation({ summary: 'Aggregate ads from all CI results + normalize by platform' })
  aggregate(@Body() body: { urls?: string[] }) {
    return this.svc.aggregate(body.urls);
  }

  @Get('aggregate/jobs')
  @ApiOperation({ summary: 'List aggregation jobs' })
  getJobs() { return { jobs: this.svc.getJobs() }; }

  @Get('platform-analysis')
  @ApiOperation({ summary: 'Platform-specific breakdown (meta/tiktok/google/youtube)' })
  getPlatformAnalysis() {
    return { platforms: this.svc.getPlatformAnalysis() };
  }

  @Get('unified-insights')
  @ApiOperation({ summary: 'Cross-platform patterns, universal hooks, recommended platforms' })
  getUnifiedInsights() {
    return this.svc.getUnifiedInsights();
  }

  @Get('all')
  @ApiOperation({ summary: 'All normalized ads across all platforms' })
  getAllAds() {
    return { ads: this.svc.getAllAds() };
  }

  @Post('generate-multi-platform')
  @ApiOperation({ summary: 'Generate platform-optimized ad variants from a hook/trigger' })
  generateMultiPlatform(@Body() body: { hook: string; emotionalTrigger: string; brand: string }) {
    return {
      variants: this.svc.generateMultiPlatformAd(body.hook, body.emotionalTrigger, body.brand),
      source: 'multi_platform_intelligence',
    };
  }
}
