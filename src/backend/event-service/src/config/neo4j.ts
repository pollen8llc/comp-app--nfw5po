import { Driver, driver as createDriver, Session, SessionConfig } from 'neo4j-driver'; // v5.0.0
import { z } from 'zod'; // v3.22.0
import { validateSchema } from '../../../shared/utils/validation';

// Neo4j configuration interface with strict typing
export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database: string;
  maxConnectionPoolSize: number;
  connectionTimeout: number;
  maxRetryTimeMs: number;
}

// Environment-based configuration with secure defaults
const NEO4J_CONFIG = {
  uri: process.env.NEO4J_URI,
  username: process.env.NEO4J_USERNAME,
  password: process.env.NEO4J_PASSWORD,
  database: process.env.NEO4J_DATABASE,
  maxConnectionPoolSize: Number(process.env.NEO4J_MAX_POOL_SIZE) || 100,
  connectionTimeout: Number(process.env.NEO4J_CONN_TIMEOUT) || 30000,
  maxRetryTimeMs: Number(process.env.NEO4J_MAX_RETRY_TIME) || 30000
};

// Zod schema for Neo4j configuration validation with enhanced security checks
const neo4jConfigSchema = z.object({
  uri: z.string()
    .url()
    .regex(/^(neo4j\+s|bolt\+s):\/\//i, 'Must use secure protocol (neo4j+s:// or bolt+s://)')
    .min(1),
  username: z.string().min(1),
  password: z.string().min(8),
  database: z.string().min(1),
  maxConnectionPoolSize: z.number().int().min(1).max(1000),
  connectionTimeout: z.number().int().min(1000).max(60000),
  maxRetryTimeMs: z.number().int().min(1000).max(60000)
});

// Singleton driver instance with private scope
let neo4jDriver: Driver | null = null;

/**
 * Validates Neo4j configuration using enhanced schema validation
 */
async function validateNeo4jConfig(config: Record<string, unknown>): Promise<Neo4jConfig> {
  try {
    const validatedConfig = await validateSchema(neo4jConfigSchema, config);
    return validatedConfig;
  } catch (error) {
    throw error;
  }
}

/**
 * Creates and initializes Neo4j driver with enhanced security settings
 */
async function createNeo4jDriver(config: Neo4jConfig): Promise<Driver> {
  const { uri, username, password, maxConnectionPoolSize, connectionTimeout, maxRetryTimeMs } = config;

  const driverConfig = {
    maxConnectionPoolSize,
    connectionTimeout,
    maxRetryTimeMs,
    encrypted: true, // Enforce encryption
    trust: 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES',
    logging: {
      level: 'warn',
      logger: (level: string, message: string) => {
        console.log(`[Neo4j Driver][${level}] ${message}`);
      }
    }
  };

  try {
    const newDriver = createDriver(uri, { username, password }, driverConfig);

    // Verify connectivity
    const session = newDriver.session();
    await session.run('RETURN 1');
    await session.close();

    // Set up connection pool monitoring
    monitorConnectionPool(newDriver);

    // Register cleanup handler
    process.on('SIGTERM', async () => {
      await newDriver.close();
    });

    return newDriver;
  } catch (error) {
    throw new Error(`Failed to create Neo4j driver: ${error.message}`);
  }
}

/**
 * Gets or creates Neo4j driver instance (singleton pattern)
 */
export async function getNeo4jDriver(): Promise<Driver> {
  if (!neo4jDriver) {
    const config = await validateNeo4jConfig(NEO4J_CONFIG);
    neo4jDriver = await createNeo4jDriver(config);
  }
  return neo4jDriver;
}

/**
 * Creates a new Neo4j session with enhanced management
 */
export async function getSession(
  database?: string,
  config: SessionConfig = {}
): Promise<Session> {
  const driver = await getNeo4jDriver();
  
  const sessionConfig: SessionConfig = {
    database: database || NEO4J_CONFIG.database,
    fetchSize: 1000,
    ...config
  };

  const session = driver.session(sessionConfig);

  // Set session timeout
  setTimeout(() => {
    if (!session.closed) {
      session.close();
    }
  }, NEO4J_CONFIG.connectionTimeout);

  return session;
}

/**
 * Monitors Neo4j connection pool health and metrics
 */
function monitorConnectionPool(driver: Driver): void {
  setInterval(async () => {
    try {
      const metrics = await driver.getMetrics();
      
      // Report connection pool metrics
      console.log({
        poolSize: metrics.connections.current,
        maxSize: metrics.connections.max,
        waiting: metrics.connections.waiting,
        inUse: metrics.connections.inUse,
        idle: metrics.connections.idle
      });

      // Implement circuit breaker if needed
      if (metrics.connections.waiting > metrics.connections.max * 0.8) {
        console.warn('Neo4j connection pool near capacity');
      }
    } catch (error) {
      console.error('Failed to collect Neo4j metrics:', error);
    }
  }, 30000); // Monitor every 30 seconds
}

/**
 * Closes Neo4j driver and cleans up resources
 */
export async function closeNeo4jDriver(): Promise<void> {
  if (neo4jDriver) {
    await neo4jDriver.close();
    neo4jDriver = null;
  }
}

// Export driver instance for direct access when needed
export { neo4jDriver };

// Export config interface for type checking
export { Neo4jConfig };