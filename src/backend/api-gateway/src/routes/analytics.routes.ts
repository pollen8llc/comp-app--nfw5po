import express from 'express'; // ^4.18.2
import { RateLimiterRedis } from 'rate-limiter-flexible'; // ^2.4.1
import CircuitBreaker from 'circuit-breaker-js'; // ^0.5.0
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/request-validator';
import { analyticsSchemas } from '../../../shared/schemas/analytics.schema';
import { logger } from '../utils/logger';
import { RedisService } from '../services/redis.service';
import { MetricCollector } from '../../../shared/utils/metrics';
import { ERROR_CODES } from '../../../shared/utils/error-codes';
import { sendSuccess, sendError } from '../utils/response';
import { TDAParameters, NetworkAnalysisConfig, GraphQuery } from '../../../shared/types/analytics.types';

// Initialize router
const router = express.Router();

// Initialize metrics collector for analytics routes
const metrics = new MetricCollector('analytics_routes', {
  serviceName: 'api-gateway',
  customBuckets: [0.1, 0.5, 1, 2, 5],
  labels: ['operation', 'status']
});

// Initialize Redis-based rate limiters
const redisService = RedisService.getInstance();
const rateLimiters = {
  tda: new RateLimiterRedis({
    storeClient: redisService.client,
    keyPrefix: 'ratelimit:tda',
    points: 30,
    duration: 60
  }),
  network: new RateLimiterRedis({
    storeClient: redisService.client,
    keyPrefix: 'ratelimit:network',
    points: 20,
    duration: 60
  }),
  graph: new RateLimiterRedis({
    storeClient: redisService.client,
    keyPrefix: 'ratelimit:graph',
    points: 50,
    duration: 60
  })
};

// Initialize circuit breakers for service calls
const circuitBreakers = {
  tda: new CircuitBreaker({
    windowDuration: 10000,
    numBuckets: 10,
    timeoutDuration: 3000,
    errorThreshold: 50,
    volumeThreshold: 10
  }),
  network: new CircuitBreaker({
    windowDuration: 10000,
    numBuckets: 10,
    timeoutDuration: 3000,
    errorThreshold: 50,
    volumeThreshold: 10
  }),
  graph: new CircuitBreaker({
    windowDuration: 10000,
    numBuckets: 10,
    timeoutDuration: 2000,
    errorThreshold: 50,
    volumeThreshold: 20
  })
};

// TDA computation endpoint
router.post('/tda',
  authenticate,
  authorize(['admin', 'analyst']),
  validateRequest(analyticsSchemas.tdaParametersSchema),
  async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    try {
      // Apply rate limiting
      await rateLimiters.tda.consume(req.ip);

      // Extract and validate TDA parameters
      const tdaParams: TDAParameters = req.body;

      // Execute TDA computation with circuit breaker
      const result = await circuitBreakers.tda.execute(async () => {
        const response = await fetch('http://analytics-service:5000/tda', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          },
          body: JSON.stringify(tdaParams)
        });

        if (!response.ok) {
          throw new Error('TDA computation failed');
        }

        return await response.json();
      });

      // Record success metrics
      metrics.recordMetricBatch([{
        name: 'tda_computation',
        value: Date.now() - startTime,
        labels: { status: 'success' }
      }]);

      sendSuccess(res, result, {
        requestId,
        monitoring: {
          duration: Date.now() - startTime,
          complexity: tdaParams.dimension
        }
      });
    } catch (error) {
      logger.error('TDA computation error', {
        error,
        requestId,
        duration: Date.now() - startTime
      });

      metrics.recordMetricBatch([{
        name: 'tda_computation',
        value: Date.now() - startTime,
        labels: { status: 'error' }
      }]);

      sendError(res, error, {
        code: ERROR_CODES.TDA_COMPUTATION_ERROR,
        requestId
      });
    }
  }
);

// Network analysis endpoint
router.post('/network',
  authenticate,
  authorize(['admin', 'analyst']),
  validateRequest(analyticsSchemas.networkAnalysisConfigSchema),
  async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    try {
      // Apply rate limiting
      await rateLimiters.network.consume(req.ip);

      // Extract and validate network analysis config
      const config: NetworkAnalysisConfig = req.body;

      // Execute network analysis with circuit breaker
      const result = await circuitBreakers.network.execute(async () => {
        const response = await fetch('http://analytics-service:5000/network', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          },
          body: JSON.stringify(config)
        });

        if (!response.ok) {
          throw new Error('Network analysis failed');
        }

        return await response.json();
      });

      // Record success metrics
      metrics.recordMetricBatch([{
        name: 'network_analysis',
        value: Date.now() - startTime,
        labels: { status: 'success' }
      }]);

      sendSuccess(res, result, {
        requestId,
        monitoring: {
          duration: Date.now() - startTime,
          complexity: config.metrics.length
        }
      });
    } catch (error) {
      logger.error('Network analysis error', {
        error,
        requestId,
        duration: Date.now() - startTime
      });

      metrics.recordMetricBatch([{
        name: 'network_analysis',
        value: Date.now() - startTime,
        labels: { status: 'error' }
      }]);

      sendError(res, error, {
        code: ERROR_CODES.GRAPH_QUERY_ERROR,
        requestId
      });
    }
  }
);

// Graph query endpoint
router.post('/graph',
  authenticate,
  authorize(['admin', 'analyst']),
  validateRequest(analyticsSchemas.graphQuerySchema),
  async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    try {
      // Apply rate limiting
      await rateLimiters.graph.consume(req.ip);

      // Extract and validate graph query
      const query: GraphQuery = req.body;

      // Execute graph query with circuit breaker
      const result = await circuitBreakers.graph.execute(async () => {
        const response = await fetch('http://analytics-service:5000/graph', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          },
          body: JSON.stringify(query)
        });

        if (!response.ok) {
          throw new Error('Graph query failed');
        }

        return await response.json();
      });

      // Record success metrics
      metrics.recordMetricBatch([{
        name: 'graph_query',
        value: Date.now() - startTime,
        labels: { status: 'success' }
      }]);

      sendSuccess(res, result, {
        requestId,
        monitoring: {
          duration: Date.now() - startTime,
          complexity: query.complexity
        }
      });
    } catch (error) {
      logger.error('Graph query error', {
        error,
        requestId,
        duration: Date.now() - startTime
      });

      metrics.recordMetricBatch([{
        name: 'graph_query',
        value: Date.now() - startTime,
        labels: { status: 'error' }
      }]);

      sendError(res, error, {
        code: ERROR_CODES.GRAPH_QUERY_ERROR,
        requestId
      });
    }
  }
);

export default router;