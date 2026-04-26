import { Controller, Get, Param, Post, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CarouselService } from './carousel.service';
import { UserId } from '../common/decorators/user-id.decorator';

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

  @Get('campaign/:campaignId')
  @ApiOperation({ summary: 'Get all carousel creatives for a campaign' })
  findByCampaign(
    @Param('campaignId') campaignId: string,
    @UserId() userId: string,
  ) {
    return this.service.findByCampaign(campaignId, userId);
  }
}
