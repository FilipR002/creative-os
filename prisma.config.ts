import { defineConfig } from 'prisma/config';

// DATABASE_URL is injected by Railway at runtime.
// During Docker build, a dummy URL is passed via Dockerfile for prisma generate.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});
