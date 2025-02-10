import { CorsOptions } from 'cors'; // v2.8.5
import { logger } from '../utils/logger';

// Constants for CORS configuration
const ALLOWED_METHODS: string[] = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'OPTIONS'
];

const ALLOWED_HEADERS: string[] = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'X-API-Key'
];

const MAX_AGE_SECONDS: number = 86400; // 24 hours

const CORS_ERROR_MESSAGES = {
  INVALID_ORIGIN: 'Invalid origin format detected',
  MISSING_ORIGINS: 'No valid origins configured',
  VALIDATION_ERROR: 'Origin validation failed'
} as const;

/**
 * Validates individual origin strings against security requirements
 * @param origin - Origin string to validate
 * @returns boolean indicating if origin is valid
 */
const validateOrigin = (origin: string): boolean => {
  try {
    // Check for valid URL format and protocol
    const urlPattern = /^https?:\/\/[\w\-\.]+[\w]+$/;
    if (!urlPattern.test(origin)) {
      logger.warn(`${CORS_ERROR_MESSAGES.INVALID_ORIGIN}: ${origin}`);
      return false;
    }

    // Additional security checks
    const url = new URL(origin);
    
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      logger.warn(`Invalid protocol detected for origin: ${origin}`);
      return false;
    }

    // Validate domain format
    const domainPattern = /^[\w\-\.]+[\w]+$/;
    if (!domainPattern.test(url.hostname)) {
      logger.warn(`Invalid domain format for origin: ${origin}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`${CORS_ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`);
    return false;
  }
};

/**
 * Returns environment-specific CORS origins with validation
 * @returns Array of validated origin strings
 */
const getEnvironmentSpecificOrigins = (): string[] => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  try {
    // Get configured origins from environment
    const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(',')
      .map(origin => origin.trim())
      .filter(origin => validateOrigin(origin)) || [];

    // Apply environment-specific rules
    switch (nodeEnv) {
      case 'production':
        // Ensure at least one valid origin in production
        if (configuredOrigins.length === 0) {
          logger.error(CORS_ERROR_MESSAGES.MISSING_ORIGINS);
          throw new Error(CORS_ERROR_MESSAGES.MISSING_ORIGINS);
        }
        return configuredOrigins;

      case 'staging':
        // Allow staging-specific domains and configured origins
        return [
          ...configuredOrigins,
          'https://staging.communityplatform.com'
        ].filter(validateOrigin);

      case 'development':
      default:
        // Allow localhost and configured origins for development
        return [
          ...configuredOrigins,
          'http://localhost:3000',
          'http://localhost:8000'
        ].filter(validateOrigin);
    }
  } catch (error) {
    logger.error(`CORS configuration error: ${error.message}`);
    // Fallback to localhost only for safety
    return ['http://localhost:3000'];
  }
};

/**
 * CORS configuration with strict security controls
 */
export const corsConfig: CorsOptions = {
  // Validate origins dynamically
  origin: getEnvironmentSpecificOrigins(),
  
  // Allowed HTTP methods
  methods: ALLOWED_METHODS,
  
  // Allowed headers
  allowedHeaders: ALLOWED_HEADERS,
  
  // Allow credentials (cookies, authorization headers)
  credentials: true,
  
  // Cache preflight requests
  maxAge: MAX_AGE_SECONDS,
  
  // Don't pass the OPTIONS request to the handler
  preflightContinue: false,
  
  // Success status for OPTIONS requests
  optionsSuccessStatus: 204
};

// Export constants for testing and external use
export {
  ALLOWED_METHODS,
  ALLOWED_HEADERS,
  MAX_AGE_SECONDS,
  CORS_ERROR_MESSAGES,
  validateOrigin,
  getEnvironmentSpecificOrigins
};