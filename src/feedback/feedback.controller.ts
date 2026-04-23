import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { SubmitFeedbackDto } from './feedback.dto';

@ApiTags('Feedback')
@Controller('api/feedback')
export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  @Post('real-metrics')
  @ApiOperation({
    summary: 'Submit real performance metrics for a creative',
    description:
      'Calculates prediction error, updates angle weights, updates format weights. ' +
      'This is the core feedback loop that makes scoring smarter over time.',
  })
  submitRealMetrics(@Body() dto: SubmitFeedbackDto) {
    return this.service.submitRealMetrics(dto);
  }

  @Get('weights')
  @ApiOperation({
    summary: 'Get current system weight snapshot — all angles + formats ranked by learned weight',
  })
  getWeights() {
    return this.service.getWeightsSnapshot();
  }

  @Get('calibration')
  @ApiOperation({
    summary: 'Get prediction calibration factors — how much the model over/under-predicts per angle + format',
    description:
      'calibration_factor > 1.05 = model underpredicts → scale UP. ' +
      'calibration_factor < 0.95 = model overpredicts → scale DOWN.',
  })
  getCalibration() {
    return this.service.getCalibration();
  }
}
