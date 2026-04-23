import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import { EvaluateDto } from './scoring.dto';

@ApiTags('Scoring')
@Controller('api/scoring')
export class ScoringController {
  constructor(private readonly service: ScoringService) {}

  @Post('evaluate')
  @ApiOperation({
    summary: 'Score and rank a set of creatives — picks the winner',
    description: 'Pass creative IDs from the same campaign. Returns ranked scores + winner flag.',
  })
  evaluate(@Body() dto: EvaluateDto) {
    return this.service.evaluate(dto.creativeIds);
  }

  @Get('campaign/:campaignId')
  @ApiOperation({ summary: 'Get all scores for a campaign (ranked highest first)' })
  getByCampaign(@Param('campaignId') campaignId: string) {
    return this.service.getScoresByCampaign(campaignId);
  }

  @Get(':creativeId')
  @ApiOperation({ summary: 'Get score breakdown for a single creative' })
  getOne(@Param('creativeId') creativeId: string) {
    return this.service.getScore(creativeId);
  }
}
