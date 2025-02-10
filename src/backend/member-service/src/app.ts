// External dependencies
import * as grpc from '@grpc/grpc-js'; // v1.9.0
import { Driver } from 'neo4j-driver'; // v5.12.0
import * as winston from 'winston'; // v3.10.0
import * as pino from 'pino'; // v8.15.0
import * as crypto from 'crypto';

// Internal imports
import { config } from './config';
import { MemberService } from './services/member.service';

// Initialize structured logging with correlation IDs
const logger = winston.createLogger({
  level: config.monitoring.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'member-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Performance metrics logger
const metricsLogger = pino({
  level: 'info',
  messageKey: 'message',
  timestamp: pino.stdTimeFunctions.isoTime
});

/**
 * Initializes Neo4j database connection with enhanced security and resilience
 */
async function initializeDatabase(): Promise<Driver> {
  const { neo4j } = config;
  
  try {
    const driver = await neo4j.driver(
      `${neo4j.scheme}://${neo4j.host}:${neo4j.port}`,
      neo4j.auth,
      {
        maxConnectionPoolSize: neo4j.maxConnectionPoolSize,
        maxTransactionRetryTime: neo4j.maxTransactionRetryTime,
        encrypted: neo4j.encryption,
        logging: {
          level: 'info',
          logger: (level, message) => logger.log(level, message)
        }
      }
    );

    // Verify connection
    await driver.verifyConnectivity();
    logger.info('Successfully connected to Neo4j database');
    
    return driver;
  } catch (error) {
    logger.error('Failed to initialize database connection', { error });
    throw error;
  }
}

/**
 * Configures and initializes the gRPC server with security and monitoring
 */
async function setupGrpcServer(driver: Driver): Promise<void> {
  const server = new grpc.Server({
    'grpc.max_receive_message_length': 1024 * 1024 * 10, // 10MB
    'grpc.max_send_message_length': 1024 * 1024 * 10,    // 10MB
    'grpc.keepalive_time_ms': 30000,
    'grpc.keepalive_timeout_ms': 10000,
    'grpc.http2.min_time_between_pings_ms': 30000,
    'grpc.http2.max_pings_without_data': 5
  });

  // Initialize member service with dependencies
  const memberService = new MemberService(
    driver,
    logger,
    config.security,
    config.monitoring
  );

  // Add service implementation to server
  server.addService(
    // Service definition would be imported from proto files
    {},
    {
      createMember: memberService.createMember.bind(memberService),
      getMemberById: memberService.getMemberById.bind(memberService),
      updateMember: memberService.updateMember.bind(memberService),
      deleteMember: memberService.deleteMember.bind(memberService),
      resolveMemberEntity: memberService.resolveMemberEntity.bind(memberService)
    }
  );

  // Setup health check service
  server.addService(
    // Health service definition
    {},
    {
      check: (call, callback) => {
        callback(null, { status: 'SERVING' });
      }
    }
  );

  // Bind server to configured host and port
  const address = `${config.host}:${config.port}`;
  server.bindAsync(
    address,
    grpc.ServerCredentials.createInsecure(), // In production, use TLS credentials
    (error, port) => {
      if (error) {
        logger.error('Failed to bind server', { error });
        throw error;
      }
      
      server.start();
      logger.info('gRPC server started', { address });
    }
  );
}

/**
 * Handles graceful shutdown with enhanced cleanup
 */
async function gracefulShutdown(driver: Driver): Promise<void> {
  logger.info('Initiating graceful shutdown');

  try {
    // Close database connection
    await driver.close();
    logger.info('Database connection closed');

    // Allow time for pending requests to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Exit process
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    // Initialize database connection
    const driver = await initializeDatabase();

    // Setup gRPC server
    await setupGrpcServer(driver);

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown(driver));
    process.on('SIGINT', () => gracefulShutdown(driver));

    // Log successful startup
    logger.info('Member service started successfully', {
      environment: config.environment,
      version: process.env.npm_package_version
    });

    // Start metrics collection
    setInterval(() => {
      metricsLogger.info({
        timestamp: Date.now(),
        metrics: {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        }
      });
    }, config.monitoring.metrics.interval);

  } catch (error) {
    logger.error('Failed to start member service', { error });
    process.exit(1);
  }
}

// Start the application
main().catch(error => {
  logger.error('Unhandled error in main', { error });
  process.exit(1);
});