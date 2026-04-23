import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags }  from '@nestjs/swagger';
import { UserInsightService }     from './user-insight.service';

@ApiTags('insights')
@Controller('api/insights')
export class UserInsightController {
  constructor(private readonly service: UserInsightService) {}

  @Get(':campaignId')
  @ApiOperation({ summary: 'Human-readable performance insight for a campaign' })
  get(@Param('campaignId') campaignId: string) {
    return this.service.generateUserInsight(campaignId);
  }
}
