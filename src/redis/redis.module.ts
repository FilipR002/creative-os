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

        // Warn on missing REDIS_URL — server boots without it so core features
        // (billing, creative generation, auth) remain available. Queue-dependent
        // features (UGC rendering, Mirofish cache) will be disabled.
        // Add REDIS_URL to Railway env vars (Railway Redis add-on or Upstash).
        if (!url || url.trim() === '') {
          logger.warn(
            '[Redis] REDIS_URL not set — UGC queue and cache features disabled. ' +
            'Add a Redis database in Railway dashboard to enable them.',
          );
        }

        const client = new Redis(url ?? 'redis://localhost:6379', {
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
