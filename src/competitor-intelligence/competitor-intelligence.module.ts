import { Module }                              from '@nestjs/common';
import { CompetitorIntelligenceController }    from './competitor-intelligence.controller';
import { CompetitorIntelligenceService }       from './competitor-intelligence.service';
import { ScraperService }                      from './scraper.service';
import { NormalizerService }                   from './normalizer.service';
import { ScoringService }                      from './scoring.service';
import { ClusteringService }                   from './clustering.service';
import { InsightService }                      from './insight.service';
import { MonitoringService }                   from './monitoring.service';
import { CiAutonomyService }                   from './ci-autonomy.service';

@Module({
  controllers: [CompetitorIntelligenceController],
  providers: [
    CompetitorIntelligenceService,
    ScraperService,
    NormalizerService,
    ScoringService,
    ClusteringService,
    InsightService,
    MonitoringService,
    CiAutonomyService,
  ],
  exports: [CompetitorIntelligenceService],
})
export class CompetitorIntelligenceModule {}
