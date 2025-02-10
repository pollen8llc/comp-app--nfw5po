import { RedisService } from '../../../backend/api-gateway/src/services/redis.service';
import { TestDatabaseManager } from '../../utils/test-database';
import { faker } from '@faker-js/faker'; // v8.0.0
import { MetricCollector } from '../../../backend/shared/utils/metrics';
import { ERROR_CODES } from '../../../backend/shared/utils/error-codes';

// Test configuration constants
const TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
const TOKEN_LIFETIME_MS = 3600000; // 1 hour
const REFRESH_TOKEN_LIFETIME_MS = 604800000; // 7 days
const INACTIVITY_TIMEOUT_MS = 1800000; // 30 minutes
const PERFORMANCE_THRESHOLD_MS = 2000; // 2 seconds

describe('RedisService Integration Tests', () => {
  let redisService: RedisService;
  let testDbManager: TestDatabaseManager;
  let metricsCollector: MetricCollector;

  beforeAll(async () => {
    // Initialize test database manager with isolated Redis instance
    testDbManager = new TestDatabaseManager({
      redisUrl: TEST_REDIS_URL,
      poolSize: 10,
      timeout: 5000
    });
    await testDbManager.initialize({ clearExisting: true });

    // Initialize Redis service
    redisService = RedisService.getInstance();
    await redisService.connect();

    // Initialize metrics collector for performance monitoring
    metricsCollector = new MetricCollector('redis_integration_test', {
      serviceName: 'redis-test',
      customBuckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
      labels: ['operation', 'status']
    });
  });

  afterAll(async () => {
    // Export test metrics
    const metrics = await metricsCollector.getMetricSnapshot();
    console.log('Test Metrics:', JSON.stringify(metrics, null, 2));

    // Cleanup
    await redisService.disconnect();
    await testDbManager.cleanup({ force: true });
  });

  beforeEach(async () => {
    // Clear Redis cache before each test
    const redisClient = testDbManager.getRedisClient();
    await redisClient.flushdb();
  });

  describe('Cache Operations', () => {
    test('should set and get cached data with performance monitoring', async () => {
      // Generate test data
      const key = `test:${faker.string.uuid()}`;
      const testData = {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        metadata: {
          createdAt: faker.date.past(),
          tags: Array.from({ length: 3 }, () => faker.word.sample())
        }
      };

      const startTime = Date.now();

      // Set cache
      await redisService.setCache(key, testData);

      // Get cache
      const cachedData = await redisService.getCache(key);

      const duration = Date.now() - startTime;

      // Verify data integrity
      expect(cachedData).toEqual(testData);
      
      // Verify performance
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);

      // Record metrics
      metricsCollector.recordMetricBatch([
        {
          name: 'cache_operation_duration',
          value: duration,
          labels: { operation: 'set_get' }
        }
      ]);
    });

    test('should handle cache expiration correctly', async () => {
      const key = `test:${faker.string.uuid()}`;
      const testData = { value: faker.string.sample() };
      
      // Set cache with 1 second TTL
      await redisService.setCache(key, testData, 1);
      
      // Verify immediate retrieval
      let cachedData = await redisService.getCache(key);
      expect(cachedData).toEqual(testData);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Verify data is expired
      cachedData = await redisService.getCache(key);
      expect(cachedData).toBeNull();
    });
  });

  describe('Session Management', () => {
    test('should manage sessions with proper token lifetimes', async () => {
      const sessionId = faker.string.uuid();
      const userData = {
        userId: faker.string.uuid(),
        email: faker.internet.email(),
        roles: ['member']
      };

      // Create session
      await redisService.setSession(sessionId, userData);

      // Verify session data
      const session = await redisService.getCache(`session:${sessionId}`);
      expect(session).toEqual(userData);

      // Verify token expiration
      const redisClient = testDbManager.getRedisClient();
      const ttl = await redisClient.ttl(`session:${sessionId}`);
      
      // Convert TTL to milliseconds and verify it's within expected range
      expect(ttl * 1000).toBeLessThanOrEqual(TOKEN_LIFETIME_MS);
      expect(ttl * 1000).toBeGreaterThan(TOKEN_LIFETIME_MS - 5000);
    });

    test('should handle session inactivity timeout', async () => {
      const sessionId = faker.string.uuid();
      const userData = {
        userId: faker.string.uuid(),
        lastActivity: Date.now()
      };

      // Create session
      await redisService.setSession(sessionId, userData);

      // Update last activity
      await redisService.updateLastActivity(sessionId);

      // Verify activity timestamp
      const activity = await redisService.getCache(`activity:${sessionId}`);
      expect(activity).toBeDefined();

      // Verify inactivity timeout
      const redisClient = testDbManager.getRedisClient();
      const ttl = await redisClient.ttl(`activity:${sessionId}`);
      expect(ttl * 1000).toBeLessThanOrEqual(INACTIVITY_TIMEOUT_MS);
    });
  });

  describe('Performance Requirements', () => {
    test('should handle concurrent operations within performance threshold', async () => {
      const operations = Array.from({ length: 100 }, () => ({
        key: `test:${faker.string.uuid()}`,
        value: {
          data: faker.string.sample(100),
          timestamp: Date.now()
        }
      }));

      const startTime = Date.now();

      // Execute concurrent operations
      await Promise.all(operations.map(async op => {
        await redisService.setCache(op.key, op.value);
        await redisService.getCache(op.key);
      }));

      const duration = Date.now() - startTime;
      const avgOperationTime = duration / (operations.length * 2); // 2 operations per item

      // Record performance metrics
      metricsCollector.recordMetricBatch([
        {
          name: 'concurrent_operations_duration',
          value: duration,
          labels: { operation: 'bulk_set_get' }
        },
        {
          name: 'average_operation_time',
          value: avgOperationTime,
          labels: { operation: 'single_operation' }
        }
      ]);

      // Verify performance requirements
      expect(avgOperationTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });
  });

  describe('Error Handling', () => {
    test('should handle connection failures gracefully', async () => {
      // Force connection failure
      await redisService.disconnect();

      try {
        await redisService.setCache('test', { data: 'test' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).toBeDefined();
        metricsCollector.recordMetricBatch([
          {
            name: 'error_count',
            value: 1,
            labels: { error_type: ERROR_CODES.INTERNAL_SERVER_ERROR }
          }
        ]);
      }

      // Reconnect for subsequent tests
      await redisService.connect();
    });

    test('should handle invalid data gracefully', async () => {
      const key = `test:${faker.string.uuid()}`;
      const circularRef: any = { };
      circularRef.self = circularRef;

      try {
        await redisService.setCache(key, circularRef);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        metricsCollector.recordMetricBatch([
          {
            name: 'error_count',
            value: 1,
            labels: { error_type: ERROR_CODES.VALIDATION_ERROR }
          }
        ]);
      }
    });
  });
});