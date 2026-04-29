import { Controller, Get, Param, Post, Body, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BannerService } from './banner.service';
import { UserId } from '../common/decorators/user-id.decorator';
import type { CompositorInput } from '../compositor/types/compositor.types';

class BannerRerenderDto {
  copyOverrides?:      Partial<CompositorInput['copy']>;
  templateOverride?:   CompositorInput['templateId'];
  fontPairingOverride?: string;
}

@ApiTags('Banner')
@Controller('api/banner')
export class BannerController {
  constructor(private readonly service: BannerService) {}

  // NOTE: POST /api/banner/generate has been removed.
  // All generation must go through POST /api/product/decision (ExecutionGateway)
  // which enforces token checks, deductions, CreativePlan, and V2 routing.

  @Post(':id/images')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate images for each banner size in a creative' })
  generateImages(@Param('id') id: string, @UserId() userId: string) {
    return this.service.generateImages(id, userId);
  }

  /**
   * POST /api/banner/:id/banners/:index/rerender
   * Re-render one banner size with copy/template overrides — no AI call, instant.
   */
  @Post(':id/banners/:index/rerender')
  @HttpCode(200)
  @ApiOperation({ summary: 'Re-render a single banner with overrides' })
  rerenderBanner(
    @Param('id')    id:    string,
    @Param('index') index: string,
    @Body()         dto:   BannerRerenderDto,
    @UserId()       userId: string,
  ) {
    return this.service.rerenderBanner(
      id,
      parseInt(index, 10),
      userId,
      dto.copyOverrides      ?? {},
      dto.templateOverride,
      dto.fontPairingOverride,
    );
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
