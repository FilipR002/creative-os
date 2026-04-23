import { Body, Controller, Get, Param, Post, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BannerService } from './banner.service';
import { GenerateBannerDto } from './banner.dto';
import { UserId } from '../common/decorators/user-id.decorator';

@ApiTags('Banner')
@Controller('api/banner')
export class BannerController {
  constructor(private readonly service: BannerService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate banner ad copy for multiple sizes' })
  generate(@Body() dto: GenerateBannerDto, @UserId() userId: string) {
    return this.service.generate(dto, userId);
  }

  @Post(':id/images')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate images for each banner size in a creative' })
  generateImages(@Param('id') id: string, @UserId() userId: string) {
    return this.service.generateImages(id, userId);
  }

  @Get('campaign/:campaignId')
  @ApiOperation({ summary: 'Get all banner creatives for a campaign' })
  findByCampaign(
    @Param('campaignId') campaignId: string,
    @UserId() userId: string,
  ) {
    return this.service.findByCampaign(campaignId, userId);
  }
}
