FROM node:20-alpine

WORKDIR /app

# Install deps first (layer cache)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client (dummy URL — generate only reads schema, never connects)
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npx prisma generate

# Compile TypeScript at build time to avoid in-memory ts-node overhead at runtime
RUN npm run build

# Run migrations then start (real DATABASE_URL injected by Railway at runtime)
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node -r tsconfig-paths/register dist/main.js"]
