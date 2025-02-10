import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { z } from 'zod'; // v3.22.0
import winston from 'winston'; // ^3.10.0
import { validateSchema, ValidationError } from '../../shared/utils/validation';
import { sendValidationError } from '../utils/response';
import { metrics } from '../../shared/utils/metrics';

// Constants for validation configuration
const VALIDATION_TIMEOUT = 3000; // 3 seconds
const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB
const CACHE_TTL = 300; // 5 minutes
const CIRCUIT_BREAKER_THRESHOLD = 10;
const CIRCUIT_BREAKER_RESET = 60000; // 1 minute

/**
 * Enum defining valid request parts that can be validated
 */
export enum RequestPart {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params'
}

/**
 * Interface for validation middleware options
 */
export interface ValidationOptions {
  timeout?: number;
  maxSize?: number;
  cacheResults?: boolean;
}

// Schema cache for performance optimization
const schemaCache = new Map<string, z.ZodSchema>();

// Circuit breaker state
let failureCount = 0;
let lastFailureTime = 0;

/**
 * Creates an optimized validation middleware with caching and circuit breaking
 */
export function validateRequest(
  schema: z.ZodSchema,
  part: RequestPart,
  options: ValidationOptions = {}
) {
  // Validate and set default options
  const validationTimeout = options.timeout || VALIDATION_TIMEOUT;
  const maxSize = options.maxSize || MAX_REQUEST_SIZE;
  const shouldCache = options.cacheResults !== false;

  // Cache schema for reuse if enabled
  const schemaKey = `${schema.toString()}-${part}`;
  if (shouldCache && !schemaCache.has(schemaKey)) {
    schemaCache.set(schemaKey, schema);
  }

  // Return middleware function
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    try {
      // Check circuit breaker
      if (isCircuitBreakerOpen()) {
        throw new Error('Validation circuit breaker is open');
      }

      // Check request size
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (contentLength > maxSize) {
        throw new ValidationError('Request size exceeds limit', {
          maxSize,
          actualSize: contentLength
        });
      }

      // Validate content-type for body requests
      if (part === RequestPart.BODY && !req.is('application/json')) {
        throw new ValidationError('Invalid content type', {
          expected: 'application/json',
          received: req.headers['content-type']
        });
      }

      // Get data to validate based on request part
      const data = req[part];

      // Use cached schema if available
      const validationSchema = shouldCache ? 
        schemaCache.get(schemaKey) || schema : 
        schema;

      // Validate with timeout protection
      const validationPromise = validateSchema(validationSchema, data);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Validation timeout')), validationTimeout);
      });

      await Promise.race([validationPromise, timeoutPromise]);

      // Record successful validation
      metrics.recordMetricBatch([{
        name: 'validation_success',
        value: 1,
        labels: { part }
      }, {
        name: 'validation_duration',
        value: Date.now() - startTime,
        labels: { part }
      }]);

      next();
    } catch (error) {
      // Handle validation errors
      handleValidationError(error, req, res, part, startTime);
    }
  };
}

/**
 * Handles validation errors with detailed tracking and circuit breaking
 */
function handleValidationError(
  error: any,
  req: Request,
  res: Response,
  part: RequestPart,
  startTime: number
): void {
  // Update circuit breaker state
  failureCount++;
  lastFailureTime = Date.now();

  // Record validation failure metrics
  metrics.recordMetricBatch([{
    name: 'validation_error',
    value: 1,
    labels: { part, error_type: error.name }
  }, {
    name: 'validation_duration',
    value: Date.now() - startTime,
    labels: { part }
  }]);

  // Log validation failure
  winston.error('Validation error', {
    error: error.message,
    path: req.path,
    part,
    duration: Date.now() - startTime,
    requestId: req.headers['x-request-id']
  });

  // Send appropriate error response
  if (error instanceof ValidationError) {
    sendValidationError(res, error.validationErrors);
  } else {
    sendValidationError(res, {
      _error: error.message || 'Validation failed'
    });
  }
}

/**
 * Checks if circuit breaker is open based on failure threshold
 */
function isCircuitBreakerOpen(): boolean {
  if (failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
    const timeSinceLastFailure = Date.now() - lastFailureTime;
    if (timeSinceLastFailure < CIRCUIT_BREAKER_RESET) {
      return true;
    }
    // Reset circuit breaker after timeout
    failureCount = 0;
  }
  return false;
}