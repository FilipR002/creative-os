import { Module }              from '@nestjs/common';
import { PrismaModule }        from '../prisma/prisma.module';
import { CreativeDNAModule }   from '../creative-dna/creative-dna.module';
import { UserStyleService }    from './user-style.service';
import { UserStyleController } from './user-style.controller';
import { StyleTranslatorService } from './style-translator.service';

@Module({
  imports:     [PrismaModule, CreativeDNAModule],
  providers:   [UserStyleService, StyleTranslatorService],
  controllers: [UserStyleController],
  exports:     [UserStyleService, StyleTranslatorService],
})
export class UserStyleModule {}
