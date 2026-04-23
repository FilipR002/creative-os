import { Global, Module }              from '@nestjs/common';
import { CLIENT_MEMORY_STORE }          from './client-memory-store.interface';
import { InMemoryClientMemoryStore }    from './in-memory-client-memory.store';

/**
 * Phase 5.1 — Multi-tenant memory isolation.
 *
 * @Global() so every feature module can inject CLIENT_MEMORY_STORE
 * without importing ClientMemoryModule explicitly.
 *
 * Swap implementation:
 *   { provide: CLIENT_MEMORY_STORE, useClass: RedisClientMemoryStore }
 */
@Global()
@Module({
  providers: [
    { provide: CLIENT_MEMORY_STORE, useClass: InMemoryClientMemoryStore },
  ],
  exports: [CLIENT_MEMORY_STORE],
})
export class ClientMemoryModule {}
