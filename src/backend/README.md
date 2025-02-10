# Community Management Platform - Backend Services

Enterprise-grade backend services for the Community Management Platform implementing advanced graph database operations, network analysis, and event management capabilities.

## Overview

The backend system consists of the following microservices:

- **API Gateway** (Port 3000): Entry point handling authentication, routing and rate limiting
- **Member Service** (Port 4000): Profile management and entity disambiguation
- **Event Service** (Port 4001): Event integration and data normalization
- **Analytics Service** (Port 5000): TDA computation and network analysis

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker >= 24.0.0
- Docker Compose >= 2.20.0
- Neo4j Enterprise >= 5.0
- Redis >= 7.0

## Getting Started

1. Clone the repository and navigate to the backend directory:

```bash
git clone https://github.com/organization/community-platform.git
cd community-platform/src/backend
```

2. Install dependencies:

```bash
pnpm install
```

3. Configure environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development environment:

```bash
pnpm run docker:up   # Start infrastructure containers
pnpm run dev        # Start all services in development mode
```

5. Verify the setup:

```bash
curl http://localhost:3000/health  # API Gateway health check
```

## Development

### Project Structure

```
src/backend/
├── api-gateway/          # API Gateway service
├── member-service/       # Member management service
├── event-service/       # Event integration service
├── analytics-service/   # TDA and network analysis service
├── shared/             # Shared utilities and types
├── docker-compose.yml  # Container orchestration
└── package.json       # Workspace configuration
```

### Service Ports

- API Gateway: 3000
- Member Service: 4000
- Event Service: 4001
- Analytics Service: 5000
- Neo4j: 7474 (HTTP), 7687 (Bolt)
- Redis: 6379

### Development Commands

```bash
# Start all services in development mode
pnpm run dev

# Build all services
pnpm run build

# Run tests
pnpm run test                # All tests
pnpm run test:unit          # Unit tests only
pnpm run test:integration   # Integration tests only

# Linting and formatting
pnpm run lint
pnpm run format

# Clean build artifacts
pnpm run clean
```

## Services

### API Gateway

- Authentication and authorization via Clerk
- Request routing and rate limiting
- Response caching
- Monitoring and logging

Configuration:
```yaml
cors:
  origins: http://localhost:3000
rate_limit:
  window: 60000
  max: 1000
```

### Member Service

- Profile management
- Entity disambiguation
- Graph operations
- Social profile integration

Configuration:
```yaml
neo4j:
  uri: bolt://neo4j:7687
redis:
  uri: redis://redis:6379
entity_cache_ttl: 3600
```

### Event Service

- Event platform integration (Luma, Eventbrite, Partiful)
- Data normalization
- Batch processing
- Queue management

Configuration:
```yaml
queue:
  concurrency: 5
import:
  batch_size: 100
```

### Analytics Service

- Topological Data Analysis (TDA)
- Network metrics computation
- Graph visualization
- Performance optimization

Configuration:
```yaml
tda:
  computation_timeout: 300
  max_dimension: 3
memory:
  limit: 4GB
```

## Security

### Authentication

- JWT-based authentication via Clerk
- Role-based access control
- Token validation and refresh
- Social login integration

### Data Protection

- Encryption at rest and in transit
- PII data handling compliance
- Secure credential management
- Regular security audits

### Rate Limiting

- Per-endpoint rate limits
- Redis-based rate limiting
- Automatic IP blocking
- DDoS protection

## Monitoring

### Health Checks

Each service exposes a `/health` endpoint providing:
- Service status
- Dependency health
- Resource utilization
- Response times

### Metrics

- Prometheus metrics collection
- Custom business metrics
- Performance monitoring
- Resource utilization tracking

### Logging

- Structured logging with Winston
- Log rotation and archival
- Error tracking and alerting
- Performance logging

## Deployment

### Docker

All services are containerized with multi-stage builds:
- Production-optimized images
- Non-root user execution
- Resource limits
- Health checks

### Resource Requirements

Minimum per service:
- CPU: 1 core
- Memory: 2GB
- Storage: 10GB

### Scaling

- Horizontal scaling via container orchestration
- Redis-based caching
- Connection pooling
- Load balancing

## Maintenance

### Backups

- Neo4j Enterprise backup procedures
- Redis persistence configuration
- Regular backup scheduling
- Backup verification

### Updates

- Rolling updates strategy
- Zero-downtime deployments
- Version compatibility checks
- Rollback procedures

### Performance

- Query optimization
- Cache management
- Resource monitoring
- Performance tuning

## Troubleshooting

Common issues and solutions:

1. Service Connection Issues
```bash
# Check service health
curl http://localhost:3000/health

# View service logs
docker-compose logs -f [service_name]
```

2. Database Connectivity
```bash
# Verify Neo4j connection
docker-compose exec neo4j cypher-shell -u neo4j -p password

# Check Redis connection
docker-compose exec redis redis-cli ping
```

3. Memory Issues
```bash
# View container stats
docker stats

# Check service logs for OOM errors
docker-compose logs -f [service_name] | grep "OutOfMemory"
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Submit pull request

Follow the coding standards:
- ESLint configuration
- Prettier formatting
- Test coverage requirements
- Documentation updates

## License

Private and Confidential - Community Platform Team