FROM node:20-alpine

WORKDIR /app

# ── 1. Install ALL deps (devDeps needed for tsc at build time) ────────────────
COPY package*.json ./
RUN npm ci

# ── 2. Copy source ────────────────────────────────────────────────────────────
COPY tsconfig.json ./
COPY prisma       ./prisma/
COPY src          ./src/

# ── 3. Generate Prisma client ─────────────────────────────────────────────────
# Dummy URL — generate only reads schema.prisma, never opens a connection.
# Real DATABASE_URL is injected by Railway at runtime.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate

# ── 4. Compile TypeScript → dist/ at BUILD TIME ───────────────────────────────
# This is the key change: tsc runs once here instead of ts-node compiling
# everything in-memory on every startup, which was exhausting the 1 GB heap.
RUN npm run build

# ── 5. Prune devDependencies from the final image ────────────────────────────
# Removes ts-node, typescript, tsconfig-paths (~120 MB) — not needed at runtime.
RUN npm prune --omit=dev

# ── 6. Start ──────────────────────────────────────────────────────────────────
# Run pending migrations, then start the pre-compiled app with plain node.
# No in-memory TypeScript compilation — cold start is now ~2s instead of ~30s.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/src/main.js"]
