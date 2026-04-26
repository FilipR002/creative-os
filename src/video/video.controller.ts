import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VideoService } from './video.service';
import { HookBoosterService } from './hook-booster.service';
import { UserId } from '../common/decorators/user-id.decorator';
import { IsString } from 'class-validator';

class BoostHookDto {
  @IsString()
  creativeId: string;
}

@ApiTags('Video')
@Controller('api/video')
export class VideoController {
  constructor(
    private readonly service:      VideoService,
    private readonly hookBooster:  HookBoosterService,
  ) {}

  // NOTE: POST /api/video/generate has been removed.
  // All generation must go through POST /api/product/decision (ExecutionGateway)
  // which enforces token checks, deductions, CreativePlan, and V2 routing.

  @Post('boost-hook')
  @ApiOperation({ summary: 'Manually run Hook Booster on an existing video creative' })
  boostHook(@Body() dto: BoostHookDto) {
    return this.hookBooster.boostCreative(dto.creativeId);
  }

  @Get('campaign/:campaignId')
  @ApiOperation({ summary: 'Get all video creatives for a campaign' })
  findByCampaign(
    @Param('campaignId') campaignId: string,
    @UserId() userId: string,
  ) {
    return this.service.findByCampaign(campaignId, userId);
  }

  @Post(':id/images')
  @ApiOperation({ summary: 'Generate images for each scene using visual_prompt' })
  generateImages(
    @Param('id') id: string,
    @UserId() userId: string,
  ) {
    return this.service.generateImages(id, userId);
  }
}
