# Use Redis 7.0 Alpine as base image for minimal footprint and security
# redis:7.0-alpine
FROM redis:7.0-alpine

# Create Redis data directory and set proper ownership
RUN mkdir -p /data && \
    chown redis:redis /data

# Copy custom Redis configuration with optimized settings
COPY config/redis.conf /usr/local/etc/redis/redis.conf

# Configure persistent volume for data durability
VOLUME /data

# Expose standard Redis port
EXPOSE 6379

# Implement health check for container monitoring
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD redis-cli ping || exit 1

# Start Redis server with custom configuration
CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]