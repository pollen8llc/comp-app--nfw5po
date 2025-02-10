import { jest } from 'jest'; // v29.0.0
import { ERROR_CODES } from '../../backend/shared/utils/error-codes';
import { generateMockMember } from '../utils/mock-data';
import { Member } from '../../backend/shared/types/member.types';

// Constants for mock service configuration
const MOCK_TOKEN_LIFETIME = 3600; // 1 hour in seconds
const MOCK_REFRESH_TOKEN_LIFETIME = 604800; // 7 days in seconds
const MOCK_SESSION_TIMEOUT = 1800; // 30 minutes in seconds
const MOCK_MONITORING_ENABLED = true;

// Types for enhanced type safety
interface TokenPayload {
  sub: string;
  exp: number;
  iat: number;
  sessionId: string;
}

interface ValidationOptions {
  validateExpiration?: boolean;
  validateSignature?: boolean;
  validateSession?: boolean;
}

interface MetricsData {
  requests: number;
  failures: number;
  latency: number[];
  lastUpdated: Date;
}

/**
 * Enhanced mock implementation of Clerk authentication service
 * Provides configurable authentication behaviors and monitoring
 */
export class MockClerkService {
  private mockUsers: Map<string, Member>;
  private mockTokens: Map<string, TokenPayload>;
  private mockSessions: Map<string, { userId: string; lastActivity: Date }>;
  private mockMetrics: Map<string, MetricsData>;
  private monitoringEnabled: boolean;

  constructor(enableMonitoring: boolean = MOCK_MONITORING_ENABLED) {
    this.mockUsers = new Map();
    this.mockTokens = new Map();
    this.mockSessions = new Map();
    this.mockMetrics = new Map();
    this.monitoringEnabled = enableMonitoring;

    // Initialize metrics tracking
    if (this.monitoringEnabled) {
      this.initializeMetrics();
    }
  }

