import { Global, Module }             from '@nestjs/common';
import { ObservabilityService }        from './observability.service';
import { ReplayService }               from './replay.service';
import { ObservabilityController }     from './observability.controller';

@Global()
@Module({
  controllers: [ObservabilityController],
  providers:   [ObservabilityService, ReplayService],
  exports:     [ObservabilityService, ReplayService],
})
export class ObservabilityModule {}
