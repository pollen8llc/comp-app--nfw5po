import { z } from 'zod'; // v3.22.0
import { config as dotenv } from 'dotenv'; // v16.3.1
import { Neo4jConfig, neo4jDriver } from './neo4j';
import { validateSchema } from '../../../shared/utils/validation';

// Load environment variables with encryption support
dotenv();

// Service configuration schema with enhanced security validation
const serviceConfigSchema = z.object({
  port: z.number().int().min(1024).max(65535),
  environment: z.enum(['development', 'staging', 'production']),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']),
  encryptionKey: z.string().min(32).optional()
    .refine(key => process.env.NODE_ENV === 'production' ? !!key : true, {
      message: 'Encryption key is required in production'
    })
});

// Event platform configuration schema with credential validation
const platformConfigSchema = z.object({
  apiKey: z.string().min(16),
  baseUrl: z.string().url(),
  timeout: z.number().int().min(1000).max(30000),
  retryAttempts: z.number().int().min(1).max(5)
});

const eventPlatformConfigSchema = z.object({
  luma: platformConfigSchema,
  eventbrite: platformConfigSchema,
  partiful: platformConfigSchema
});

// Rate limit configuration schema
const rateLimitConfigSchema = z.object({
  windowMs: z.number().int().min(1000),
  max: z.number().int().min(1),
  skipFailedRequests: z.boolean(),
  standardHeaders: z.boolean(),
  legacyHeaders: z.boolean(),
  handler: z.function()
});

// Service configuration with secure defaults
const SERVICE_CONFIG = {
  port: Number(process.env.EVENT_SERVICE_PORT) || 4001,
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  encryptionKey: process.env.CONFIG_ENCRYPTION_KEY
};

// Event platform configuration with secure integration
const EVENT_PLATFORM_CONFIG = {
  luma: {
    apiKey: process.env.LUMA_API_KEY!,
    baseUrl: process.env.LUMA_API_URL || 'https://api.lu.ma/v1',
    timeout: 5000,
    retryAttempts: 3
  },
  eventbrite: {
    apiKey: process.env.EVENTBRITE_API_KEY!,
    baseUrl: process.env.EVENTBRITE_API_URL || 'https://www.eventbriteapi.com/v3',
    timeout: 5000,
    retryAttempts: 3
  },
  partiful: {
    apiKey: process.env.PARTIFUL_API_KEY!,
    baseUrl: process.env.PARTIFUL_API_URL || 'https://api.partiful.com/v1',
    timeout: 5000,
    retryAttempts: 3
  }
};

// Rate limiting configuration with IP-based rules
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  skipFailedRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: any, res: any) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(RATE_LIMIT_CONFIG.windowMs / 1000)
    });
  }
};

/**
 * Validates service configuration with enhanced security checks
 */
async function validateServiceConfig(config: Record<string, unknown>): Promise<ServiceConfig> {
  try {
    const validatedConfig = await validateSchema(serviceConfigSchema, config);
    
    // Additional production environment checks
    if (validatedConfig.environment === 'production') {
      if (!validatedConfig.encryptionKey) {
        throw new Error('Encryption key is required in production environment');
      }
      if (validatedConfig.logLevel === 'debug') {
        console.warn('Debug logging is enabled in production environment');
      }
    }

    return validatedConfig;
  } catch (error) {
    throw error;
  }
}

/**
 * Validates event platform configuration with enhanced security measures
 */
async function validateEventPlatformConfig(config: Record<string, unknown>): Promise<EventPlatformConfig> {
  try {
    const validatedConfig = await validateSchema(eventPlatformConfigSchema, config);

    // Validate API keys are present for all platforms
    Object.entries(validatedConfig).forEach(([platform, config]) => {
      if (!config.apiKey) {
        throw new Error(`API key is required for ${platform}`);
      }
    });

    return validatedConfig;
  } catch (error) {
    throw error;
  }
}

// Type definitions for configuration objects
export interface ServiceConfig {
  port: number;
  environment: string;
  logLevel: string;
  encryptionKey?: string;
}

export interface PlatformConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

export interface EventPlatformConfig {
  luma: PlatformConfig;
  eventbrite: PlatformConfig;
  partiful: PlatformConfig;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  skipFailedRequests: boolean;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  handler: (req: any, res: any) => void;
}

// Initialize and validate configurations
const config = {
  service: await validateServiceConfig(SERVICE_CONFIG),
  neo4j: neo4jDriver,
  eventPlatforms: await validateEventPlatformConfig(EVENT_PLATFORM_CONFIG),
  rateLimit: await validateSchema(rateLimitConfigSchema, RATE_LIMIT_CONFIG)
};

// Export validated configuration
export { config };

// Export type definitions
export { ServiceConfig, EventPlatformConfig, RateLimitConfig, Neo4jConfig };