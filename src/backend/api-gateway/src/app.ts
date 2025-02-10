import express, { Express } from 'express'; // ^4.18.2
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import morgan from 'morgan'; // ^1.10.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import CircuitBreaker from 'opossum'; // ^7.1.0

// Internal imports
import router from './routes';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { requestValidator } from './middleware/request-validator';
import { logger } from './utils/logger';
import { config } from './config';
import { RedisService } from './services/redis.service';
import { MetricCollector } from '../../shared/utils/metrics';

// Initialize Express application
const app: Express = express();

// Initialize metrics collector
const metrics = new MetricCollector('api_gateway', {
  serviceName: 'api-gateway',
  customBuckets: [0.1, 0.5, 1, 2, 5],
  labels: ['endpoint', 'status']
});

/**
 * Configures global middleware with enhanced security and monitoring
 */
async function configureMiddleware(app: Express): Promise<void> {
  try {
    // Security middleware
    app.use(helmet(config.security.helmet));
    app.use(cors(config.security.cors));

    // Performance middleware
    app.use(compression());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware with security context
    app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          logger.info('HTTP Access Log', { message });
        }
      }
    }));

    // Request correlation
    app.use((req, res, next) => {
      req.headers['x-request-id'] = req.headers['x-request-id'] || 
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      next();
    });

    // Rate limiting
    app.use(rateLimit(config.rateLimit));

    // Authentication middleware
    app.use(authenticate);

    // Request validation
    app.use(requestValidator);

    // Performance monitoring
    app.use((req, res, next) => {
      const startTime = Date.now();
      res.on('finish', () => {
        metrics.recordMetricBatch([{
          name: 'request_duration',
          value: Date.now() - startTime,
          labels: {
            endpoint: req.path,
            status: res.statusCode.toString()
          }
        }]);
      });
      next();
    });

  } catch (error) {
    logger.error('Middleware configuration error', { error });
    throw error;
  }
}

/**
 * Configures routes with security middleware and monitoring
 */
async function configureRoutes(app: Express): Promise<void> {
  try {
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });

    // Mount main router with security and monitoring
    app.use('/api/v1', router);

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found'
        }
      });
    });

    // Global error handler
    app.use(errorHandler);

  } catch (error) {
    logger.error('Route configuration error', { error });
    throw error;
  }
}

/**
 * Initializes and starts the Express server with graceful shutdown
 */
async function startServer(app: Express): Promise<void> {
  try {
    // Initialize Redis connection
    await RedisService.getInstance().connect();

    // Configure middleware and routes
    await configureMiddleware(app);
    await configureRoutes(app);

    // Initialize circuit breaker for downstream services
    const breaker = new CircuitBreaker(async () => {
      // Health check implementation
    }, config.circuitBreaker);

    // Start server
    const server = app.listen(config.port, () => {
      logger.info('Server started', {
        port: config.port,
        environment: config.env,
        version: process.env.npm_package_version
      });
    });

    // Graceful shutdown handler
    const shutdown = async () => {
      logger.info('Shutting down server...');
      
      server.close(async () => {
        try {
          await RedisService.getInstance().disconnect();
          logger.info('Server shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error });
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Server startup error', { error });
    throw error;
  }
}

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer(app).catch((error) => {
    logger.error('Fatal server error', { error });
    process.exit(1);
  });
}

export { app, startServer };