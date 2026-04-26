import { Module }              from '@nestjs/common';
import { CreativesController } from './creatives.controller';

@Module({
  controllers: [CreativesController],
})
export class CreativesModule {}
