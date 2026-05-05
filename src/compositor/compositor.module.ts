import { Module }               from '@nestjs/common';
import { CompositorService }    from './compositor.service';
import { CompositorController } from './compositor.controller';
import { SatoriRendererService } from './satori/satori-renderer.service';
import { VisualCriticService }   from './critic/visual-critic.service';

@Module({
  controllers: [CompositorController],
  providers:   [CompositorService, SatoriRendererService, VisualCriticService],
  exports:     [CompositorService],   // exported so carousel/banner can inject it in Phase 2
})
export class CompositorModule {}
