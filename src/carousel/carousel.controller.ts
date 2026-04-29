import { Controller, Get, Param, Post, Body, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CarouselService } from './carousel.service';
import { UserId } from '../common/decorators/user-id.decorator';
import type { CompositorInput } from '../compositor/types/compositor.types';

class SlideRerenderDto {
  copyOverrides?:      Partial<CompositorInput['copy']>;
  templateOverride?:   CompositorInput['templateId'];
  fontPairingOverride?: string;
}

@ApiTags('Carousel')
@Controller('api/carousel')
export class CarouselController {
  constructor(private readonly service: CarouselService) {}

  // NOTE: POST /api/carousel/generate has been removed.
  // All generation must go through POST /api/product/decision (ExecutionGateway)
  // which enforces token checks, deductions, CreativePlan, and V2 routing.

  /**
   * POST /api/carousel/:creativeId/images
   * Claude writes a visual prompt per slide → Imagen 4 renders each one.
   * Returns base64 images for all slides.
   */
  @Post(':creativeId/images')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate images for every slide using Imagen 4' })
  generateImages(
    @Param('creativeId') creativeId: string,
    @UserId() userId: string,
  ) {
    return this.service.generateImages(creativeId, userId);
  }

  /**
   * POST /api/carousel/:creativeId/slides/:index/rerender
   * Re-render one slide with copy/template overrides — no AI call, instant.
   */
  @Post(':creativeId/slides/:index/rerender')
  @HttpCode(200)
  @ApiOperation({ summary: 'Re-render a single carousel slide with overrides' })
  rerenderSlide(
    @Param('creativeId') creativeId: string,
    @Param('index')      index:      string,
    @Body()              dto:        SlideRerenderDto,
    @UserId()            userId:     string,
  ) {
    return this.service.rerenderSlide(
      creativeId,
      parseInt(index, 10),
      userId,
      dto.copyOverrides      ?? {},
      dto.templateOverride,
      dto.fontPairingOverride,
    );
  }

  @Get('campaign/:campaignId')
  @ApiOperation({ summary: 'Get all carousel creatives for a campaign' })
  findByCampaign(
    @Param('campaignId') campaignId: string,
    @UserId() userId: string,
  ) {
    return this.service.findByCampaign(campaignId, userId);
  }
}
