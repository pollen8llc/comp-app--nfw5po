// External dependencies
// zod@3.22.0 - Runtime type validation and schema definition
import { z } from 'zod';
// dotenv@16.3.1 - Secure environment variable loading
import * as dotenv from 'dotenv';

// Internal imports
import { neo4jConfig, Neo4jConfigSchema } from './neo4j';
import { validateSchema } from '../../shared/utils/validation';

// Load environment variables
dotenv.config();

// Service environment schema
const EnvironmentSchema = z.enum(['development', 'staging', 'production', 'test']);

// Log level schema
const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'trace']);

// Scaling configuration schema
const ScalingConfigSchema = z.object({
  minInstances: z.number().int().min(1).max(10).default(2),
  maxInstances: z.number().int().min(2).max(20).default(4),
  targetCpuUtilization: z.number().min(50).max(90).default(70),
  targetMemoryUtilization: z.number().min(50).max(90).default(80),
  sessionAffinity: z.boolean().default(true),
  healthCheck: z.object({
    path: z.string().default('/health'),
    interval: z.number().min(5000).max(300000).default(30000),
    timeout: z.number().min(1000).max(10000).default(5000),
    healthyThreshold: z.number().int().min(2).max(10).default(2),
    unhealthyThreshold: z.number().int().min(2).max(10).default(3),
  }),
});

// Security configuration schema
const SecurityConfigSchema = z.object({
  encryption: z.object({
    enabled: z.boolean().default(true),
    algorithm: z.enum(['aes-256-gcm']).default('aes-256-gcm'),
    keyRotationInterval: z.number().min(86400000).default(604800000), // 7 days
  }),
  rateLimit: z.object({
    windowMs: z.number().min(1000).default(60000),
    maxRequests: z.number().min(1).default(100),
  }),
  fieldLevelEncryption: z.object({
    enabled: z.boolean().default(true),
    sensitiveFields: z.array(z.string()).default(['email', 'phone']),
  }),
});

// Monitoring configuration schema
const MonitoringConfigSchema = z.object({
  metrics: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().min(1000).max(60000).default(10000),
    prefix: z.string().default('member_service_'),
  }),
  tracing: z.object({
    enabled: z.boolean().default(true),
    sampleRate: z.number().min(0).max(1).default(0.1),
  }),
  logging: z.object({
    level: LogLevelSchema.default('info'),
    format: z.enum(['json', 'text']).default('json'),
  }),
});

// Resilience configuration schema
const ResilienceConfigSchema = z.object({
  circuitBreaker: z.object({
    enabled: z.boolean().default(true),
    failureThreshold: z.number().min(1).max(100).default(50),
    resetTimeout: z.number().min(1000).max(60000).default(30000),
  }),
  retry: z.object({
    maxAttempts: z.number().min(1).max(10).default(3),
    initialDelay: z.number().min(100).max(5000).default(1000),
    maxDelay: z.number().min(1000).max(30000).default(5000),
  }),
});

// Complete service configuration schema
export const ServiceConfigSchema = z.object({
  port: z.number().int().min(1024).max(65535).default(4000),
  host: z.string().min(1).default('0.0.0.0'),
  environment: EnvironmentSchema.default('development'),
  logLevel: LogLevelSchema.default('info'),
  neo4j: Neo4jConfigSchema,
  scaling: ScalingConfigSchema,
  security: SecurityConfigSchema,
  monitoring: MonitoringConfigSchema,
  resilience: ResilienceConfigSchema,
});

// Type inference from schema
type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

/**
 * Validates the complete service configuration
 * @param rawConfig - Raw configuration object from environment
 * @returns Validated service configuration
 * @throws {ValidationError} If validation fails
 */
