import { Module }                  from '@nestjs/common';
import { ConfigModule }            from '@nestjs/config';
import { AngleInsightsController } from './angle-insights.controller';
import { AngleInsightsService }    from './angle-insights.service';
import { InsightPatternService }   from './insight-pattern.service';

@Module({
  imports:     [ConfigModule],
  controllers: [AngleInsightsController],
  providers:   [AngleInsightsService, InsightPatternService],
  exports:     [AngleInsightsService, InsightPatternService],
})
export class AngleInsightsModule {}
