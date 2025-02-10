// External dependencies
// zod@3.22.0 - Runtime type validation and schema enforcement
import { z } from 'zod';
// dotenv@16.3.1 - Secure loading of environment variables
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Neo4j configuration schema with comprehensive validation
export const Neo4jConfigSchema = z.object({
  // Connection protocol with secure options enforced
  scheme: z.enum(['neo4j', 'neo4j+s', 'bolt', 'bolt+s'])
    .default('neo4j+s')
    .describe('Neo4j connection protocol'),

  // Host validation with regex pattern for hostname format
  host: z.string()
    .min(1)
    .regex(/^[a-zA-Z0-9]([a-zA-Z0-9-.])*[a-zA-Z0-9]$/)
    .describe('Neo4j host address'),

  // Port validation within valid range for non-privileged ports
  port: z.number()
    .int()
    .min(1024)
    .max(65535)
    .default(7687)
    .describe('Neo4j port number'),

  // Credentials with minimum security requirements
  username: z.string()
    .min(1)
    .describe('Neo4j username'),
  
  password: z.string()
    .min(8)
    .describe('Neo4j password'),

  // Database name validation
  database: z.string()
    .min(1)
    .default('neo4j')
    .describe('Neo4j database name'),

  // Security settings with secure defaults
  encryption: z.boolean()
    .default(true)
    .describe('TLS encryption enabled'),

  // Performance tuning parameters
  maxConnectionPoolSize: z.number()
    .int()
    .min(5)
    .max(50)
    .default(20)
    .describe('Maximum number of connections in the pool'),

  maxTransactionRetryTime: z.number()
    .int()
    .min(1000)
    .max(30000)
    .default(5000)
    .describe('Maximum time to retry failed transactions in milliseconds'),
});

// Type inference from schema
type Neo4jConfig = z.infer<typeof Neo4jConfigSchema>;

/**
 * Validates and processes Neo4j configuration from environment variables
 * @param environmentConfig - Environment configuration object
 * @returns Validated Neo4j configuration
 * @throws {Error} If validation fails or required variables are missing
 */
function validateNeo4jConfig(environmentConfig: NodeJS.ProcessEnv): Neo4jConfig {
  try {
    const config = Neo4jConfigSchema.parse({
      scheme: environmentConfig.NEO4J_SCHEME,
      host: environmentConfig.NEO4J_HOST,
      port: environmentConfig.NEO4J_PORT ? parseInt(environmentConfig.NEO4J_PORT, 10) : undefined,
      username: environmentConfig.NEO4J_USERNAME,
      password: environmentConfig.NEO4J_PASSWORD,
      database: environmentConfig.NEO4J_DATABASE,
      encryption: environmentConfig.NEO4J_ENCRYPTION !== 'false',
      maxConnectionPoolSize: environmentConfig.NEO4J_MAX_CONNECTION_POOL_SIZE 
        ? parseInt(environmentConfig.NEO4J_MAX_CONNECTION_POOL_SIZE, 10) 
        : undefined,
      maxTransactionRetryTime: environmentConfig.NEO4J_MAX_TRANSACTION_RETRY_TIME
        ? parseInt(environmentConfig.NEO4J_MAX_TRANSACTION_RETRY_TIME, 10)
        : undefined,
    });

    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('\n');
      throw new Error(`Neo4j configuration validation failed:\n${errorMessages}`);
    }
    throw error;
  }
}

// Global validated configuration
const NEO4J_CONFIG = validateNeo4jConfig(process.env);

// Export validated configuration
export const neo4jConfig = NEO4J_CONFIG;