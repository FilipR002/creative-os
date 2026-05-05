import { Module }               from '@nestjs/common';
import { CompositorService }    from './compositor.service';
import { CompositorController } from './compositor.controller';
import { SatoriRendererService } from './satori/satori-renderer.service';

@Module({
  controllers: [CompositorController],
  providers:   [CompositorService, SatoriRendererService],
  exports:     [CompositorService],   // exported so carousel/banner can inject it in Phase 2
})
export class CompositorModule {}
