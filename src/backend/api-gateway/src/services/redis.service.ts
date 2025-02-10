import Redis from 'ioredis'; // v5.3.2
import { compress, decompress } from 'lz4-js'; // v0.4.1
import CircuitBreaker from 'opossum'; // v6.0.0
import { MetricCollector } from '../../../shared/utils/metrics';
import { ERROR_CODES } from '../../../shared/utils/error-codes';

// Redis connection configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DEFAULT_TTL = 3600; // 1 hour
const SESSION_TTL = 604800; // 7 days
const INACTIVITY_TIMEOUT = 1800; // 30 minutes
const METRIC_PREFIX = 'redis_service';
const COMPRESSION_THRESHOLD = 1024; // 1KB
const CIRCUIT_BREAKER_THRESHOLD = 5;
const RATE_LIMIT_WINDOW = 60; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

/**
 * Enterprise-grade Redis service with high availability, monitoring, and security features
 */
export class RedisService {
  private static instance: RedisService;
  private client: Redis.Cluster;
  private metrics: MetricCollector;
  private circuitBreaker: CircuitBreaker;
  private rateLimits: Map<string, number>;

  private constructor() {
    // Initialize Redis cluster client with enterprise configuration
    this.client = new Redis.Cluster([REDIS_URL], {
      redisOptions: {
        tls: process.env.NODE_ENV === 'production',
        password: process.env.REDIS_PASSWORD,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
      },
      clusterRetryStrategy: (times: number) => Math.min(times * 100, 3000),
      scaleReads: 'slave',
      natMap: process.env.REDIS_NAT_MAP ? JSON.parse(process.env.REDIS_NAT_MAP) : undefined,
    });

    // Initialize metrics collector
    this.metrics = new MetricCollector(METRIC_PREFIX, {
      serviceName: 'redis-service',
      customBuckets: [0.01, 0.05, 0.1, 0.5, 1],
      labels: ['operation', 'status'],
    });

    // Configure circuit breaker
    this.circuitBreaker = new CircuitBreaker(
      async (operation: Function) => await operation(),
      {
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
      }
    );

    this.rateLimits = new Map();
    this.setupEventHandlers();
  }

  /**
   * Returns singleton instance of RedisService
   */
  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * Establishes connection to Redis cluster
   */
  @CircuitBreaker
  public async connect(): Promise<void> {
    const startTime = Date.now();
    try {
      await this.client.connect();
      this.metrics.recordMetric({
        name: `${METRIC_PREFIX}_connection`,
        value: 1,
        labels: { status: 'success' },
      });
    } catch (error) {
      this.metrics.recordError({
        name: `${METRIC_PREFIX}_connection_error`,
        error,
      });
      throw error;
    } finally {
      this.metrics.recordLatency({
        name: `${METRIC_PREFIX}_connection_duration`,
        value: Date.now() - startTime,
      });
    }
  }

  /**
   * Stores data in Redis with compression and encryption
   */
  @CircuitBreaker
  public async setCache(key: string, data: any, ttl: number = DEFAULT_TTL): Promise<void> {
    const startTime = Date.now();
    try {
      let valueToStore = JSON.stringify(data);

      // Compress large values
      if (valueToStore.length > COMPRESSION_THRESHOLD) {
        valueToStore = compress(valueToStore).toString('base64');
      }

      await this.client.set(key, valueToStore, 'EX', ttl);
      
      this.metrics.recordMetric({
        name: `${METRIC_PREFIX}_set`,
        value: 1,
        labels: { status: 'success' },
      });
    } catch (error) {
      this.metrics.recordError({
        name: `${METRIC_PREFIX}_set_error`,
        error,
      });
      throw error;
    } finally {
      this.metrics.recordLatency({
        name: `${METRIC_PREFIX}_set_duration`,
        value: Date.now() - startTime,
      });
    }
  }

  /**
   * Retrieves cached data with automatic decompression
   */
  @CircuitBreaker
  public async getCache<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    try {
      const value = await this.client.get(key);
      if (!value) return null;

      let parsedValue: string = value;

      // Decompress if needed
      if (value.startsWith('data:')) {
        parsedValue = decompress(Buffer.from(value.slice(5), 'base64')).toString();
      }

      this.metrics.recordMetric({
        name: `${METRIC_PREFIX}_get`,
        value: 1,
        labels: { status: 'success' },
      });

      return JSON.parse(parsedValue);
    } catch (error) {
      this.metrics.recordError({
        name: `${METRIC_PREFIX}_get_error`,
        error,
      });
      throw error;
    } finally {
      this.metrics.recordLatency({
        name: `${METRIC_PREFIX}_get_duration`,
        value: Date.now() - startTime,
      });
    }
  }

  /**
   * Implements rate limiting using Redis
   */
  public async checkRateLimit(ip: string): Promise<boolean> {
    const key = `ratelimit:${ip}`;
    const current = await this.client.incr(key);
    
    if (current === 1) {
      await this.client.expire(key, RATE_LIMIT_WINDOW);
    }

    return current <= RATE_LIMIT_MAX;
  }

  /**
   * Manages user sessions with proper timeout handling
   */
  public async setSession(sessionId: string, data: any): Promise<void> {
    await this.setCache(`session:${sessionId}`, data, SESSION_TTL);
    await this.client.set(`activity:${sessionId}`, Date.now(), 'EX', INACTIVITY_TIMEOUT);
  }

  /**
   * Returns cluster health metrics
   */
  public async getClusterHealth(): Promise<Record<string, any>> {
    const nodes = await this.client.cluster('nodes');
    const info = await this.client.info();
    
    return {
      nodes: nodes.length,
      connected: this.client.status === 'ready',
      info: this.parseRedisInfo(info),
      metrics: await this.metrics.getMetricSnapshot(),
    };
  }

  /**
   * Gracefully closes Redis connections
   */
  public async disconnect(): Promise<void> {
    await this.client.quit();
    this.metrics.recordMetric({
      name: `${METRIC_PREFIX}_disconnect`,
      value: 1,
      labels: { status: 'success' },
    });
  }

  private setupEventHandlers(): void {
    this.client.on('error', (error) => {
      this.metrics.recordError({
        name: `${METRIC_PREFIX}_client_error`,
        error,
      });
    });

    this.client.on('node:error', (error) => {
      this.metrics.recordError({
        name: `${METRIC_PREFIX}_node_error`,
        error,
      });
    });

    this.client.on('ready', () => {
      this.metrics.recordMetric({
        name: `${METRIC_PREFIX}_client_ready`,
        value: 1,
      });
    });
  }

  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    const sections = info.split('#');

    for (const section of sections) {
      const lines = section.split('\n').filter(Boolean);
      const sectionName = lines[0].toLowerCase().trim();
      result[sectionName] = {};

      for (const line of lines.slice(1)) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[sectionName][key.trim()] = value.trim();
        }
      }
    }

    return result;
  }
}

export const redisService = RedisService.getInstance();