import { Module, forwardRef } from '@nestjs/common';

import { CreativeDirectorController } from './creative-director.controller';
import { CreativeDirectorService }    from './creative-director.service';

import { CampaignModule } from '../campaign/campaign.module';
import { ConceptModule }  from '../concept/concept.module';

@Module({
  imports: [
    forwardRef(() => CampaignModule),
    forwardRef(() => ConceptModule),
  ],
  controllers: [CreativeDirectorController],
  providers:   [CreativeDirectorService],
  exports:     [CreativeDirectorService],
})
export class CreativeDirectorModule {}
