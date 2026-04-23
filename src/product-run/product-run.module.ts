import { Module }           from '@nestjs/common';
import { ProductRunController } from './product-run.controller';
import { ProductRunService }    from './product-run.service';
import { CampaignModule }       from '../campaign/campaign.module';
import { ConceptModule }        from '../concept/concept.module';
import { AngleModule }          from '../angle/angle.module';
import { VideoModule }          from '../video/video.module';
import { CarouselModule }       from '../carousel/carousel.module';
import { BannerModule }         from '../banner/banner.module';
import { ScoringModule }        from '../scoring/scoring.module';
import { MemoryModule }         from '../memory/memory.module';
import { LearningModule }       from '../learning/learning.module';
import { EvolutionModule }      from '../evolution/evolution.module';
import { UsersModule }          from '../users/users.module';

@Module({
  imports: [
    CampaignModule,
    ConceptModule,
    AngleModule,
    VideoModule,
    CarouselModule,
    BannerModule,
    ScoringModule,
    MemoryModule,
    LearningModule,
    EvolutionModule,
    UsersModule,
  ],
  controllers: [ProductRunController],
  providers:   [ProductRunService],
})
export class ProductRunModule {}