async function validateServiceConfig(rawConfig: unknown): Promise<ServiceConfig> {
  return validateSchema(ServiceConfigSchema, {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    host: process.env.HOST,
    environment: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    neo4j: neo4jConfig,
    scaling: {
      minInstances: process.env.MIN_INSTANCES ? parseInt(process.env.MIN_INSTANCES, 10) : undefined,
      maxInstances: process.env.MAX_INSTANCES ? parseInt(process.env.MAX_INSTANCES, 10) : undefined,
      targetCpuUtilization: process.env.TARGET_CPU_UTILIZATION ? 
        parseInt(process.env.TARGET_CPU_UTILIZATION, 10) : undefined,
      targetMemoryUtilization: process.env.TARGET_MEMORY_UTILIZATION ?
        parseInt(process.env.TARGET_MEMORY_UTILIZATION, 10) : undefined,
      sessionAffinity: process.env.SESSION_AFFINITY === 'true',
      healthCheck: {
        path: process.env.HEALTH_CHECK_PATH,
        interval: process.env.HEALTH_CHECK_INTERVAL ? 
          parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) : undefined,
        timeout: process.env.HEALTH_CHECK_TIMEOUT ?
          parseInt(process.env.HEALTH_CHECK_TIMEOUT, 10) : undefined,
        healthyThreshold: process.env.HEALTHY_THRESHOLD ?
          parseInt(process.env.HEALTHY_THRESHOLD, 10) : undefined,
        unhealthyThreshold: process.env.UNHEALTHY_THRESHOLD ?
          parseInt(process.env.UNHEALTHY_THRESHOLD, 10) : undefined,
      },
    },
    security: {
      encryption: {
        enabled: process.env.ENCRYPTION_ENABLED !== 'false',
        algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
        keyRotationInterval: process.env.KEY_ROTATION_INTERVAL ?
          parseInt(process.env.KEY_ROTATION_INTERVAL, 10) : undefined,
      },
      rateLimit: {
        windowMs: process.env.RATE_LIMIT_WINDOW ?
          parseInt(process.env.RATE_LIMIT_WINDOW, 10) : undefined,
        maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS ?
          parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) : undefined,
      },
      fieldLevelEncryption: {
        enabled: process.env.FIELD_LEVEL_ENCRYPTION !== 'false',
        sensitiveFields: process.env.SENSITIVE_FIELDS ?
          process.env.SENSITIVE_FIELDS.split(',') : undefined,
      },
    },
    monitoring: {
      metrics: {
        enabled: process.env.METRICS_ENABLED !== 'false',
        interval: process.env.METRICS_INTERVAL ?
          parseInt(process.env.METRICS_INTERVAL, 10) : undefined,
        prefix: process.env.METRICS_PREFIX,
      },
      tracing: {
        enabled: process.env.TRACING_ENABLED !== 'false',
        sampleRate: process.env.TRACING_SAMPLE_RATE ?
          parseFloat(process.env.TRACING_SAMPLE_RATE) : undefined,
      },
      logging: {
        level: process.env.LOG_LEVEL as z.infer<typeof LogLevelSchema>,
        format: process.env.LOG_FORMAT as 'json' | 'text',
      },
    },
    resilience: {
      circuitBreaker: {
        enabled: process.env.CIRCUIT_BREAKER_ENABLED !== 'false',
        failureThreshold: process.env.CIRCUIT_BREAKER_THRESHOLD ?
          parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10) : undefined,
        resetTimeout: process.env.CIRCUIT_BREAKER_RESET_TIMEOUT ?
          parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT, 10) : undefined,
      },
      retry: {
        maxAttempts: process.env.RETRY_MAX_ATTEMPTS ?
          parseInt(process.env.RETRY_MAX_ATTEMPTS, 10) : undefined,
        initialDelay: process.env.RETRY_INITIAL_DELAY ?
          parseInt(process.env.RETRY_INITIAL_DELAY, 10) : undefined,
        maxDelay: process.env.RETRY_MAX_DELAY ?
          parseInt(process.env.RETRY_MAX_DELAY, 10) : undefined,
      },
    },
  });
}

// Initialize and validate service configuration
const config = await validateServiceConfig({});

// Export validated configuration
export { config };