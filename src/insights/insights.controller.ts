import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InsightsService } from './insights.service';

@ApiTags('Insights')
@Controller('api/insights')
export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  @Get(':creativeId')
  @ApiOperation({
    summary: 'Get WHY it wins explanation for a creative',
    description:
      'Returns cached insight if exists, generates on first request. ' +
      'Fully rule-based: uses scoring dimensions + angle/format learned stats. No LLM calls.',
  })
  getInsight(@Param('creativeId') creativeId: string) {
    return this.service.getInsight(creativeId);
  }

  @Post(':creativeId/regenerate')
  @ApiOperation({
    summary: 'Force-regenerate insight (useful after re-scoring)',
  })
  regenerate(@Param('creativeId') creativeId: string) {
    return this.service.generate(creativeId);
  }
}
