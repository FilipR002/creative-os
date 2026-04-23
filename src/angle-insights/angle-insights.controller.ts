import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags }  from '@nestjs/swagger';
import { AngleInsightsService, CreateInsightDto } from './angle-insights.service';
import { InsightPatternService }  from './insight-pattern.service';

@ApiTags('angle-insights')
@Controller('angle-insights')
export class AngleInsightsController {
  constructor(
    private readonly service:  AngleInsightsService,
    private readonly patterns: InsightPatternService,
  ) {}

  // INTERNAL ONLY — NO DIRECT UI ACCESS (called by batch ingestion scripts/pipeline)
  @Post()
  @ApiOperation({ summary: '[INTERNAL] Store a single vision insight' })
  create(@Body() dto: CreateInsightDto) {
    return this.service.create(dto);
  }

  // INTERNAL ONLY — NO DIRECT UI ACCESS (bulk batch ingestion pipeline)
  @Post('bulk')
  @ApiOperation({ summary: '[INTERNAL] Bulk-store vision insights (from batch script)' })
  bulkCreate(@Body() body: { items: CreateInsightDto[] }) {
    return this.service.bulkCreate(body.items);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Aggregated insight summary grouped by angle' })
  summary() {
    return this.service.getSummaryByAngle();
  }

  @Get()
  @ApiOperation({ summary: 'All stored insights' })
  getAll(@Query('limit') limit?: string) {
    return this.service.getAll(limit ? Number(limit) : 100);
  }

  @Get(':angleSlug')
  @ApiOperation({ summary: 'Insights for a specific angle' })
  getByAngle(
    @Param('angleSlug') angleSlug: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getByAngle(angleSlug, limit ? Number(limit) : 10);
  }

  // ADMIN ONLY — accessible via admin observability synthesizeAngleInsights()
  @Post('synthesize/:angleSlug')
  @ApiOperation({ summary: '[ADMIN] Synthesize learned patterns + generate fresh ads for an angle (cached 24h)' })
  synthesize(@Param('angleSlug') angleSlug: string) {
    return this.patterns.synthesize(angleSlug);
  }

  // ADMIN ONLY — used for angle data cleanup / maintenance
  @Delete(':angleSlug')
  @ApiOperation({ summary: '[ADMIN] Delete all insights for an angle' })
  deleteByAngle(@Param('angleSlug') angleSlug: string) {
    return this.service.deleteByAngle(angleSlug);
  }
}
