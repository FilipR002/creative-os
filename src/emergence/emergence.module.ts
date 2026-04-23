import { Module }               from '@nestjs/common';
import { EmergenceController }  from './emergence.controller';
import { EmergenceService }     from './emergence.service';

@Module({
  controllers: [EmergenceController],
  providers:   [EmergenceService],
  exports:     [EmergenceService],
})
export class EmergenceModule {}
