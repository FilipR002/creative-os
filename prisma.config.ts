import { defineConfig } from 'prisma/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrate: {
    // Raw URL for the migration engine (prisma migrate deploy)
    databaseUrl: process.env.DATABASE_URL as string,
  },
  client: {
    // Adapter for PrismaClient query engine
    async adapter(env) {
      const pool = new Pool({ connectionString: env.DATABASE_URL });
      return new PrismaPg(pool);
    },
  },
});
