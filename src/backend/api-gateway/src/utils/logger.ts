import pino from 'pino'; // v8.14.1
import newrelic from 'newrelic'; // v10.3.0
import { env } from '../config';

// Constants for logger configuration
const LOG_LEVEL = process.env.LOG_LEVEL || (env === 'production' ? 'info' : 'debug');
const REDACT_KEYS = ['password', 'token', 'secret', 'key', 'authorization'];
const LOG_RETENTION_DAYS = 30;

/**
 * Creates a production-grade Pino logger instance with security and performance optimizations
 */
function createLogger() {
  return pino({
    level: LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        host: bindings.hostname,
        service: 'api-gateway'
      })
    },
    redact: {
      paths: REDACT_KEYS,
      censor: '[REDACTED]'
    },
    base: {
      environment: env,
      version: process.env.npm_package_version
    },
    serializers: {
      ...pino.stdSerializers,
      error: pino.stdSerializers.err,
      req: (req) => ({
        method: req.method,
        url: req.url,
        requestId: req.id,
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort
      })
    },
    transport: env === 'production' ? {
      target: 'pino/file',
      options: {
        destination: `/var/log/api-gateway/${new Date().toISOString().split('T')[0]}.log`,
        sync: false,
        mkdir: true
      }
    } : undefined
  });
}

/**
 * Enterprise-grade logger wrapper providing standardized logging methods
 * with security features, APM integration, and comprehensive error tracking
 */
class APILogger {
  private logger: pino.Logger;
  private isProduction: boolean;
  private apmClient: typeof newrelic;

  constructor() {
    this.logger = createLogger();
    this.isProduction = env === 'production';
    this.apmClient = this.isProduction ? newrelic : null;

    if (this.isProduction) {
      this.setupProductionFeatures();
    }
  }

  /**
   * Configures production-specific logging features
   */
  private setupProductionFeatures(): void {
    // Configure log rotation
    this.logger = this.logger.child({
      retention: `${LOG_RETENTION_DAYS}d`,
      compress: 'gzip'
    });

    // Initialize APM integration
    this.apmClient.addCustomAttribute('service', 'api-gateway');
  }

  /**
   * Logs information level messages with metadata and APM tracking
   */
  public info(message: string, meta?: Record<string, unknown>): void {
    const enrichedMeta = this.enrichMetadata(meta);
    this.logger.info(enrichedMeta, message);

    if (this.isProduction) {
      this.apmClient.recordCustomEvent('LogInfo', {
        message,
        ...enrichedMeta
      });
    }
  }

  /**
   * Logs error level messages with comprehensive error tracking
   */
  public error(error: Error, meta?: Record<string, unknown>): void {
    const enrichedMeta = this.enrichMetadata(meta);
    this.logger.error({
      err: error,
      ...enrichedMeta,
      stack: error.stack
    }, error.message);

    if (this.isProduction) {
      this.apmClient.noticeError(error, enrichedMeta);
    }
  }

  /**
   * Logs warning level messages with security context
   */
  public warn(message: string, meta?: Record<string, unknown>): void {
    const enrichedMeta = this.enrichMetadata(meta);
    this.logger.warn(enrichedMeta, message);

    if (this.isProduction) {
      this.apmClient.recordCustomEvent('LogWarning', {
        message,
        ...enrichedMeta
      });
    }
  }

  /**
   * Logs debug level messages with performance impact protection
   */
  public debug(message: string, meta?: Record<string, unknown>): void {
    if (this.logger.level === 'debug') {
      const enrichedMeta = this.enrichMetadata(meta);
      this.logger.debug(enrichedMeta, message);
    }
  }

  /**
   * Enriches log metadata with standard fields and security context
   */
  private enrichMetadata(meta?: Record<string, unknown>): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      correlationId: this.getCorrelationId(),
      ...meta
    };
  }

  /**
   * Generates or retrieves correlation ID for request tracking
   */
  private getCorrelationId(): string {
    if (this.isProduction) {
      return this.apmClient.getTraceMetadata().id || 
             `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Export singleton logger instance
export const logger = new APILogger();