import { Options } from 'express-rate-limit'; // v6.7.0
import { RedisStore } from 'rate-limit-redis'; // v3.0.0
import CircuitBreaker from 'opossum'; // v6.0.0
import { BaseError } from '@types/node'; // v18.0.0
import { RedisService } from '../services/redis.service';
import { MetricCollector } from '../../../shared/utils/metrics';
import { ERROR_CODES } from '../../../shared/utils/error-codes';

// Constants for rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window
const RATE_LIMIT_WHITELIST = ['127.0.0.1', 'localhost'];
const REDIS_CIRCUIT_BREAKER_OPTIONS = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

// Initialize metric collector for rate limit monitoring
const metricCollector = new MetricCollector('rate_limit', {
  serviceName: 'api-gateway',
  customBuckets: [0.1, 0.5, 1, 2, 5],
  labels: ['status', 'ip']
});

/**
 * Custom error class for rate limit violations
 */
class RateLimitError extends BaseError {
  constructor(message: string, code: string) {
    super(message);
    this.name = 'RateLimitError';
    this.code = code;
  }
}

/**
 * Creates a unique rate limit key for a given IP
 */
function createRateLimitKey(ip: string): string {
  // Validate IP format
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^localhost$/;
  if (!ipRegex.test(ip)) {
    throw new RateLimitError('Invalid IP address format', ERROR_CODES.VALIDATION_ERROR);
  }

  // Check whitelist
  if (RATE_LIMIT_WHITELIST.includes(ip)) {
    return '';
  }

  return `rate-limit:${ip}`;
}

/**
 * Handles rate limit exceeded events
 */
function handleRateLimitExceeded(ip: string): void {
  metricCollector.recordMetricBatch([{
    name: 'rate_limit_exceeded',
    value: 1,
    labels: { status: 'exceeded', ip }
  }]);

  // Log rate limit breach for monitoring
  console.error(`Rate limit exceeded for IP: ${ip}`);
}

// Initialize Redis circuit breaker
const redisCircuitBreaker = new CircuitBreaker(
  async (operation: Function) => await operation(),
  REDIS_CIRCUIT_BREAKER_OPTIONS
);

// Configure Redis store with circuit breaker protection
const redisStore = new RedisStore({
  client: RedisService.getInstance().client,
  prefix: 'rl:',
  resetExpiryOnChange: true,
  sendCommand: async (...args: any[]) => {
    return await redisCircuitBreaker.fire(async () => {
      const result = await RedisService.getInstance().client.send_command(...args);
      return result;
    });
  }
});

/**
 * Enhanced rate limiting configuration with monitoring and circuit breaker
 */
export const rateLimitConfig: Options = {
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: redisStore,
  skip: (req) => RATE_LIMIT_WHITELIST.includes(req.ip),
  handler: (req, res) => {
    handleRateLimitExceeded(req.ip);
    res.status(429).json({
      error: {
        code: ERROR_CODES.RATE_LIMIT_ERROR,
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
      }
    });
  },
  keyGenerator: (req) => createRateLimitKey(req.ip),
  statusCode: 429,
  message: 'Too Many Requests',
  draft_polli: true, // Enable draft RFC compliance
  headers: true,
  requestWasSuccessful: (req, res) => {
    metricCollector.recordMetricBatch([{
      name: 'rate_limit_request',
      value: 1,
      labels: { status: res.statusCode < 400 ? 'success' : 'error', ip: req.ip }
    }]);
    return res.statusCode < 400;
  }
};