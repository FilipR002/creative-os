// ─── 4.10 Global Creative Memory — Module ────────────────────────────────────
// Depends on PrismaModule for direct table access.
// Does NOT import MemoryModule — reads/writes Prisma tables directly to avoid
// circular dependency and redundant DB round-trips.

import { Module } from '@nestjs/common';
import { GlobalMemoryController } from './global-memory.controller';
import { GlobalMemoryService } from './global-memory.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [GlobalMemoryController],
  providers:   [GlobalMemoryService],
  exports:     [GlobalMemoryService],
})
export class GlobalMemoryModule {}
