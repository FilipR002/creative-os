// ─── 4.9 Auto Winner System — Module ─────────────────────────────────────────
// Standalone — no Prisma. Imports scoring.utils directly (pure functions).

import { Module } from '@nestjs/common';
import { AutoWinnerController } from './auto-winner.controller';
import { AutoWinnerService } from './auto-winner.service';

@Module({
  controllers: [AutoWinnerController],
  providers:   [AutoWinnerService],
  exports:     [AutoWinnerService],
})
export class AutoWinnerModule {}
