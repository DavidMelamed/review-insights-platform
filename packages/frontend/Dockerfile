# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.1 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @review-analysis/frontend...

# Copy source code
COPY packages/frontend ./packages/frontend

# Build the application
WORKDIR /app/packages/frontend
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm build

# Production stage
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.1 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/frontend/package.json ./packages/frontend/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter @review-analysis/frontend... --prod

# Copy built application
COPY --from=builder /app/packages/frontend/.next ./packages/frontend/.next
COPY --from=builder /app/packages/frontend/public ./packages/frontend/public
COPY --from=builder /app/packages/frontend/next.config.js ./packages/frontend/

WORKDIR /app/packages/frontend

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3004

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

CMD ["pnpm", "start"]