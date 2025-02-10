import { jest } from 'jest'; // ^29.0.0
import {
  setupTestDatabase,
  createTestClient,
  expectGraphStructure,
  expectResponseTime
} from '../../utils/test-helpers';
import { generateMockMember } from '../../utils/mock-data';
import { TestAPIClient } from '../../utils/api-client';
import { HttpStatus, ErrorCode } from '../../../web/src/types/api';
import { Member, Profile, SocialProfile } from '../../../web/src/types/members';
import { DataClassification } from '../../../backend/shared/types/member.types';

// Test timeout configuration
jest.setTimeout(30000);

describe('Member Service Integration Tests', () => {
  let apiClient: TestAPIClient;
  let entityResolutionAccuracy: number = 0;
  let totalResolutionAttempts: number = 0;

  beforeAll(async () => {
    // Initialize test environment
    await setupTestDatabase({
      transactional: true,
      parallel: false,
      timeout: 30000
    });

    // Create authenticated test client
    apiClient = await createTestClient({
      auth: true,
      caching: false
    });
  });

  beforeEach(async () => {
    // Reset test state
    entityResolutionAccuracy = 0;
    totalResolutionAttempts = 0;
  });

  afterAll(async () => {
    // Clean up test environment
    await apiClient.post('/api/v1/system/cleanup', {});
  });

  describe('Member Creation and Management', () => {
    test('should create member with encrypted PII and validate response time', async () => {
      // Generate test member data
      const mockMember = generateMockMember({
        profile: {
          name: 'Test User',
          email: 'test@example.com',
          location: 'San Francisco',
          role: 'MEMBER'
        }
      });

      const startTime = Date.now();

      // Create member
      const response = await apiClient.post('/api/v1/members', mockMember);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Validate response
      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.data).toBeDefined();
      expect(response.data.id).toBeDefined();

      // Verify PII encryption
      const storedMember = await apiClient.get(`/api/v1/members/${response.data.id}`);
      expect(storedMember.data.profile.email).not.toBe(mockMember.profile.email);
      
      // Assert response time requirement
      expectResponseTime(responseTime, 2000); // 2 second requirement

      // Verify audit log
      const auditLog = await apiClient.get(`/api/v1/audit/members/${response.data.id}`);
      expect(auditLog.data).toContainEqual(
        expect.objectContaining({
          action: 'CREATE',
          resource: 'MEMBER',
          resourceId: response.data.id
        })
      );
    });

    test('should enforce rate limiting on member creation', async () => {
      const requests = Array(20).fill(null).map(() => 
        apiClient.post('/api/v1/members', generateMockMember())
      );

      const results = await Promise.allSettled(requests);
      const rateLimited = results.filter(r => 
        r.status === 'rejected' && 
        (r.reason as any).status === HttpStatus.TOO_MANY_REQUESTS
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Entity Resolution', () => {
    test('should achieve 95% accuracy in entity disambiguation', async () => {
      // Generate test cases with varying similarity
      const testCases = [
        // Exact match
        {
          source: generateMockMember({
            profile: { email: 'john.doe@example.com', name: 'John Doe' }
          }),
          target: generateMockMember({
            profile: { email: 'john.doe@example.com', name: 'John Doe' }
          }),
          shouldMatch: true
        },
        // Similar names, different email
        {
          source: generateMockMember({
            profile: { email: 'john.d@example.com', name: 'John Doe' }
          }),
          target: generateMockMember({
            profile: { email: 'johndoe@example.com', name: 'John Doe' }
          }),
          shouldMatch: true
        },
        // Different person
        {
          source: generateMockMember({
            profile: { email: 'jane.doe@example.com', name: 'Jane Doe' }
          }),
          target: generateMockMember({
            profile: { email: 'john.doe@example.com', name: 'John Doe' }
          }),
          shouldMatch: false
        }
      ];

      for (const testCase of testCases) {
        // Create test members
        const source = await apiClient.post('/api/v1/members', testCase.source);
        const target = await apiClient.post('/api/v1/members', testCase.target);

        // Trigger entity resolution
        const resolution = await apiClient.post('/api/v1/members/resolve', {
          sourceId: source.data.id,
          targetId: target.data.id
        });

        totalResolutionAttempts++;
        if (resolution.data.matched === testCase.shouldMatch) {
          entityResolutionAccuracy++;
        }
      }

      const accuracyRate = entityResolutionAccuracy / totalResolutionAttempts;
      expect(accuracyRate).toBeGreaterThanOrEqual(0.95); // 95% accuracy requirement
    });

    test('should handle edge cases in entity resolution', async () => {
      // Test partial matches
      const partialMatch = {
        source: generateMockMember({
          profile: { email: 'j.doe@example.com', name: 'J Doe' }
        }),
        target: generateMockMember({
          profile: { email: 'john.doe@example.com', name: 'John Doe' }
        })
      };

      const resolution = await apiClient.post('/api/v1/members/resolve', {
        sourceId: (await apiClient.post('/api/v1/members', partialMatch.source)).data.id,
        targetId: (await apiClient.post('/api/v1/members', partialMatch.target)).data.id
      });

      expect(resolution.data.confidence).toBeDefined();
      expect(resolution.data.matchedFields).toBeDefined();
    });
  });

  describe('Member Data Security', () => {
    test('should enforce field-level encryption and access control', async () => {
      const sensitiveData: Member = generateMockMember({
        profile: {
          name: 'Secure User',
          email: 'secure@example.com',
          location: 'Private Location',
          role: 'MEMBER'
        },
        socialProfiles: [{
          platform: 'LINKEDIN',
          externalId: '12345',
          verified: true,
          lastSynced: new Date()
        }]
      });

      // Create member with sensitive data
      const created = await apiClient.post('/api/v1/members', sensitiveData);
      expect(created.status).toBe(HttpStatus.CREATED);

      // Verify PII fields are encrypted
      const stored = await apiClient.get(`/api/v1/members/${created.data.id}`);
      expect(stored.data.profile.email).not.toBe(sensitiveData.profile.email);

      // Test unauthorized access
      const unauthorizedClient = await createTestClient({ auth: false });
      try {
        await unauthorizedClient.get(`/api/v1/members/${created.data.id}`);
        fail('Should not allow unauthorized access');
      } catch (error: any) {
        expect(error.status).toBe(HttpStatus.UNAUTHORIZED);
      }

      // Verify audit logging
      const auditLog = await apiClient.get(`/api/v1/audit/members/${created.data.id}`);
      expect(auditLog.data).toContainEqual(
        expect.objectContaining({
          action: 'ACCESS',
          resource: 'MEMBER',
          resourceId: created.data.id
        })
      );
    });
  });

  describe('Performance Requirements', () => {
    test('should handle concurrent member operations within time limits', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();

      // Generate concurrent member creation requests
      const requests = Array(concurrentRequests).fill(null).map(() => 
        apiClient.post('/api/v1/members', generateMockMember())
      );

      // Execute requests in parallel
      const results = await Promise.allSettled(requests);
      const endTime = Date.now();

      // Verify performance
      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentRequests;

      expect(averageTime).toBeLessThan(2000); // 2 second requirement
      
      // Verify data consistency
      const successfulRequests = results.filter(r => r.status === 'fulfilled');
      expect(successfulRequests.length).toBeGreaterThan(0);

      // Verify system stability
      const systemHealth = await apiClient.get('/api/v1/system/health');
      expect(systemHealth.data.status).toBe('healthy');
    });
  });
});