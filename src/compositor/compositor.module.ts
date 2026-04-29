import { Module }               from '@nestjs/common';
import { CompositorService }    from './compositor.service';
import { CompositorController } from './compositor.controller';

@Module({
  controllers: [CompositorController],
  providers:   [CompositorService],
  exports:     [CompositorService],   // exported so carousel/banner can inject it in Phase 2
})
export class CompositorModule {}
