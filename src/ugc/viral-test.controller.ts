/**
 * viral-test.controller.ts
 *
 * UGC Viral Testing HTTP API — Phase 1.1
 *
 * Routes:
 *   POST /api/ugc/viral-test/launch       — start multi-persona A/B/C test
 *   GET  /api/ugc/viral-test/:testId      — get test status + winner (when ready)
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { ViralTestService }  from './viral-test.service';
import { UserId }            from '../common/decorators/user-id.decorator';
import type {
  LaunchViralTestDto,
  LaunchViralTestResponse,
  ViralTestStatusResponse,
} from './types/viral-test.types';

@ApiTags('UGC Viral Testing')
@Controller('api/ugc/viral-test')
export class ViralTestController {

  constructor(private readonly viralTest: ViralTestService) {}

  // ─── Launch ───────────────────────────────────────────────────────────────

  @Post('launch')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:     'Launch UGC multi-persona viral A/B/C test',
    description: [
      'Runs the full pipeline:',
      'Persona Split → Hook A/B/C Generation → Expanded Variant Matrix',
      '→ Parallel Queue → Kling Render → Scoring → Auto Winner',
    ].join(' '),
  })
  @ApiResponse({ status: 202, description: 'Test launched — all variants queued' })
  async launch(
    @Body()   dto:    LaunchViralTestDto,
    @UserId() userId: string,
  ): Promise<LaunchViralTestResponse> {
    return this.viralTest.launch(dto, userId);
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  @Get(':testId')
  @ApiOperation({
    summary:     'Get viral test status',
    description: 'Returns all job states and winner selection when all variants are rendered.',
  })
  @ApiQuery({ name: 'clientId', required: false, type: String })
  @ApiQuery({ name: 'industry', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Test status returned' })
  @ApiResponse({ status: 404, description: 'Test not found' })
  async getStatus(
    @Param('testId')     testId:   string,
    @UserId()            userId:   string,
    @Query('clientId')   clientId: string = 'default',
    @Query('industry')   industry: string = 'general',
  ): Promise<ViralTestStatusResponse> {
    return this.viralTest.getTestStatus(testId, userId, clientId, industry);
  }
}
