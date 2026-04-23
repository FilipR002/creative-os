import { Controller, Get, Post, Param, Query, Sse } from '@nestjs/common';
import { ApiOperation, ApiTags }                     from '@nestjs/swagger';
import { Observable, interval, from }                from 'rxjs';
import { switchMap, map }                            from 'rxjs/operators';
import { TrendPredictorService }                     from './trend-predictor.service';
import { TrendStage }                                from './types';

@ApiTags('Trend Prediction')
@Controller('api/trends')
export class TrendPredictionController {
  constructor(private readonly svc: TrendPredictorService) {}

  @Post('predict')
  @ApiOperation({ summary: 'Run prediction pass and return latest trends' })
  async predict() {
    const trends = await this.svc.runPrediction();
    return { trends, summary: this.svc.getSummary() };
  }

  @Get('predict')
  @ApiOperation({ summary: 'Get current predicted trends (no re-run)' })
  getTrends(@Query('stage') stage?: string) {
    return {
      trends:  this.svc.getTrends(stage as TrendStage | undefined),
      summary: this.svc.getSummary(),
    };
  }

  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream — emits trend updates every 30s' })
  stream(): Observable<any> {
    return interval(30_000).pipe(
      switchMap(() => from(this.svc.runPrediction())),
      map(trends => ({
        data: JSON.stringify({ trends, summary: this.svc.getSummary(), ts: new Date() }),
      })),
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Full trend history (all snapshots)' })
  getHistory() {
    return { history: this.svc.getAllHistory() };
  }

  @Get('history/:id')
  @ApiOperation({ summary: 'History for a specific trend' })
  getTrendHistory(@Param('id') id: string) {
    return { history: this.svc.getTrendHistory(id) };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Trend dashboard summary' })
  getSummary() {
    return this.svc.getSummary();
  }
}
