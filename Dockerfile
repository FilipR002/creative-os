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
# prisma.config.ts is required by Prisma 7.x CLI at BOTH build time (generate)
# and runtime (migrate deploy). Without it Prisma has no datasource URL and
# silently skips migrations, leaving new columns missing and the app crashing.
COPY prisma.config.ts ./
COPY prisma           ./prisma/
COPY src              ./src/

# ── 3. Generate Prisma client ─────────────────────────────────────────────────
# Dummy URL — generate only reads schema + config, never opens a connection.
# Real DATABASE_URL is injected by Railway at runtime.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate

# ── 4. Compile TypeScript → dist/ at BUILD TIME ───────────────────────────────
RUN npm run build

# ── 5. Prune devDependencies from the final image ────────────────────────────
# Removes ts-node, typescript, tsconfig-paths (~120 MB).
# Prisma CLI bundles its own TypeScript runner for prisma.config.ts — no ts-node needed.
RUN npm prune --omit=dev

# ── 6. Start ──────────────────────────────────────────────────────────────────
# prisma migrate deploy applies pending SQL migration files in order.
# Safer than db push: uses our version-controlled migrations, no data-loss risk.
# If migrations fail the container exits and Railway retries — correct behaviour.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
