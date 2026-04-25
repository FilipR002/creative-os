/**
 * creative-os.controller.ts
 *
 * Exposes POST /api/creative-os/generate
 *
 * Authentication is handled globally by UserGuard.
 * The @UserId() decorator extracts the user id from req.context.
 */

import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreativeOSService, CreativeOSGenerateDto } from './creative-os.service';
import { UserId } from '../common/decorators/user-id.decorator';

@ApiTags('Creative OS')
@Controller('api/creative-os')
export class CreativeOSController {
  constructor(private readonly service: CreativeOSService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generate a creative ad (video / carousel / banner) from a campaign + concept via Sonnet blueprint',
  })
  generate(
    @Body() dto:      CreativeOSGenerateDto,
    @UserId() userId: string,
  ) {
    return this.service.generate(dto, userId);
  }
}
