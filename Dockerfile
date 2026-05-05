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
COPY tsconfig.json ./
COPY prisma       ./prisma/
COPY src          ./src/

# ── 3. Generate Prisma client ─────────────────────────────────────────────────
# Dummy URL — generate only reads schema.prisma, never opens a connection.
# Real DATABASE_URL is injected by Railway at runtime.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate

# ── 4. Compile TypeScript → dist/ at BUILD TIME ───────────────────────────────
RUN npm run build

# ── 5. Prune devDependencies from the final image ────────────────────────────
RUN npm prune --omit=dev

# ── 6. Start ──────────────────────────────────────────────────────────────────
# Run migrations (with 30s timeout so a hung DB never blocks app start),
# then start the pre-compiled app with plain node.
CMD ["sh", "-c", "timeout 30 npx prisma db push --accept-data-loss || echo 'prisma db push skipped'; node dist/main.js"]
