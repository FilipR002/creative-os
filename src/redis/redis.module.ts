import { Global, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const url    = config.get<string>('REDIS_URL');
        const logger = new Logger('RedisModule');

        // Fix 3: Hard validation — UGC queue, MirofishService, and rate-limiting
        // all require Redis. Failing silently produces subtle data loss in production.
        if (!url || url.trim() === '') {
          throw new Error(
            '[Redis] CRITICAL: REDIS_URL env var is not set. ' +
            'Add REDIS_URL to Railway environment variables. ' +
            'The UGC queue, Mirofish cache, and several core features require Redis.',
          );
        }

        const client = new Redis(url!, {
          lazyConnect:          true,
          enableReadyCheck:     false,
          maxRetriesPerRequest: 1,
        });

        client.on('error', (err: Error) => {
          logger.error(`[Redis Error] ${err.message}`);
        });

        client.on('connect', () => {
          logger.log('[Redis] connected');
        });

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(): Promise<void> {
    const client = this.moduleRef.get<Redis>(REDIS_CLIENT);
    await client.quit().catch(() => undefined);
  }
}
