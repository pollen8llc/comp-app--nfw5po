import { Response } from 'express'; // ^4.18.2
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import newrelic from 'newrelic'; // ^9.0.0
import compression from 'compression'; // ^1.7.4
import { ERROR_CODES } from '../../shared/utils/error-codes';
import { logger } from './logger';

// Response metadata interface
interface ResponseMetadata {
  requestId?: string;
  timestamp?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  monitoring?: {
    duration: number;
    complexity?: number;
  };
}

// GraphQL response interface
interface GraphQLResult {
  data?: any;
  errors?: any[];
  extensions?: Record<string, unknown>;
}

// Error metadata interface
interface ErrorMetadata {
  code: ERROR_CODES;
  requestId?: string;
  fields?: Record<string, string[]>;
  retryAfter?: number;
  source?: string;
}

// Validation error interface
interface ValidationErrors {
  [field: string]: string[];
}

// Rate limit information interface
interface RateLimitInfo {
  retryAfter: number;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Sends a successful response with standardized format and monitoring
 */
export function sendSuccess(res: Response, data: any, meta?: ResponseMetadata): void {
  const startTime = Date.now();
  
  try {
    // Sanitize response data
    const sanitizedData = sanitizeResponseData(data);

    // Prepare response object
    const response = {
      success: true,
      data: sanitizedData,
      meta: {
        timestamp: Date.now(),
        ...meta,
        monitoring: {
          ...meta?.monitoring,
          duration: Date.now() - startTime
        }
      }
    };

    // Record response metrics
    newrelic.addCustomAttribute('response_size', JSON.stringify(response).length);
    newrelic.addCustomAttribute('response_time', Date.now() - startTime);

    // Set cache headers if needed
    if (isCacheable(data)) {
      res.set('Cache-Control', 'public, max-age=300');
    }

    // Apply compression for large payloads
    if (JSON.stringify(response).length > 1024) {
      compression()(req, res, () => {
        res.json(response);
      });
    } else {
      res.json(response);
    }

    // Log success
    logger.info('Response sent successfully', { 
      requestId: meta?.requestId,
      duration: Date.now() - startTime 
    });

  } catch (error) {
    logger.error('Error sending success response', error);
    sendError(res, error);
  }
}

/**
 * Sends a GraphQL-specific response with proper formatting
 */
export function sendGraphQLResponse(res: Response, result: GraphQLResult, meta?: ResponseMetadata): void {
  const startTime = Date.now();

  try {
    // Add execution metadata
    const response = {
      ...result,
      extensions: {
        ...result.extensions,
        duration: Date.now() - startTime,
        requestId: meta?.requestId
      }
    };

    // Set GraphQL-specific headers
    res.set('Content-Type', 'application/graphql+json');

    // Handle GraphQL errors if present
    if (result.errors?.length) {
      newrelic.noticeError(new Error('GraphQL errors'), { errors: result.errors });
    }

    res.json(response);

  } catch (error) {
    logger.error('Error sending GraphQL response', error);
    sendError(res, error);
  }
}

/**
 * Sends an error response with enhanced error handling and monitoring
 */
export function sendError(res: Response, error: Error, meta?: ErrorMetadata): void {
  const startTime = Date.now();

  try {
    // Record error in APM
    newrelic.noticeError(error, {
      requestId: meta?.requestId,
      errorCode: meta?.code
    });

    // Prepare error response
    const response = {
      success: false,
      error: {
        code: meta?.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: error.message,
        requestId: meta?.requestId || generateRequestId(),
        timestamp: Date.now()
      }
    };

    // Add field-level errors if present
    if (meta?.fields) {
      response.error['fields'] = meta.fields;
    }

    // Set security headers
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');

    // Send error response
    res.status(getHttpStatus(meta?.code)).json(response);

    // Log error
    logger.error('Error response sent', {
      error,
      meta,
      duration: Date.now() - startTime
    });

  } catch (err) {
    logger.error('Error in error handling', err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'Internal server error'
      }
    });
  }
}

/**
 * Handles validation errors with detailed feedback
 */
export function sendValidationError(res: Response, errors: ValidationErrors): void {
  const meta: ErrorMetadata = {
    code: ERROR_CODES.VALIDATION_ERROR,
    fields: errors,
    requestId: generateRequestId()
  };

  sendError(res, new Error('Validation failed'), meta);
}

/**
 * Handles rate limit exceeded scenarios
 */
export function sendRateLimitError(res: Response, limitInfo: RateLimitInfo): void {
  // Set rate limit headers
  res.set('X-RateLimit-Limit', limitInfo.limit.toString());
  res.set('X-RateLimit-Remaining', limitInfo.remaining.toString());
  res.set('X-RateLimit-Reset', limitInfo.reset.toString());
  res.set('Retry-After', limitInfo.retryAfter.toString());

  const meta: ErrorMetadata = {
    code: ERROR_CODES.RATE_LIMIT_ERROR,
    retryAfter: limitInfo.retryAfter,
    requestId: generateRequestId()
  };

  sendError(res, new Error('Rate limit exceeded'), meta);
}

// Helper function to sanitize response data
function sanitizeResponseData(data: any): any {
  if (!data) return data;

  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  
  if (typeof data === 'object') {
    const sanitized = Array.isArray(data) ? [...data] : { ...data };
    
    for (const key in sanitized) {
      if (sensitiveFields.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeResponseData(sanitized[key]);
      }
    }
    
    return sanitized;
  }
  
  return data;
}

// Helper function to determine if response is cacheable
function isCacheable(data: any): boolean {
  return !data?.hasOwnProperty('timestamp') && 
         !data?.hasOwnProperty('nonce') &&
         !data?.hasOwnProperty('random');
}

// Helper function to generate request ID
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to get HTTP status code
function getHttpStatus(code?: ERROR_CODES): number {
  const statusMap: Record<ERROR_CODES, number> = {
    [ERROR_CODES.VALIDATION_ERROR]: StatusCodes.BAD_REQUEST,
    [ERROR_CODES.AUTHENTICATION_ERROR]: StatusCodes.UNAUTHORIZED,
    [ERROR_CODES.AUTHORIZATION_ERROR]: StatusCodes.FORBIDDEN,
    [ERROR_CODES.RATE_LIMIT_ERROR]: StatusCodes.TOO_MANY_REQUESTS
  };

  return statusMap[code] || StatusCodes.INTERNAL_SERVER_ERROR;
}