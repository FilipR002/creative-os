import { Module }                          from '@nestjs/common';
import { TrendPredictionController }       from './trend-prediction.controller';
import { TrendPredictorService }           from './trend-predictor.service';
import { VelocityService }                 from './velocity.service';
import { CompetitorIntelligenceModule }    from '../competitor-intelligence/competitor-intelligence.module';

@Module({
  imports:     [CompetitorIntelligenceModule],
  controllers: [TrendPredictionController],
  providers:   [TrendPredictorService, VelocityService],
  exports:     [TrendPredictorService],
})
export class TrendPredictionModule {}
