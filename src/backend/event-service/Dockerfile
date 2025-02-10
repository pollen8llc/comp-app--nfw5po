# Base stage with Node.js runtime and build tools
FROM node:18-alpine AS base
WORKDIR /app
ENV NODE_ENV=production \
    SERVICE_NAME=event-service \
    LOG_LEVEL=info \
    EVENT_SERVICE_PORT=4001
# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Dependencies stage - install production dependencies
FROM base AS dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@8 && \
    pnpm install --prod --frozen-lockfile

# Builder stage - build TypeScript application
FROM dependencies AS builder
COPY . .
RUN pnpm install --frozen-lockfile && \
    pnpm build && \
    pnpm prune --prod

# Final stage - minimal production image
FROM base AS final

# Create non-root user/group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S node -G nodejs -u 1001

# Copy built application and dependencies
COPY --from=builder --chown=node:nodejs /app/dist ./dist
COPY --from=builder --chown=node:nodejs /app/node_modules ./node_modules

# Set secure file permissions
RUN chmod 755 /app && \
    chmod 644 /app/dist/* && \
    chmod 644 /app/node_modules/**/*

# Configure container
USER node
EXPOSE 4001

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:4001/health || exit 1

# Resource limits
# Note: These are configured at runtime via container orchestration
# CPU: 1
# Memory: 2GB

# Start application
CMD ["node", "dist/app.js"]