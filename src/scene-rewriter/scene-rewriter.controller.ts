// ─── 4.8 Scene Rewriting Engine — Controller ─────────────────────────────────

import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { SceneRewriterService } from './scene-rewriter.service';
import { RewriteSceneDto } from './scene-rewriter.dto';
import { SceneRewriterOutput } from './scene-rewriter.types';

@Controller('api/scene-rewriter')
export class SceneRewriterController {
  constructor(private readonly sceneRewriter: SceneRewriterService) {}

  /**
   * POST /api/scene-rewriter/rewrite
   * Accepts a single creative segment + performance signals.
   * Returns 3 micro-rewrite variants (CLARITY / EMOTIONAL / PERFORMANCE),
   * best_rewrite_index, and reasoning. Preserves angle and campaign goal.
   */
  @Post('rewrite')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  rewrite(@Body() dto: RewriteSceneDto): SceneRewriterOutput {
    return this.sceneRewriter.rewrite(dto);
  }

  /** GET /api/scene-rewriter/status — liveness check */
  @Get('status')
  status(): { ok: boolean; engine: string } {
    return { ok: true, engine: 'scene-rewriter-v1' };
  }
}
