import { Module }                from '@nestjs/common';
import { RealityController }    from './reality.controller';
import { RealityAggregatorService } from './reality.service';

@Module({
  controllers: [RealityController],
  providers:   [RealityAggregatorService],
  exports:     [RealityAggregatorService],
})
export class RealityModule {}
