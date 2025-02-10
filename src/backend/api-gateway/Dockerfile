# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /build

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++ && \
    npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Build TypeScript and prune dev dependencies
RUN pnpm run build && \
    pnpm prune --prod

# Stage 2: Runtime
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Set runtime environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=UTC

# Install tini and create non-root user
RUN apk add --no-cache tini && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup

# Copy built application and dependencies from builder
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules

# Set ownership and permissions
RUN chown -R appuser:appgroup /app && \
    chmod -R 550 /app

# Switch to non-root user
USER appuser

# Expose API port
EXPOSE 3000

# Set resource limits
LABEL com.community.resource.cpu="1" \
      com.community.resource.memory="2GB"

# Add metadata labels
LABEL maintainer="DevOps Team" \
      com.community.version="${BUILD_VERSION}" \
      com.community.commit="${COMMIT_SHA}" \
      org.opencontainers.image.source="https://github.com/org/community-platform"

# Configure health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start API Gateway
CMD ["node", "dist/app.js"]

# Set security options
LABEL com.community.security.no-new-privileges="true"

# Set ulimits
LABEL com.community.ulimits.nofile.soft="1024" \
      com.community.ulimits.nofile.hard="2048"