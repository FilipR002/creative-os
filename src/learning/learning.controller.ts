import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LearningService } from './learning.service';

@ApiTags('Learning')
@Controller('api/angles/learning')
export class LearningController {
  constructor(private readonly service: LearningService) {}

  /**
   * Full system status:
   *   - ranked angles by effective multiplier (uncertainty-corrected + decay-adjusted)
   *   - exploration signal (dominance / stagnation / repetition / overfitting)
   *   - learning health (healthy / stagnating / volatile)
   *   - dominant angle, baseline count
   *   - per-angle: weight, smoothedScore, uncertaintyScore, decayFactor, effectiveMultiplier
   */
  @Get('status')
  @ApiOperation({
    summary: 'Stable learning system status',
    description:
      'Full diagnostic: angle rankings with effective multipliers, uncertainty scores, ' +
      'decay factors, exploration signals, and learning health.',
  })
  getStatus() {
    return this.service.getSystemStatus();
  }

  /**
   * Manually trigger a learning cycle for a campaign.
   * Returns the full 10-step update report:
   *   - per-angle: normalizedScore, delta, weightBefore/After, learningRate,
   *     uncertainty, decay, hysteresisLock, impact
   *   - exploration signal + system stats
   */
  @Post('cycle/:campaignId')
  @ApiOperation({
    summary: 'Run stable learning cycle for a campaign',
    description:
      'Executes the full 10-step loop: normalize → smooth → stability-controlled update → ' +
      'uncertainty → decay → anti-overfitting → exploration signal.',
  })
  runCycle(@Param('campaignId') campaignId: string) {
    return this.service.runCycle(campaignId);
  }
}
