import { Module, forwardRef } from '@nestjs/common';
import { ConceptController } from './concept.controller';
import { ConceptService } from './concept.service';
import { CampaignModule } from '../campaign/campaign.module';

@Module({
  imports:     [forwardRef(() => CampaignModule)],
  controllers: [ConceptController],
  providers:   [ConceptService],
  exports:     [ConceptService],
})
export class ConceptModule {}
