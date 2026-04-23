// ─── 4.9 Auto Winner System — Service ────────────────────────────────────────
// Thin wrapper around the pure engine. No Prisma, no external modules required.

import { Injectable } from '@nestjs/common';
import { evaluateVariants } from './auto-winner.engine';
import { AutoWinnerInput, AutoWinnerOutput } from './auto-winner.types';

@Injectable()
export class AutoWinnerService {
  evaluate(input: AutoWinnerInput): AutoWinnerOutput {
    return evaluateVariants(input);
  }
}
