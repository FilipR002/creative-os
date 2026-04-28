import { Module }              from '@nestjs/common';
import { ConfigModule }        from '@nestjs/config';
import { ResourcesController } from './resources.controller';
import { ResourcesService }    from './resources.service';

@Module({
  imports:     [ConfigModule],
  controllers: [ResourcesController],
  providers:   [ResourcesService],
  exports:     [ResourcesService],   // consumed by ProductRunModule
})
export class ResourcesModule {}
