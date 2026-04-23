import { Module }              from '@nestjs/common';
import { CreativeDNAController } from './creative-dna.controller';
import { CreativeDNAService }    from './creative-dna.service';

@Module({
  controllers: [CreativeDNAController],
  providers:   [CreativeDNAService],
  exports:     [CreativeDNAService],
})
export class CreativeDNAModule {}