  /**
   * Validates JWT tokens with configurable behavior and monitoring
   */
  async validateToken(token: string, options: ValidationOptions = {}): Promise<TokenPayload> {
    const startTime = Date.now();
    
    try {
      // Record validation attempt
      this.recordMetric('tokenValidation', 'requests');

      // Basic token format validation
      if (!token || !token.includes('.')) {
        throw new Error(ERROR_CODES.AUTHENTICATION_ERROR);
      }

      const tokenPayload = this.mockTokens.get(token);
      if (!tokenPayload) {
        throw new Error(ERROR_CODES.AUTHENTICATION_ERROR);
      }

      // Validate token expiration
      if (options.validateExpiration !== false) {
        const now = Math.floor(Date.now() / 1000);
        if (tokenPayload.exp < now) {
          throw new Error(ERROR_CODES.AUTHENTICATION_ERROR);
        }
      }

      // Validate session if required
      if (options.validateSession !== false) {
        const session = this.mockSessions.get(tokenPayload.sessionId);
        if (!session) {
          throw new Error(ERROR_CODES.AUTHENTICATION_ERROR);
        }

        const sessionAge = Date.now() - session.lastActivity.getTime();
        if (sessionAge > MOCK_SESSION_TIMEOUT * 1000) {
          throw new Error(ERROR_CODES.AUTHENTICATION_ERROR);
        }

        // Update session activity
        session.lastActivity = new Date();
        this.mockSessions.set(tokenPayload.sessionId, session);
      }

      // Record successful validation
      this.recordMetric('tokenValidation', 'success');
      this.recordLatency('tokenValidation', Date.now() - startTime);

      return tokenPayload;

    } catch (error) {
      // Record validation failure
      this.recordMetric('tokenValidation', 'failures');
      this.recordLatency('tokenValidation', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Creates a mock user session with monitoring
   */
  async createSession(userId: string): Promise<{ token: string; sessionId: string }> {
    const startTime = Date.now();
    
    try {
      // Record session creation attempt
      this.recordMetric('sessionCreation', 'requests');

      const sessionId = Math.random().toString(36).substring(7);
      const token = Math.random().toString(36).substring(7);

      const tokenPayload: TokenPayload = {
        sub: userId,
        exp: Math.floor(Date.now() / 1000) + MOCK_TOKEN_LIFETIME,
        iat: Math.floor(Date.now() / 1000),
        sessionId
      };

      this.mockTokens.set(token, tokenPayload);
      this.mockSessions.set(sessionId, {
        userId,
        lastActivity: new Date()
      });

      // Record successful session creation
      this.recordMetric('sessionCreation', 'success');
      this.recordLatency('sessionCreation', Date.now() - startTime);

      return { token, sessionId };

    } catch (error) {
      // Record session creation failure
      this.recordMetric('sessionCreation', 'failures');
      this.recordLatency('sessionCreation', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Retrieves monitoring metrics
   */
  getMetrics(): Record<string, MetricsData> {
    return Object.fromEntries(this.mockMetrics);
  }

  private initializeMetrics(): void {
    const defaultMetrics: MetricsData = {
      requests: 0,
      failures: 0,
      latency: [],
      lastUpdated: new Date()
    };

    this.mockMetrics.set('tokenValidation', { ...defaultMetrics });
    this.mockMetrics.set('sessionCreation', { ...defaultMetrics });
  }

  private recordMetric(operation: string, metricType: 'requests' | 'failures' | 'success'): void {
    if (!this.monitoringEnabled) return;

    const metrics = this.mockMetrics.get(operation) || {
      requests: 0,
      failures: 0,
      latency: [],
      lastUpdated: new Date()
    };

    if (metricType === 'requests') metrics.requests++;
    if (metricType === 'failures') metrics.failures++;
    metrics.lastUpdated = new Date();

    this.mockMetrics.set(operation, metrics);
  }

  private recordLatency(operation: string, latency: number): void {
    if (!this.monitoringEnabled) return;

    const metrics = this.mockMetrics.get(operation);
    if (metrics) {
      metrics.latency.push(latency);
      metrics.lastUpdated = new Date();
      this.mockMetrics.set(operation, metrics);
    }
  }
}

/**
 * Enhanced mock implementation of Redis caching service
 * Provides TTL support and monitoring capabilities
 */
export class MockRedisService {
  private mockCache: Map<string, any>;
  private mockExpiration: Map<string, number>;
  private mockMetrics: Map<string, MetricsData>;
  private monitoringEnabled: boolean;

  constructor(enableMonitoring: boolean = MOCK_MONITORING_ENABLED) {
    this.mockCache = new Map();
    this.mockExpiration = new Map();
    this.mockMetrics = new Map();
    this.monitoringEnabled = enableMonitoring;

    if (this.monitoringEnabled) {
      this.initializeMetrics();
    }
  }

  /**
   * Sets cache data with TTL support and monitoring
   */
  async setCache<T>(key: string, data: T, ttl?: number): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Record cache operation attempt
      this.recordMetric('cacheSet', 'requests');

      this.mockCache.set(key, data);

      if (ttl) {
        this.mockExpiration.set(key, Date.now() + (ttl * 1000));
        setTimeout(() => {
          this.mockCache.delete(key);
          this.mockExpiration.delete(key);
        }, ttl * 1000);
      }

      // Record successful cache operation
      this.recordMetric('cacheSet', 'success');
      this.recordLatency('cacheSet', Date.now() - startTime);

    } catch (error) {
      // Record cache operation failure
      this.recordMetric('cacheSet', 'failures');
      this.recordLatency('cacheSet', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Retrieves cached data with TTL validation
   */
  async getCache<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      // Record cache retrieval attempt
      this.recordMetric('cacheGet', 'requests');

      const expiration = this.mockExpiration.get(key);
      if (expiration && Date.now() > expiration) {
        this.mockCache.delete(key);
        this.mockExpiration.delete(key);
        return null;
      }

      const data = this.mockCache.get(key) as T;

      // Record successful cache retrieval
      this.recordMetric('cacheGet', 'success');
      this.recordLatency('cacheGet', Date.now() - startTime);

      return data || null;

    } catch (error) {
      // Record cache retrieval failure
      this.recordMetric('cacheGet', 'failures');
      this.recordLatency('cacheGet', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Retrieves monitoring metrics
   */
  getMetrics(): Record<string, MetricsData> {
    return Object.fromEntries(this.mockMetrics);
  }

  private initializeMetrics(): void {
    const defaultMetrics: MetricsData = {
      requests: 0,
      failures: 0,
      latency: [],
      lastUpdated: new Date()
    };

    this.mockMetrics.set('cacheSet', { ...defaultMetrics });
    this.mockMetrics.set('cacheGet', { ...defaultMetrics });
  }

  private recordMetric(operation: string, metricType: 'requests' | 'failures' | 'success'): void {
    if (!this.monitoringEnabled) return;

    const metrics = this.mockMetrics.get(operation) || {
      requests: 0,
      failures: 0,
      latency: [],
      lastUpdated: new Date()
    };

    if (metricType === 'requests') metrics.requests++;
    if (metricType === 'failures') metrics.failures++;
    metrics.lastUpdated = new Date();

    this.mockMetrics.set(operation, metrics);
  }

  private recordLatency(operation: string, latency: number): void {
    if (!this.monitoringEnabled) return;

    const metrics = this.mockMetrics.get(operation);
    if (metrics) {
      metrics.latency.push(latency);
      metrics.lastUpdated = new Date();
      this.mockMetrics.set(operation, metrics);
    }
  }
}