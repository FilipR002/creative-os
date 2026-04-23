import { defineConfig } from 'prisma/config';

// DATABASE_URL is read via env("DATABASE_URL") in schema.prisma.
// Railway injects it at runtime — no dotenv needed in production.
export default defineConfig({
  schema: 'prisma/schema.prisma',
});
