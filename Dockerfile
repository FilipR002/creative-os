FROM node:20-alpine

WORKDIR /app

# Install deps first (layer cache)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
