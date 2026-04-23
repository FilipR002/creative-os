// ─── 4.6 Hook Booster v1 — Module ────────────────────────────────────────────
// Fully standalone — no Prisma, no FatigueModule, no ExplorationModule required.

import { Module } from '@nestjs/common';
import { HookBoosterController } from './hook-booster.controller';
import { HookBoosterService } from './hook-booster.service';

@Module({
  controllers: [HookBoosterController],
  providers:   [HookBoosterService],
  exports:     [HookBoosterService],
})
export class HookBoosterModule {}
