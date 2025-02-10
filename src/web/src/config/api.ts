import { z } from 'zod'; // v3.0.0
import { ServiceEndpoints } from '../types/api';

// Global constants for API configuration
const API_VERSION = 'v1';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RATE_LIMIT_REQUESTS = 1000; // requests per hour
const RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds

/**
 * Interface for service-specific configuration
 */
interface ServiceConfig {
  url: string;
  timeout: number;
  maxRetries: number;
  enableCache: boolean;
  cacheDuration: number;
  rateLimiting: {
    enabled: boolean;
    requestsPerHour: number;
    windowMs: number;
  };
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeout: number;
  };
  security: {
    enableHMACSignature: boolean;
    signatureHeader: string;
    clerkAuth: {
      required: boolean;
      audience: string;
    };
  };
}

/**
 * Rate limiting configuration interface
 */
interface RateLimitConfig {
  requestsPerHour: number;
  windowMs: number;
  enabled: boolean;
}

/**
 * Security configuration interface
 */
interface SecurityConfig {
  enableHMACSignature: boolean;
  signatureHeader: string;
  clerkAuth: {
    required: boolean;
    audience: string;
    issuer: string;
  };
}

/**
 * Constructs the complete service URL based on environment and endpoint
 */
const getServiceUrl = (endpoint: ServiceEndpoints, environment: string): string => {
  const baseUrl = environment === 'production'
    ? 'https://api.communityplatform.com'
    : environment === 'staging'
      ? 'https://staging-api.communityplatform.com'
      : 'http://localhost:3000';

  return `${baseUrl}/${API_VERSION}${endpoint}`;
};

/**
 * Main API configuration object
 */
export const apiConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
  version: API_VERSION,
  timeout: DEFAULT_TIMEOUT,
  maxRetries: MAX_RETRIES,
  endpoints: {
    [ServiceEndpoints.MEMBER]: '/members',
    [ServiceEndpoints.EVENT]: '/events',
    [ServiceEndpoints.ANALYTICS]: '/analytics'
  },
  security: {
    enableHMACSignature: true,
    signatureHeader: 'X-Request-Signature',
    clerkAuth: {
      required: true,
      audience: process.env.NEXT_PUBLIC_CLERK_AUDIENCE || 'community-platform',
      issuer: process.env.NEXT_PUBLIC_CLERK_ISSUER || 'https://clerk.community-platform.com'
    }
  },
  rateLimiting: {
    enabled: true,
    requestsPerHour: RATE_LIMIT_REQUESTS,
    windowMs: RATE_LIMIT_WINDOW
  }
} as const;

/**
 * Service-specific configuration settings
 */
export const serviceConfig: Record<ServiceEndpoints, ServiceConfig> = {
  [ServiceEndpoints.MEMBER]: {
    url: getServiceUrl(ServiceEndpoints.MEMBER, process.env.NODE_ENV || 'development'),
    timeout: DEFAULT_TIMEOUT,
    maxRetries: MAX_RETRIES,
    enableCache: true,
    cacheDuration: 300000, // 5 minutes
    rateLimiting: {
      enabled: true,
      requestsPerHour: RATE_LIMIT_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      resetTimeout: 30000
    },
    security: {
      enableHMACSignature: true,
      signatureHeader: 'X-Member-Service-Signature',
      clerkAuth: {
        required: true,
        audience: 'member-service'
      }
    }
  },
  [ServiceEndpoints.EVENT]: {
    url: getServiceUrl(ServiceEndpoints.EVENT, process.env.NODE_ENV || 'development'),
    timeout: 45000, // Extended timeout for event operations
    maxRetries: MAX_RETRIES,
    enableCache: true,
    cacheDuration: 600000, // 10 minutes
    rateLimiting: {
      enabled: true,
      requestsPerHour: RATE_LIMIT_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      resetTimeout: 30000
    },
    security: {
      enableHMACSignature: true,
      signatureHeader: 'X-Event-Service-Signature',
      clerkAuth: {
        required: true,
        audience: 'event-service'
      }
    }
  },
  [ServiceEndpoints.ANALYTICS]: {
    url: getServiceUrl(ServiceEndpoints.ANALYTICS, process.env.NODE_ENV || 'development'),
    timeout: 60000, // Extended timeout for analytics operations
    maxRetries: 2, // Reduced retries for analytics
    enableCache: true,
    cacheDuration: 1800000, // 30 minutes
    rateLimiting: {
      enabled: true,
      requestsPerHour: 100, // Reduced rate limit for analytics
      windowMs: RATE_LIMIT_WINDOW
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 3,
      resetTimeout: 60000
    },
    security: {
      enableHMACSignature: true,
      signatureHeader: 'X-Analytics-Service-Signature',
      clerkAuth: {
        required: true,
        audience: 'analytics-service'
      }
    }
  }
};

/**
 * Zod schema for API configuration validation
 */
export const configSchema = {
  apiConfigSchema: z.object({
    baseURL: z.string().url(),
    version: z.string(),
    timeout: z.number().min(1000).max(60000),
    maxRetries: z.number().min(0).max(5),
    endpoints: z.record(z.string()),
    security: z.object({
      enableHMACSignature: z.boolean(),
      signatureHeader: z.string(),
      clerkAuth: z.object({
        required: z.boolean(),
        audience: z.string(),
        issuer: z.string()
      })
    }),
    rateLimiting: z.object({
      enabled: z.boolean(),
      requestsPerHour: z.number().min(1),
      windowMs: z.number().min(1000)
    })
  }),
  serviceConfigSchema: z.object({
    url: z.string().url(),
    timeout: z.number().min(1000).max(60000),
    maxRetries: z.number().min(0).max(5),
    enableCache: z.boolean(),
    cacheDuration: z.number().min(1000),
    rateLimiting: z.object({
      enabled: z.boolean(),
      requestsPerHour: z.number().min(1),
      windowMs: z.number().min(1000)
    }),
    circuitBreaker: z.object({
      enabled: z.boolean(),
      failureThreshold: z.number().min(1),
      resetTimeout: z.number().min(1000)
    }),
    security: z.object({
      enableHMACSignature: z.boolean(),
      signatureHeader: z.string(),
      clerkAuth: z.object({
        required: z.boolean(),
        audience: z.string()
      })
    })
  })
};

/**
 * Validates configuration against schema
 */
const validateConfig = (config: unknown, schema: z.ZodSchema): boolean => {
  try {
    schema.parse(config);
    return true;
  } catch (error) {
    console.error('Configuration validation failed:', error);
    return false;
  }
};

// Validate configurations on initialization
validateConfig(apiConfig, configSchema.apiConfigSchema);
Object.values(serviceConfig).forEach(config => 
  validateConfig(config, configSchema.serviceConfigSchema)
);