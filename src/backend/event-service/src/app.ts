import { Server, ServerCredentials } from '@grpc/grpc-js'; // v1.9.0
import { Driver } from 'neo4j-driver'; // v5.12.0
import Redis from 'ioredis'; // v5.3.2
import winston from 'winston'; // v3.10.0
import newrelic from 'newrelic'; // v10.3.0
import CircuitBreaker from 'opossum'; // v7.1.0

import { config } from './config';
import { EventService } from './services/event.service';

// Initialize structured logging
const logger = winston.createLogger({
  level: config.service.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Initialize APM monitoring
const apm = newrelic.agent({
  appName: 'event-service',
  licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: config.service.logLevel
  }
});

/**
 * Initializes all required service dependencies with connection pooling and monitoring
 */
async function initializeServices(): Promise<{
  neo4j: Driver,
  redis: Redis,
  eventService: EventService
}> {
  try {
    // Initialize Neo4j driver with connection pooling
    const neo4j = await config.neo4j.getNeo4jDriver();
    
    // Initialize Redis with cluster support
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => Math.min(times * 50, 2000)
    });

    // Initialize circuit breakers for external services
    const platformBreakers = new Map();
    Object.entries(config.eventPlatforms).forEach(([platform, cfg]) => {
      platformBreakers.set(platform, new CircuitBreaker(async () => {}, {
        timeout: cfg.timeout,
        errorThresholdPercentage: 50,
        resetTimeout: 30000
      }));
    });

    // Initialize event service with dependencies
    const eventService = new EventService(neo4j, redis, logger);

    // Verify all connections
    await Promise.all([
      neo4j.verifyConnectivity(),
      redis.ping()
    ]);

    // Setup monitoring metrics
    apm.recordMetric('neo4j.poolSize', neo4j.getPoolSize());
    apm.recordMetric('redis.connected', redis.status === 'ready' ? 1 : 0);

    return { neo4j, redis, eventService };
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

/**
 * Creates and configures the gRPC server with comprehensive error handling
 */
function createGrpcServer(eventService: EventService): Server {
  const server = new Server({
    'grpc.max_receive_message_length': 1024 * 1024 * 10, // 10MB
    'grpc.max_send_message_length': 1024 * 1024 * 10,    // 10MB
    'grpc.keepalive_time_ms': 30000,                     // 30 seconds
    'grpc.keepalive_timeout_ms': 10000                   // 10 seconds
  });

  // Add event service implementation
  server.addService(
    // Service definition would be imported from proto files
    {},
    {
      // Implement service methods with error handling
      createEvent: eventService.createEvent.bind(eventService),
      getEvent: eventService.getEvent.bind(eventService),
      updateEvent: eventService.updateEvent.bind(eventService),
      importEvents: eventService.importEvents.bind(eventService)
    }
  );

  // Add monitoring interceptors
  server.interceptors = [
    async (call, methodDefinition) => {
      const startTime = Date.now();
      try {
        const result = await methodDefinition.handler(call);
        apm.recordMetric(`grpc.${methodDefinition.path}.success`, 1);
        apm.recordMetric(`grpc.${methodDefinition.path}.duration`, Date.now() - startTime);
        return result;
      } catch (error) {
        apm.recordMetric(`grpc.${methodDefinition.path}.error`, 1);
        throw error;
      }
    }
  ];

  return server;
}

/**
 * Handles graceful shutdown of server and services
 */
async function gracefulShutdown(
  server: Server,
  neo4j: Driver,
  redis: Redis
): Promise<void> {
  logger.info('Initiating graceful shutdown...');

  // Stop accepting new requests
  server.tryShutdown(async () => {
    try {
      // Close service connections
      await Promise.all([
        neo4j.close(),
        redis.quit()
      ]);

      // Flush monitoring metrics
      await apm.flush();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    // Initialize services
    const { neo4j, redis, eventService } = await initializeServices();

    // Create and configure gRPC server
    const server = createGrpcServer(eventService);

    // Start server
    server.bindAsync(
      `0.0.0.0:${config.service.port}`,
      ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          throw error;
        }
        server.start();
        logger.info(`Event service listening on port ${port}`);
      }
    );

    // Register signal handlers
    ['SIGTERM', 'SIGINT'].forEach(signal => {
      process.on(signal, () => gracefulShutdown(server, neo4j, redis));
    });

    // Start monitoring
    apm.startBackgroundTransaction('monitoring', async () => {
      setInterval(() => {
        apm.recordMetric('service.uptime', process.uptime());
      }, 60000);
    });

    logger.info('Event service initialized successfully');
  } catch (error) {
    logger.error('Failed to start event service:', error);
    process.exit(1);
  }
}

// Start the application
main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});