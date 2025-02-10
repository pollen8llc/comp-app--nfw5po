import { StatusCodes as HttpStatusCode } from 'http-status-codes'; // v1.2.0

// Comprehensive error code enumeration
export enum ERROR_CODES {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  GRAPH_QUERY_ERROR = 'GRAPH_QUERY_ERROR',
  EVENT_IMPORT_ERROR = 'EVENT_IMPORT_ERROR',
  ENTITY_RESOLUTION_ERROR = 'ENTITY_RESOLUTION_ERROR',
  TDA_COMPUTATION_ERROR = 'TDA_COMPUTATION_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

// Error severity levels
enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Monitoring context interface
interface MonitoringContext {
  service?: string;
  component?: string;
  severity?: ErrorSeverity;
  additionalMetadata?: Record<string, unknown>;
}

// Base error class with enhanced monitoring capabilities
export class BaseError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;
  public readonly requestId: string;
  public readonly timestamp: number;
  public readonly service: string;
  public readonly component: string;
  public readonly severity: ErrorSeverity;
  public readonly monitoringMetadata: Record<string, unknown>;

  constructor(
    code: ERROR_CODES,
    message: string,
    details?: Record<string, unknown>,
    monitoringContext?: MonitoringContext
  ) {
    super(message);
    
    // Basic error properties
    this.code = code;
    this.details = details;
    this.httpStatus = getHttpStatus(code);
    
    // Monitoring and tracing data
    this.timestamp = Date.now();
    this.requestId = generateRequestId();
    
    // Monitoring context
    this.service = monitoringContext?.service || 'unknown';
    this.component = monitoringContext?.component || 'unknown';
    this.severity = monitoringContext?.severity || getSeverityForError(code);
    
    // Preserve stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Additional monitoring metadata
    this.monitoringMetadata = {
      environment: process.env.NODE_ENV,
      errorCode: code,
      ...monitoringContext?.additionalMetadata
    };
  }
}

// Maps error codes to HTTP status codes with monitoring support
export function getHttpStatus(errorCode: ERROR_CODES): number {
  const statusCodeMap: Record<ERROR_CODES, number> = {
    [ERROR_CODES.VALIDATION_ERROR]: HttpStatusCode.BAD_REQUEST,
    [ERROR_CODES.AUTHENTICATION_ERROR]: HttpStatusCode.UNAUTHORIZED,
    [ERROR_CODES.AUTHORIZATION_ERROR]: HttpStatusCode.FORBIDDEN,
    [ERROR_CODES.NOT_FOUND_ERROR]: HttpStatusCode.NOT_FOUND,
    [ERROR_CODES.RATE_LIMIT_ERROR]: HttpStatusCode.TOO_MANY_REQUESTS,
    [ERROR_CODES.GRAPH_QUERY_ERROR]: HttpStatusCode.BAD_REQUEST,
    [ERROR_CODES.EVENT_IMPORT_ERROR]: HttpStatusCode.BAD_REQUEST,
    [ERROR_CODES.ENTITY_RESOLUTION_ERROR]: HttpStatusCode.BAD_REQUEST,
    [ERROR_CODES.TDA_COMPUTATION_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
    [ERROR_CODES.INTERNAL_SERVER_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR
  };

  // Log error code mapping for monitoring
  logErrorCodeMapping(errorCode, statusCodeMap[errorCode]);

  return statusCodeMap[errorCode] || HttpStatusCode.INTERNAL_SERVER_ERROR;
}

// Formats error details into standardized response structure
export function formatErrorResponse(error: BaseError): Record<string, unknown> {
  const response = {
    error: {
      code: error.code,
      message: error.message,
      httpStatus: error.httpStatus,
      requestId: error.requestId,
      timestamp: error.timestamp,
      service: error.service,
      component: error.component,
      severity: error.severity
    }
  };

  // Include error details if available
  if (error.details) {
    response.error = { ...response.error, details: error.details };
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error = { ...response.error, stack: error.stack };
  }

  // Sanitize sensitive information
  return sanitizeErrorResponse(response);
}

// Helper function to generate unique request IDs
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to determine error severity
function getSeverityForError(code: ERROR_CODES): ErrorSeverity {
  const severityMap: Record<ERROR_CODES, ErrorSeverity> = {
    [ERROR_CODES.VALIDATION_ERROR]: ErrorSeverity.LOW,
    [ERROR_CODES.AUTHENTICATION_ERROR]: ErrorSeverity.MEDIUM,
    [ERROR_CODES.AUTHORIZATION_ERROR]: ErrorSeverity.MEDIUM,
    [ERROR_CODES.NOT_FOUND_ERROR]: ErrorSeverity.LOW,
    [ERROR_CODES.RATE_LIMIT_ERROR]: ErrorSeverity.MEDIUM,
    [ERROR_CODES.GRAPH_QUERY_ERROR]: ErrorSeverity.HIGH,
    [ERROR_CODES.EVENT_IMPORT_ERROR]: ErrorSeverity.HIGH,
    [ERROR_CODES.ENTITY_RESOLUTION_ERROR]: ErrorSeverity.HIGH,
    [ERROR_CODES.TDA_COMPUTATION_ERROR]: ErrorSeverity.HIGH,
    [ERROR_CODES.INTERNAL_SERVER_ERROR]: ErrorSeverity.CRITICAL
  };

  return severityMap[code] || ErrorSeverity.HIGH;
}

// Helper function to log error code mappings for monitoring
function logErrorCodeMapping(errorCode: ERROR_CODES, httpStatus: number): void {
  // Implementation would integrate with your monitoring solution
  console.log(`Error code ${errorCode} mapped to HTTP status ${httpStatus}`);
}

// Helper function to sanitize error responses
function sanitizeErrorResponse(response: Record<string, unknown>): Record<string, unknown> {
  // Deep clone to avoid modifying original
  const sanitized = JSON.parse(JSON.stringify(response));
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  
  function sanitizeObject(obj: Record<string, unknown>): void {
    for (const key in obj) {
      if (sensitiveFields.includes(key.toLowerCase())) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key] as Record<string, unknown>);
      }
    }
  }

  sanitizeObject(sanitized);
  return sanitized;
}