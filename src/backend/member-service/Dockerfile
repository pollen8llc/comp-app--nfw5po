# Stage 1: Builder
FROM node:18-alpine AS builder

# Install build essentials and pnpm
RUN apk add --no-cache python3 make g++ \
    && corepack enable \
    && corepack prepare pnpm@8.x --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript application
RUN pnpm run build

# Prune development dependencies
RUN pnpm prune --prod

# Stage 2: Production
FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init=1.2.5-r1 curl=8.4.0-r0

# Create non-root user/group
RUN addgroup -S nodegroup && adduser -S nodeuser -G nodegroup

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nodeuser:nodegroup /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodegroup /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodegroup /app/package.json ./

# Set environment variables
ENV NODE_ENV=production \
    PORT=4000 \
    NODE_OPTIONS="--max-old-space-size=1536" \
    TZ=UTC

# Configure security
USER nodeuser

# Set resource limits
LABEL com.docker.resource.cpu="1" \
      com.docker.resource.memory="2GB"

# Expose service port
EXPOSE 4000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# Add metadata labels
LABEL maintainer="Community Platform Team" \
      version="1.0.0" \
      service="member-service" \
      environment="production"

# Set entry point with dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/app.js"]