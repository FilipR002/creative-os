import { Module }              from '@nestjs/common';
import { PrismaModule }        from '../prisma/prisma.module';
import { CreativeDNAController } from './creative-dna.controller';
import { CreativeDNAService }    from './creative-dna.service';

@Module({
  imports:     [PrismaModule],
  controllers: [CreativeDNAController],
  providers:   [CreativeDNAService],
  exports:     [CreativeDNAService],
})
export class CreativeDNAModule {}
