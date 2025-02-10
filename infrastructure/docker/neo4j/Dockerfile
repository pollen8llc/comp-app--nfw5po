# Use Neo4j Enterprise as base image
FROM neo4j:5.0-enterprise

# Labels for container metadata
LABEL maintainer="Community Management Platform Team" \
      description="Neo4j Enterprise container for Community Management Platform" \
      version="1.0"

# Accept Neo4j Enterprise license
ENV NEO4J_ACCEPT_LICENSE_AGREEMENT=yes

# Set authentication
ENV NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}

# Configure memory settings
ENV NEO4J_dbms_memory_heap_initial_size=4G \
    NEO4J_dbms_memory_heap_max_size=8G

# Configure security settings
ENV NEO4J_dbms_ssl_policy_bolt_enabled=true \
    NEO4J_dbms_ssl_policy_https_enabled=true \
    NEO4J_dbms_security_procedures_unrestricted=apoc.*,gds.*

# Configure Prometheus metrics
ENV NEO4J_metrics_prometheus_enabled=true \
    NEO4J_metrics_prometheus_endpoint=:2004

# Install APOC plugin - version 5.0.0
RUN wget -P /var/lib/neo4j/plugins \
    https://github.com/neo4j/apoc/releases/download/5.0.0/apoc-5.0.0-core.jar

# Install Graph Data Science plugin - version 2.4.0
RUN wget -P /var/lib/neo4j/plugins \
    https://graphdatascience.ninja/neo4j-graph-data-science-2.4.0.jar

# Create required directories
RUN mkdir -p /data /logs /plugins /certificates /import /ssl/bolt /ssl/https \
    && chown -R neo4j:neo4j /data /logs /plugins /certificates /import /ssl

# Copy custom configuration
COPY config/neo4j.conf /var/lib/neo4j/conf/neo4j.conf
RUN chown neo4j:neo4j /var/lib/neo4j/conf/neo4j.conf

# Create directories for SSL certificates
RUN mkdir -p /ssl/bolt /ssl/https \
    && chown -R neo4j:neo4j /ssl

# Expose ports
# - 7474: HTTP
# - 7473: HTTPS
# - 7687: Bolt
# - 2004: Prometheus metrics
EXPOSE 7474 7473 7687 2004

# Define volumes for persistence
VOLUME ["/data", "/logs", "/plugins", "/certificates", "/import", "/ssl"]

# Health check configuration
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:7474 || exit 1

# Custom entrypoint script for initialization
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]

# Default command to start Neo4j
CMD ["neo4j"]