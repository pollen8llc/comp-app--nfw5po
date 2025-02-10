import { config as dotenv } from 'dotenv'; // v16.0.3
import { cleanEnv, str, port, url } from 'envalid'; // v7.3.1
import helmet from 'helmet'; // v6.0.0
import { corsConfig } from './cors';
import { rateLimitConfig } from './rate-limit';
import { MetricCollector } from '../../../shared/utils/metrics';
import { ERROR_CODES } from '../../../shared/utils/error-codes';

// Load environment variables
dotenv();

// Required environment variables with validation
const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'PORT',
  'CLERK_API_KEY',
  'REDIS_URL',
  'ALLOWED_ORIGINS',
  'JWT_SECRET',
  'RATE_LIMIT_SECRET',
  'HMAC_SECRET'
] as const;

// Initialize metrics collector
const metricCollector = new MetricCollector('api_gateway', {
  serviceName: 'api-gateway',
  customBuckets: [0.1, 0.5, 1, 2, 5],
  labels: ['endpoint', 'status']
});

/**
 * Validates environment variables with type checking
 */
function validateEnvironment() {
  return cleanEnv(process.env, {
    NODE_ENV: str({ choices: ['development', 'staging', 'production'] }),
    PORT: port({ default: 3000 }),
    API_VERSION: str({ default: 'v1' }),
    CLERK_API_KEY: str(),
    REDIS_URL: url(),
    ALLOWED_ORIGINS: str(),
    JWT_SECRET: str({ length: 32 }),
    RATE_LIMIT_SECRET: str({ length: 32 }),
    HMAC_SECRET: str({ length: 32 })
  });
}

/**
 * Validates configuration object for security and consistency
 */
function validateConfiguration(config: Record<string, unknown>): boolean {
  try {
    // Validate security settings
    if (!config.security?.helmet || !config.security?.cors) {
      throw new Error('Missing required security configurations');
    }

    // Validate rate limiting
    if (!config.rateLimit?.windowMs || !config.rateLimit?.max) {
      throw new Error('Invalid rate limit configuration');
    }

    // Validate monitoring settings
    if (!config.monitoring?.enabled) {
      throw new Error('Monitoring must be enabled');
    }

    return true;
  } catch (error) {
    metricCollector.recordMetricBatch([{
      name: 'config_validation_error',
      value: 1,
      labels: { error_type: ERROR_CODES.VALIDATION_ERROR }
    }]);
    throw error;
  }
}

// Enhanced security headers configuration
const securityConfig = {
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.clerk.dev'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }
};

// Monitoring configuration
const monitoringConfig = {
  enabled: true,
  metrics: {
    collectDefault: true,
    prefix: 'api_gateway',
    defaultLabels: {
      service: 'api-gateway',
      environment: process.env.NODE_ENV
    }
  },
  tracing: {
    enabled: true,
    sampleRate: 0.1
  }
};

// Circuit breaker configuration
const circuitBreakerConfig = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  monitoring: {
    enabled: true,
    metrics: ['failures', 'successes', 'fallbacks', 'rejects']
  }
};

// Validate environment and create configuration
const env = validateEnvironment();

// Export comprehensive configuration object
export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  apiVersion: env.API_VERSION,
  security: {
    ...securityConfig,
    cors: corsConfig
  },
  rateLimit: rateLimitConfig,
  monitoring: monitoringConfig,
  circuitBreaker: circuitBreakerConfig,
  clerk: {
    apiKey: env.CLERK_API_KEY,
    webhookSecret: env.CLERK_WEBHOOK_SECRET
  },
  redis: {
    url: env.REDIS_URL,
    prefix: 'api-gateway:'
  }
};

// Validate final configuration
validateConfiguration(config);

// Export configuration and validation functions
export {
  validateEnvironment,
  validateConfiguration,
  REQUIRED_ENV_VARS,
  metricCollector
};