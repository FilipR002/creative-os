/**
 * creative-director.controller.ts
 *
 * Exposes POST /api/creative-director/generate
 *
 * Authentication is handled globally by UserGuard.
 * The @UserId() decorator extracts userId from req.context.
 */

import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CreativeDirectorService,
  CreativeDirectorGenerateDto,
} from './creative-director.service';
import { UserId } from '../common/decorators/user-id.decorator';

@ApiTags('Creative Director')
@Controller('api/creative-director')
export class CreativeDirectorController {
  constructor(private readonly service: CreativeDirectorService) {}

  @Post('generate')
  @ApiOperation({
    summary:
      'Generate a full multi-format creative plan (video scenes + carousel slides + banner spec) ' +
      'via the Creative Director Brain. Returns core_story + all three format executions in one call.',
  })
  generate(
    @Body() dto:      CreativeDirectorGenerateDto,
    @UserId() userId: string,
  ) {
    return this.service.generate(dto, userId);
  }
}
