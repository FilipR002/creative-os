// ─── 4.8 Scene Rewriting Engine — Module ─────────────────────────────────────
// Fully standalone — no Prisma, no FatigueModule, no ExplorationModule required.

import { Module } from '@nestjs/common';
import { SceneRewriterController } from './scene-rewriter.controller';
import { SceneRewriterService } from './scene-rewriter.service';

@Module({
  controllers: [SceneRewriterController],
  providers:   [SceneRewriterService],
  exports:     [SceneRewriterService],
})
export class SceneRewriterModule {}
