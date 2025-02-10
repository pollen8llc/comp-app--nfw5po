import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import newrelic from 'newrelic'; // ^9.0.0
import { ERROR_CODES, BaseError } from '../../shared/utils/error-codes';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

/**
 * Enhanced error handling middleware with security monitoring and APM integration
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate correlation ID for error tracking
  const correlationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Start APM transaction
  const apmTransaction = newrelic.getTransaction();
  apmTransaction?.addAttribute('error_id', correlationId);

  try {
    // Log error with enhanced context
    logger.error(error, {
      correlationId,
      url: req.url,
      method: req.method,
      headers: sanitizeHeaders(req.headers),
      query: req.query,
      body: sanitizeRequestBody(req.body)
    });

    // Track error metrics
    newrelic.incrementMetric('Errors/total');
    newrelic.noticeError(error, {
      correlationId,
      url: req.url,
      method: req.method
    });

    // Check for security-related errors
    if (isSecurityError(error)) {
      logger.security('Security-related error detected', {
        correlationId,
        errorType: error.name,
        ip: req.ip
      });
    }

    let errorResponse: BaseError;

    // Handle different error types
    if (error instanceof BaseError) {
      errorResponse = error;
    } else if (error.name === 'ValidationError') {
      errorResponse = new BaseError(
        ERROR_CODES.VALIDATION_ERROR,
        'Validation failed',
        { details: error.message },
        { severity: 'LOW', component: 'validation' }
      );
    } else if (error.name === 'RateLimitError') {
      errorResponse = new BaseError(
        ERROR_CODES.RATE_LIMIT_ERROR,
        'Rate limit exceeded',
        { retryAfter: 60 },
        { severity: 'MEDIUM', component: 'rate-limiter' }
      );
    } else {
      errorResponse = new BaseError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Internal server error',
        { originalError: process.env.NODE_ENV === 'development' ? error.message : undefined },
        { severity: 'HIGH', component: 'api-gateway' }
      );
    }

    // Add security headers
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-XSS-Protection', '1; mode=block');

    // Add monitoring metadata
    const monitoringMetadata = {
      correlationId,
      timestamp: Date.now(),
      component: 'api-gateway',
      environment: process.env.NODE_ENV
    };

    // Send error response
    if (!res.headersSent) {
      sendError(res, errorResponse, {
        code: errorResponse.code,
        requestId: correlationId,
        source: 'api-gateway',
        ...monitoringMetadata
      });
    }

  } catch (handlingError) {
    // Log error handling failure
    logger.error('Error in error handler', {
      originalError: error,
      handlingError,
      correlationId
    });

    // Send fallback error response
    if (!res.headersSent) {
      sendError(res, new BaseError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Internal server error',
        undefined,
        { severity: 'CRITICAL', component: 'error-handler' }
      ));
    }
  } finally {
    // End APM transaction
    apmTransaction?.end();
  }
}

/**
 * Checks if error is security-related
 */
function isSecurityError(error: Error): boolean {
  const securityErrorTypes = [
    'AuthenticationError',
    'AuthorizationError',
    'TokenError',
    'CSRFError',
    'RateLimitError'
  ];
  return securityErrorTypes.includes(error.name);
}

/**
 * Sanitizes request headers for logging
 */
function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  
  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Sanitizes request body for logging
 */
function sanitizeRequestBody(body: any): any {
  if (!body) return body;

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}