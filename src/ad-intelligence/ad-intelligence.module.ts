import { Module }                          from '@nestjs/common';
import { AdIntelligenceController }        from './ad-intelligence.controller';
import { AdIntelligenceService }           from './ad-intelligence.service';
import { PlatformNormalizerService }       from './platform-normalizer.service';
import { CrossPlatformMatcherService }     from './cross-platform-matcher.service';
import { CompetitorIntelligenceModule }    from '../competitor-intelligence/competitor-intelligence.module';
import { TrendPredictionModule }           from '../trend-prediction/trend-prediction.module';

@Module({
  imports:     [CompetitorIntelligenceModule, TrendPredictionModule],
  controllers: [AdIntelligenceController],
  providers:   [AdIntelligenceService, PlatformNormalizerService, CrossPlatformMatcherService],
  exports:     [AdIntelligenceService],
})
export class AdIntelligenceModule {}
