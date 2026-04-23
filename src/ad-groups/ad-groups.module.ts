import { Module } from '@nestjs/common';
import { AdGroupsController } from './ad-groups.controller';
import { AdGroupsService }    from './ad-groups.service';
import { PrismaModule }       from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [AdGroupsController],
  providers:   [AdGroupsService],
  exports:     [AdGroupsService],
})
export class AdGroupsModule {}
