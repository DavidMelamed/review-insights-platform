# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.1 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @review-analysis/api...

# Copy source code
COPY packages/api ./packages/api

# Generate Prisma client
WORKDIR /app/packages/api
RUN pnpm prisma generate

# Build the application
RUN pnpm build

# Production stage
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.1 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter @review-analysis/api... --prod

# Copy built application and Prisma files
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma
COPY --from=builder /app/packages/api/node_modules/.prisma ./packages/api/node_modules/.prisma

WORKDIR /app/packages/api

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

CMD ["node", "dist/server.js"]