FROM node:20-slim

# Install FFmpeg + ffprobe
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ALL deps (including devDeps for tsc)
COPY package*.json ./
RUN npm ci

# Copy source + compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Prune devDeps after build
RUN npm prune --omit=dev

# Working dirs for downloads and outputs
RUN mkdir -p temp outputs

ENV NODE_ENV=production
ENV PORT=3100

EXPOSE 3100

CMD ["node", "dist/server.js"]
