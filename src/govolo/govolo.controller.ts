/**
 * govolo.controller.ts
 *
 * Exposes POST /api/govolo/generate
 *
 * Authentication is handled globally by UserGuard.
 * The @UserId() decorator extracts the user id from req.context.
 */

import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { GovoloService, GovoloGenerateDto } from './govolo.service';
import { UserId } from '../common/decorators/user-id.decorator';

@ApiTags('Govolo')
@Controller('api/govolo')
export class GovoloController {
  constructor(private readonly service: GovoloService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generate a creative ad (video / carousel / banner) from a campaign + concept via Sonnet blueprint',
  })
  generate(
    @Body() dto:      GovoloGenerateDto,
    @UserId() userId: string,
  ) {
    return this.service.generate(dto, userId);
  }
}
