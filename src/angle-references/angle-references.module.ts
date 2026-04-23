import { Module }                       from '@nestjs/common';
import { AngleReferencesController }    from './angle-references.controller';
import { AngleReferencesService }       from './angle-references.service';

@Module({
  controllers: [AngleReferencesController],
  providers:   [AngleReferencesService],
  exports:     [AngleReferencesService],
})
export class AngleReferencesModule {}
