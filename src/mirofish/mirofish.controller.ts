// ─── MIROFISH Controller ──────────────────────────────────────────────────────
//
// Endpoints:
//   POST /api/mirofish/simulate              — run audience simulation
//   POST /api/mirofish/learning/feedback     — manually inject prediction feedback
//   POST /api/mirofish/learning/loop/:id     — run learning loop for a campaign
//   GET  /api/mirofish/learning/status       — system accuracy + exploration state
// ─────────────────────────────────────────────────────────────────────────────

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MirofishService }         from './mirofish.service';
import { MirofishLearningService } from './mirofish.learning.service';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class SimulateDto {
  creative_id?:  string;
  campaign_id?:  string;
  concept_id?:   string;
  angles!: { primary: string; secondary?: string };
  mode?:   'v1' | 'v2';
}

@ApiTags('MIROFISH')
@Controller('api/mirofish')
export class MirofishController {
  constructor(
    private readonly service:  MirofishService,
    private readonly learning: MirofishLearningService,
  ) {}

  // ── Simulation ────────────────────────────────────────────────────────────

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:     'Run MIROFISH audience simulation',
    description:
      'Probabilistic 200-persona simulation for an angle combination. ' +
      'Returns: overall_score, conversion_probability, attention, trust, virality, ' +
      'risk assessment, angle synergy, and learning loop signals. ' +
      'NEVER modifies scores or memory — predictive signal only.',
  })
  async simulate(@Body() dto: SimulateDto) {
    return this.service.simulate({
      creative_id:  dto.creative_id,
      campaign_id:  dto.campaign_id,
      concept_id:   dto.concept_id,
      angles:       dto.angles,
      mode:         dto.mode ?? 'v1',
    });
  }

  // ── Learning Loop ─────────────────────────────────────────────────────────

  @Post('learning/loop/:campaignId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:     'Run MIROFISH learning loop for a campaign',
    description:
      'Post-campaign calibration: collects prediction signals, computes per-angle ' +
      'accuracy, derives exploration adjustment, and returns a calibration report.',
  })
  async runLearningLoop(@Param('campaignId') campaignId: string) {
    return this.learning.runLearningLoop(campaignId);
  }

  @Get('learning/status')
  @ApiOperation({
    summary:     'MIROFISH system accuracy + exploration state',
    description:
      'Returns overall prediction accuracy, average absolute error, exploration ' +
      'adjustment signal, and top under/over-estimated angles.',
  })
  async getLearningStatus() {
    return this.learning.getSystemAccuracy();
  }
}
