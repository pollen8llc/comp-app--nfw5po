import { ClerkService } from '../../../backend/api-gateway/src/services/clerk.service';
import { TestUtils } from '../../utils/auth-helpers';
import { UserRole } from '../../../web/src/types/auth';
import { ERROR_CODES } from '../../../backend/shared/utils/error-codes';
import { RedisService } from '../../../backend/api-gateway/src/services/redis.service';
import { MetricCollector } from '../../../backend/shared/utils/metrics';

// Test environment configuration
const TEST_USER = {
  id: 'test-user-123',
  email: 'test@example.com',
  role: UserRole.MEMBER,
  firstName: 'Test',
  lastName: 'User',
  profileImageUrl: 'https://example.com/profile.jpg'
};

describe('ClerkService Integration', () => {
  let clerkService: ClerkService;
  let redisService: RedisService;
  let metricCollector: MetricCollector;

  beforeAll(async () => {
    // Initialize services
    redisService = RedisService.getInstance();
    await redisService.connect();

    metricCollector = new MetricCollector('clerk_test', {
      serviceName: 'auth-test',
      customBuckets: [0.1, 0.5, 1, 2, 5]
    });

    clerkService = new ClerkService(redisService);

    // Set test environment variables
    process.env.CLERK_API_KEY = 'test-api-key';
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    // Cleanup
    await redisService.disconnect();
    delete process.env.CLERK_API_KEY;
    delete process.env.NODE_ENV;
  });

  describe('Token Validation', () => {
    test('should validate a valid JWT token', async () => {
      // Generate valid test token
      const token = TestUtils.generateTestToken({
        id: TEST_USER.id,
        email: TEST_USER.email,
        role: TEST_USER.role
      });

      // Validate token
      const result = await clerkService.validateToken(token);

      // Assert successful validation
      expect(result).toBeDefined();
      expect(result).toHaveProperty('sub', TEST_USER.id);
      expect(result).toHaveProperty('email', TEST_USER.email);
    });

    test('should reject an expired token', async () => {
      // Generate expired token
      const expiredToken = TestUtils.generateExpiredToken({
        id: TEST_USER.id,
        email: TEST_USER.email,
        role: TEST_USER.role
      });

      // Attempt to validate expired token
      await expect(clerkService.validateToken(expiredToken))
        .rejects
        .toThrow(ERROR_CODES.AUTHENTICATION_ERROR);
    });

    test('should reject a malformed token', async () => {
      const malformedToken = 'invalid.token.format';

      await expect(clerkService.validateToken(malformedToken))
        .rejects
        .toThrow(ERROR_CODES.AUTHENTICATION_ERROR);
    });
  });

  describe('Session Management', () => {
    test('should manage concurrent sessions within limits', async () => {
      // Create test session
      const session = TestUtils.createTestSession(TEST_USER);

      // Verify session management
      const result = await clerkService.manageSession(TEST_USER.id, session.token);
      expect(result).toBe(true);

      // Verify session data in Redis
      const sessionData = await redisService.getCache(`session:${session.token}`);
      expect(sessionData).toBeDefined();
      expect(sessionData).toHaveProperty('userId', TEST_USER.id);
    });

    test('should enforce concurrent session limits', async () => {
      // Create maximum allowed sessions
      const sessions = Array.from({ length: 4 }, () => 
        TestUtils.createTestSession(TEST_USER)
      );

      // Add sessions up to limit
      for (let i = 0; i < 3; i++) {
        await clerkService.manageSession(TEST_USER.id, sessions[i].token);
      }

      // Attempt to add session beyond limit
      const result = await clerkService.manageSession(TEST_USER.id, sessions[3].token);
      expect(result).toBe(false);
    });

    test('should handle session timeout', async () => {
      const session = TestUtils.createTestSession(TEST_USER);
      await clerkService.manageSession(TEST_USER.id, session.token);

      // Fast-forward session timeout
      jest.advanceTimersByTime(1800000); // 30 minutes

      // Verify session is invalidated
      const result = await clerkService.manageSession(TEST_USER.id, session.token);
      expect(result).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      const token = TestUtils.generateTestToken({
        id: TEST_USER.id,
        email: TEST_USER.email,
        role: TEST_USER.role
      });

      // Make requests up to limit
      for (let i = 0; i < 100; i++) {
        await clerkService.validateToken(token);
      }

      // Verify rate limit is enforced
      await expect(clerkService.validateToken(token))
        .rejects
        .toThrow(ERROR_CODES.RATE_LIMIT_ERROR);
    });

    test('should reset rate limit after window', async () => {
      const token = TestUtils.generateTestToken({
        id: TEST_USER.id,
        email: TEST_USER.email,
        role: TEST_USER.role
      });

      // Make requests up to limit
      for (let i = 0; i < 100; i++) {
        await clerkService.validateToken(token);
      }

      // Fast-forward rate limit window
      jest.advanceTimersByTime(60000); // 1 minute

      // Verify rate limit is reset
      const result = await clerkService.validateToken(token);
      expect(result).toBeDefined();
    });
  });

  describe('User Profile Operations', () => {
    test('should retrieve user profile', async () => {
      // Mock Clerk API response
      TestUtils.mockClerkAPI({
        id: TEST_USER.id,
        emailAddresses: [{ emailAddress: TEST_USER.email }],
        firstName: TEST_USER.firstName,
        lastName: TEST_USER.lastName,
        imageUrl: TEST_USER.profileImageUrl
      });

      // Get user profile
      const profile = await clerkService.getUser(TEST_USER.id);

      // Verify profile data
      expect(profile).toBeDefined();
      expect(profile).toHaveProperty('email', TEST_USER.email);
      expect(profile).toHaveProperty('firstName', TEST_USER.firstName);
      expect(profile).toHaveProperty('lastName', TEST_USER.lastName);
      expect(profile).toHaveProperty('imageUrl', TEST_USER.profileImageUrl);
    });

    test('should cache user profile data', async () => {
      // Get user profile twice
      await clerkService.getUser(TEST_USER.id);
      const cachedProfile = await clerkService.getUser(TEST_USER.id);

      // Verify profile is cached
      const cacheKey = `user:${TEST_USER.id}`;
      const cachedData = await redisService.getCache(cacheKey);
      expect(cachedData).toBeDefined();
      expect(cachedData).toEqual(cachedProfile);
    });
  });

  describe('Security Constraints', () => {
    test('should handle invalid API key', async () => {
      // Temporarily change API key
      process.env.CLERK_API_KEY = 'invalid-key';
      
      const token = TestUtils.generateTestToken({
        id: TEST_USER.id,
        email: TEST_USER.email,
        role: TEST_USER.role
      });

      await expect(clerkService.validateToken(token))
        .rejects
        .toThrow(ERROR_CODES.AUTHENTICATION_ERROR);

      // Restore API key
      process.env.CLERK_API_KEY = 'test-api-key';
    });

    test('should validate token signature', async () => {
      const token = TestUtils.generateTestToken({
        id: TEST_USER.id,
        email: TEST_USER.email,
        role: TEST_USER.role
      }, { secret: 'wrong-secret' });

      await expect(clerkService.validateToken(token))
        .rejects
        .toThrow(ERROR_CODES.AUTHENTICATION_ERROR);
    });
  });

  describe('Monitoring Integration', () => {
    test('should record authentication metrics', async () => {
      const token = TestUtils.generateTestToken({
        id: TEST_USER.id,
        email: TEST_USER.email,
        role: TEST_USER.role
      });

      await clerkService.validateToken(token);

      const metrics = await metricCollector.getMetricSnapshot();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('clerk_test_auth_attempts_total');
    });

    test('should track error rates', async () => {
      const invalidToken = 'invalid.token';

      try {
        await clerkService.validateToken(invalidToken);
      } catch (error) {
        // Expected error
      }

      const metrics = await metricCollector.getMetricSnapshot();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('clerk_test_errors_total');
    });
  });
});