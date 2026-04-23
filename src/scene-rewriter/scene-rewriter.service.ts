// ─── 4.8 Scene Rewriting Engine — Service ────────────────────────────────────
// Thin wrapper around the pure engine. No Prisma, no external modules required.

import { Injectable } from '@nestjs/common';
import { rewriteScene } from './scene-rewriter.engine';
import { SceneRewriterInput, SceneRewriterOutput } from './scene-rewriter.types';

@Injectable()
export class SceneRewriterService {
  rewrite(input: SceneRewriterInput): SceneRewriterOutput {
    return rewriteScene(input);
  }
}
