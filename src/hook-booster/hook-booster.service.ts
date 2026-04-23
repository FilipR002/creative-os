// ─── 4.6 Hook Booster v1 / 4.7 Hook Booster v2 — Service ────────────────────
// Thin wrappers around the pure engines. No Prisma, no external modules.

import { Injectable } from '@nestjs/common';
import { generateHooks } from './hook-booster.engine';
import { generateV2Hooks } from './hook-booster-v2.engine';
import {
  HookBoosterInput,
  HookBoosterOutput,
  HookV2Input,
  HookV2Output,
} from './hook-booster.types';

@Injectable()
export class HookBoosterService {
  generate(input: HookBoosterInput): HookBoosterOutput {
    return generateHooks(input);
  }

  boost(input: HookV2Input): HookV2Output {
    return generateV2Hooks(input);
  }
}
