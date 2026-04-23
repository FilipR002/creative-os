import { Module }                        from '@nestjs/common';
import { CausalAttributionController }   from './causal-attribution.controller';
import { CausalAttributionService }      from './causal-attribution.service';

@Module({
  controllers: [CausalAttributionController],
  providers:   [CausalAttributionService],
  exports:     [CausalAttributionService],
})
export class CausalAttributionModule {}
