import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VideoService } from './video.service';
import { HookBoosterService } from './hook-booster.service';
import { GenerateVideoDto } from './video.dto';
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

  @Post('generate')
  @ApiOperation({ summary: 'Generate a video ad script (scene-by-scene) with auto hook boost' })
  generate(@Body() dto: GenerateVideoDto, @UserId() userId: string) {
    return this.service.generate(dto, userId);
  }

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
