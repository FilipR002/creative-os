// ─── Phase 7 — Product Module ─────────────────────────────────────────────────

import { Module }             from '@nestjs/common';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { GlobalMemoryModule } from '../global-memory/global-memory.module';

// Observability (internal)
import { ProductController }  from './product.controller';

// User product layer (Phase 7)
import { UserProductController }      from './user/user-product.controller';
import { ProjectStoreService }        from './user/project-store.service';
import { ProductOrchestratorService } from './user/product-orchestrator.service';

@Module({
  imports:     [OrchestratorModule, GlobalMemoryModule],
  controllers: [ProductController, UserProductController],
  providers:   [ProjectStoreService, ProductOrchestratorService],
})
export class ProductModule {}
