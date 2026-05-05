FROM node:20-alpine

WORKDIR /app

# ── 0. System deps for Puppeteer headless Chrome ─────────────────────────────
# Alpine uses musl libc; Puppeteer's bundled Chrome is glibc-only and hangs on
# startup. Install Alpine's native Chromium instead and point Puppeteer at it.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

# Tell Puppeteer: skip downloading the bundled Chrome and use the system one
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# ── 1. Install ALL deps (devDeps needed for tsc at build time) ────────────────
COPY package*.json ./
RUN npm ci

# ── 2. Copy source ────────────────────────────────────────────────────────────
COPY tsconfig.json    ./
# prisma.config.ts defines the datasource URL for Prisma 7.x.
# Without it the CLI has no DB URL and all prisma commands silently no-op.
COPY prisma.config.ts ./
COPY prisma           ./prisma/
COPY src              ./src/

# ── 3. Generate Prisma client ─────────────────────────────────────────────────
# Dummy URL — generate only reads schema + config, never opens a connection.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate

# ── 4. Compile TypeScript → dist/ at BUILD TIME ───────────────────────────────
RUN npm run build

# ── 5. Prune devDependencies from the final image ────────────────────────────
# Prisma CLI bundles its own TypeScript runner — ts-node not needed at runtime.
RUN npm prune --omit=dev

# ── 6. Start ──────────────────────────────────────────────────────────────────
# Use db push (not migrate deploy) because the DB was originally bootstrapped
# with db push and has no _prisma_migrations history. migrate deploy would try
# to replay all migrations from init, hit existing tables, and crash.
# db push introspects the live schema and applies only the diff — safe here.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main.js"]
