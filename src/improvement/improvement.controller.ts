import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ImprovementService } from './improvement.service';
import { CampaignService } from '../campaign/campaign.service';
import { UserId } from '../common/decorators/user-id.decorator';

@Controller('api/improvement')
export class ImprovementController {
  constructor(
    private readonly service:   ImprovementService,
    private readonly campaigns: CampaignService,
  ) {}

  // POST /api/improvement/run
  @Post('run')
  async run(
    @Body() dto: { campaignId: string },
    @UserId() userId: string,
  ) {
    await this.campaigns.assertOwnership(dto.campaignId, userId);
    return this.service.runForCampaign(dto.campaignId);
  }

  // GET /api/improvement/campaign/:campaignId
  @Get('campaign/:campaignId')
  async getCampaignImprovements(
    @Param('campaignId') campaignId: string,
    @UserId() userId: string,
  ) {
    await this.campaigns.assertOwnership(campaignId, userId);
    return this.service.getCampaignImprovements(campaignId);
  }

  // GET /api/improvement/:creativeId
  @Get(':creativeId')
  getImprovement(@Param('creativeId') creativeId: string) {
    return this.service.getImprovement(creativeId);
  }
}
