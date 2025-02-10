import express, { Router } from 'express'; // ^4.18.2
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import { graphqlHTTP } from 'express-graphql'; // ^0.12.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { validate } from 'express-validator'; // ^7.0.0
import cacheMiddleware from 'express-cache-middleware'; // ^1.0.0

// Import route handlers
import analyticsRouter from './analytics.routes';
import eventRouter from './event.routes';
import memberRouter from './member.routes';
import graphRouter from './graph.routes';

// Import configurations and utilities
import { corsConfig } from '../config/cors';
import { rateLimitConfig } from '../config/rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';
import { MetricCollector } from '../../../shared/utils/metrics';
import { ERROR_CODES } from '../../../shared/utils/error-codes';
import { RedisService } from '../services/redis.service';

// Initialize router and services
const router = Router();
const redisService = RedisService.getInstance();

// Initialize metrics collector
const metrics = new MetricCollector('api_gateway_routes', {
  serviceName: 'api-gateway',
  customBuckets: [0.1, 0.5, 1, 2, 5],
  labels: ['route', 'method', 'status']
});

/**
 * Configures and mounts all API routes with comprehensive middleware chain
 * @param router - Express router instance
 * @returns Configured router with all routes and middleware
 */
function configureRoutes(router: Router): Router {
  // Apply security middleware
  router.use(helmet(config.security.helmet));
  router.use(cors(corsConfig));

  // Apply performance middleware
  router.use(compression());
  router.use(express.json({ limit: '10mb' }));
  router.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Configure caching
  const cache = new cacheMiddleware({
    store: redisService.client,
    expire: 300 // 5 minutes
  });
  router.use(cache.middleware());

  // Apply rate limiting
  router.use(rateLimit(rateLimitConfig));

  // Request logging and monitoring
  router.use((req, res, next) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    // Log request
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      requestId
    });

    // Record metrics after response
    res.on('finish', () => {
      metrics.recordMetricBatch([{
        name: 'request_duration',
        value: Date.now() - startTime,
        labels: {
          route: req.path,
          method: req.method,
          status: res.statusCode.toString()
        }
      }]);
    });

    next();
  });

  // Mount API routes
  router.use('/api/v1/analytics', analyticsRouter);
  router.use('/api/v1/events', eventRouter);
  router.use('/api/v1/members', memberRouter);
  router.use('/api/v1/graph', graphRouter);

  // Mount GraphQL endpoint
  router.use('/api/v1/graphql', graphqlHTTP({
    schema: null, // TODO: Import GraphQL schema
    graphiql: process.env.NODE_ENV !== 'production',
    context: ({ req }) => ({
      user: req.user,
      requestId: req.headers['x-request-id']
    })
  }));

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });

  // Error handling middleware
  router.use((err, req, res, next) => {
    logger.error('Unhandled error', {
      error: err,
      path: req.path,
      requestId: req.headers['x-request-id']
    });

    res.status(500).json({
      error: {
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'Internal server error'
      }
    });
  });

  return router;
}

// Configure and export router
export default configureRoutes(router);

// Export route configuration for testing
export { configureRoutes };