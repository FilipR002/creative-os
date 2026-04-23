// ─── Phase 4 Prisma-backed IMemoryStore ──────────────────────────────────────
// Scopes ALL reads and writes to clientId — never touches another client's data.
// Uses CreativeMemory as the backing table; key = angle slug, value = score row.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../../prisma/prisma.service';
import { ClientContext }      from '../context/client-context.interface';
import { IMemoryStore, MemoryFilter } from './memory-store.interface';

@Injectable()
export class PrismaMemoryStore implements IMemoryStore {
  private readonly logger = new Logger(PrismaMemoryStore.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(ctx: ClientContext, key: string): Promise<unknown> {
    try {
      return await this.prisma.creativeMemory.findFirst({
        where: { clientId: ctx.clientId, angle: key },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      this.logger.warn(`get(${ctx.clientId}, ${key}): ${(err as Error).message}`);
      return null;
    }
  }

  async set(ctx: ClientContext, key: string, value: unknown): Promise<void> {
    // Phase 5 memory writes go through GlobalMemoryService (Phase 4).
    // This store is read-optimised; writes are intentionally a no-op here
    // to prevent Phase 5 from bypassing the Phase 4 write pipeline.
    this.logger.warn(`set() called on PrismaMemoryStore — use GlobalMemoryService for writes (clientId=${ctx.clientId}, key=${key})`);
  }

  async query(ctx: ClientContext, filter: MemoryFilter): Promise<unknown[]> {
    try {
      return await this.prisma.creativeMemory.findMany({
        where: {
          clientId:  ctx.clientId,
          ...(filter.keyPrefix ? { angle: { startsWith: filter.keyPrefix } } : {}),
          ...(filter.after     ? { createdAt: { gte: filter.after } }         : {}),
        },
        orderBy: { createdAt: 'desc' },
        take:    filter.limit ?? 50,
      });
    } catch (err) {
      this.logger.warn(`query(${ctx.clientId}): ${(err as Error).message}`);
      return [];
    }
  }

  async delete(_ctx: ClientContext, _key: string): Promise<void> {
    // Deletions are not permitted through the platform layer — use admin tooling.
  }
}
