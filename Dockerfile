FROM node:20-alpine

WORKDIR /app

# Install deps first (layer cache)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client (dummy URL — generate only reads schema, never connects)
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npx prisma generate

# Run migrations then start (real DATABASE_URL injected by Railway at runtime)
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
