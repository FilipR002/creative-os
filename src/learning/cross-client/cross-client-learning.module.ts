import { Global, Module }               from '@nestjs/common';
import { CrossClientLearningService }   from './cross-client-learning.service';

export const CROSS_CLIENT_LEARNING = 'CROSS_CLIENT_LEARNING';

/**
 * Phase 5.2 — @Global() so any feature module can inject
 * CrossClientLearningService without importing this module.
 */
@Global()
@Module({
  providers: [CrossClientLearningService],
  exports:   [CrossClientLearningService],
})
export class CrossClientLearningModule {}
