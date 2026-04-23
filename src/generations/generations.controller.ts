import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GenerationsService } from './generations.service';
import {
  CreateGenerationDto,
  CreateVersionDto,
  ImproveBlockDto,
  SendFeedbackDto,
  UpdateBlockDto,
} from './generations.dto';
import { UserId } from '../common/decorators/user-id.decorator';

@ApiTags('Generations')
@Controller('api/generations')
export class GenerationsController {
  constructor(private readonly service: GenerationsService) {}

  // ── POST /api/generations ─────────────────────────────────────────────────
  @Post()
  @ApiOperation({ summary: 'Generate a creative (hook + body + cta + variations) from a brief' })
  create(@Body() dto: CreateGenerationDto, @UserId() userId: string) {
    return this.service.create(dto, userId);
  }

  // ── GET /api/generations/by-campaign?campaignId= ─────────────────────────
  @Get('by-campaign')
  @ApiOperation({ summary: 'List all generations for a campaign (ordered newest first)' })
  findByCampaign(@Query('campaignId') campaignId: string, @UserId() userId: string) {
    return this.service.findByCampaign(campaignId, userId);
  }

  // ── GET /api/generations/:id ──────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get a generation by ID' })
  findOne(@Param('id') id: string, @UserId() userId: string) {
    return this.service.findOne(id, userId);
  }

  // ── GET /api/campaigns/:campaignId/generations ────────────────────────────
  // (bonus read route, mounted on campaigns namespace for convenience)

  // ── PATCH /api/generations/:id/block ─────────────────────────────────────
  @Patch(':id/block')
  @ApiOperation({ summary: 'Update a single block (hook | body | cta) — auto-snapshots version' })
  updateBlock(
    @Param('id') id: string,
    @Body() dto: UpdateBlockDto,
    @UserId() userId: string,
  ) {
    return this.service.updateBlock(id, dto, userId);
  }

  // ── POST /api/generations/:id/improve ────────────────────────────────────
  @Post(':id/improve')
  @ApiOperation({ summary: 'AI-improve a block with a natural language instruction' })
  improveBlock(
    @Param('id') id: string,
    @Body() dto: ImproveBlockDto,
    @UserId() userId: string,
  ) {
    return this.service.improveBlock(id, dto, userId);
  }

  // ── GET /api/generations/:id/versions ────────────────────────────────────
  @Get(':id/versions')
  @ApiOperation({ summary: 'List version history for a generation' })
  getVersions(@Param('id') id: string, @UserId() userId: string) {
    return this.service.getVersions(id, userId);
  }

  // ── POST /api/generations/:id/versions ───────────────────────────────────
  @Post(':id/versions')
  @ApiOperation({ summary: 'Create a manual version snapshot' })
  createVersion(
    @Param('id') id: string,
    @Body() dto: CreateVersionDto,
    @UserId() userId: string,
  ) {
    return this.service.createVersion(id, dto, userId);
  }

  // ── POST /api/versions/:versionId/restore ─────────────────────────────────
  // Nested under a dedicated versions prefix
}

@ApiTags('Versions')
@Controller('api/versions')
export class VersionsController {
  constructor(private readonly service: GenerationsService) {}

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a generation to a previous version snapshot' })
  restore(@Param('id') id: string, @UserId() userId: string) {
    return this.service.restoreVersion(id, userId);
  }
}

@ApiTags('Feedback')
@Controller('api/feedback')
export class FeedbackController {
  constructor(private readonly service: GenerationsService) {}

  @Post()
  @ApiOperation({ summary: 'Send a learning signal (edit | accept | reject | regenerate | copy)' })
  send(@Body() dto: SendFeedbackDto, @UserId() userId: string) {
    return this.service.sendFeedback(dto, userId);
  }
}
