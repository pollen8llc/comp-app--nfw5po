import { jest } from 'jest'; // ^29.0.0
import nock from 'nock'; // ^13.3.0
import supertest from 'supertest'; // ^6.3.0

import { PartifulService } from '../../../backend/event-service/src/services/partiful.service';
import { Event, EventPlatform } from '../../../backend/shared/types/event.types';
import { TestHelpers } from '../../utils/test-helpers';
import { MockDataGenerator } from '../../utils/mock-data';

// Constants for test configuration
const MOCK_API_KEY = process.env.TEST_PARTIFUL_API_KEY;
const TEST_TIMEOUT = 30000;
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

describe('Partiful Integration Tests', () => {
  let partifulService: PartifulService;
  let mockDataGenerator: MockDataGenerator;

  beforeAll(async () => {
    // Set up test environment
    await TestHelpers.setupTestDatabase({
      transactional: true,
      timeout: TEST_TIMEOUT
    });

    // Initialize mock data generator
    mockDataGenerator = new MockDataGenerator();

    // Configure nock for API mocking
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  afterAll(async () => {
    // Clean up test environment
    await TestHelpers.cleanupTestData();
    nock.cleanAll();
    nock.enableNetConnect();
  });

  beforeEach(() => {
    // Reset service instance and mocks before each test
    partifulService = new PartifulService(MOCK_API_KEY as string);
    jest.clearAllMocks();
    nock.cleanAll();
  });

  describe('Event Import Tests', () => {
    it('should successfully import events within date range', async () => {
      // Generate mock events
      const mockEvents = Array.from({ length: 3 }, () => 
        mockDataGenerator.generateMockEvent({
          platform: EventPlatform.PARTIFUL
        })
      );

      // Mock Partiful API response
      nock('https://api.partiful.com/v1')
        .get('/events')
        .query(true)
        .reply(200, {
          events: mockEvents,
          pagination: { hasMore: false }
        });

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      const importedEvents = await partifulService.importEvents(startDate, endDate);

      expect(importedEvents).toHaveLength(mockEvents.length);
      expect(importedEvents[0].platform).toBe(EventPlatform.PARTIFUL);

      // Verify graph structure
      await TestHelpers.expectGraphStructure({
        nodes: importedEvents.map(event => ({
          id: event.id,
          labels: ['Event'],
          properties: {
            platform: EventPlatform.PARTIFUL,
            title: event.title
          }
        })),
        relationships: []
      });
    });

    it('should handle pagination for large event sets', async () => {
      const mockEvents = Array.from({ length: BATCH_SIZE * 2 }, () =>
        mockDataGenerator.generateMockEvent({
          platform: EventPlatform.PARTIFUL
        })
      );

      // Mock paginated responses
      nock('https://api.partiful.com/v1')
        .get('/events')
        .query(true)
        .reply(200, {
          events: mockEvents.slice(0, BATCH_SIZE),
          pagination: { hasMore: true, nextCursor: 'next_page' }
        });

      nock('https://api.partiful.com/v1')
        .get('/events')
        .query(true)
        .reply(200, {
          events: mockEvents.slice(BATCH_SIZE),
          pagination: { hasMore: false }
        });

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      const importedEvents = await partifulService.importEvents(startDate, endDate);

      expect(importedEvents).toHaveLength(mockEvents.length);
      expect(nock.isDone()).toBe(true);
    });

    it('should transform event data correctly', async () => {
      const mockEvent = mockDataGenerator.generateMockEvent({
        platform: EventPlatform.PARTIFUL,
        metadata: {
          capacity: 100,
          is_private: true,
          tags: {},
          categories: ['Tech'],
          dataClassification: 'CONFIDENTIAL',
          lastModifiedBy: 'test',
          lastModifiedAt: new Date()
        }
      });

      nock('https://api.partiful.com/v1')
        .get('/events')
        .query(true)
        .reply(200, {
          events: [mockEvent],
          pagination: { hasMore: false }
        });

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      const [transformedEvent] = await partifulService.importEvents(startDate, endDate);

      expect(transformedEvent).toMatchObject({
        platform: EventPlatform.PARTIFUL,
        title: mockEvent.title,
        metadata: expect.objectContaining({
          capacity: mockEvent.metadata.capacity,
          is_private: mockEvent.metadata.is_private
        })
      });
    });

    it('should meet performance requirements for batch imports', async () => {
      const mockEvents = Array.from({ length: BATCH_SIZE }, () =>
        mockDataGenerator.generateMockEvent({
          platform: EventPlatform.PARTIFUL
        })
      );

      nock('https://api.partiful.com/v1')
        .get('/events')
        .query(true)
        .reply(200, {
          events: mockEvents,
          pagination: { hasMore: false }
        });

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      const startTime = Date.now();
      await partifulService.importEvents(startDate, endDate);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      TestHelpers.expectResponseTime(processingTime, 2000); // 2-second SLA
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle API authentication errors', async () => {
      nock('https://api.partiful.com/v1')
        .get('/events')
        .query(true)
        .reply(401, {
          error: 'Invalid API key'
        });

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      await expect(partifulService.importEvents(startDate, endDate))
        .rejects
        .toThrow('Invalid Partiful API credentials');
    });

    it('should implement retry mechanism with backoff', async () => {
      const mockEvent = mockDataGenerator.generateMockEvent({
        platform: EventPlatform.PARTIFUL
      });

      // Simulate failures before success
      nock('https://api.partiful.com/v1')
        .get('/events')
        .query(true)
        .times(2)
        .reply(500);

      nock('https://api.partiful.com/v1')
        .get('/events')
        .query(true)
        .reply(200, {
          events: [mockEvent],
          pagination: { hasMore: false }
        });

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      const events = await partifulService.importEvents(startDate, endDate);
      expect(events).toHaveLength(1);
      expect(nock.isDone()).toBe(true);
    });

    it('should handle network timeouts gracefully', async () => {
      nock('https://api.partiful.com/v1')
        .get('/events')
        .query(true)
        .delayConnection(11000) // Exceed 10s timeout
        .reply(200);

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      await expect(partifulService.importEvents(startDate, endDate))
        .rejects
        .toThrow('Partiful API request failed');
    });

    it('should validate response data integrity', async () => {
      nock('https://api.partiful.com/v1')
        .get('/events')
        .query(true)
        .reply(200, {
          events: [{
            // Invalid event missing required fields
            id: 'test-id'
          }],
          pagination: { hasMore: false }
        });

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      await expect(partifulService.importEvents(startDate, endDate))
        .rejects
        .toThrow('Validation failed');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent imports efficiently', async () => {
      const mockEvents = Array.from({ length: 3 }, () =>
        mockDataGenerator.generateMockEvent({
          platform: EventPlatform.PARTIFUL
        })
      );

      nock('https://api.partiful.com/v1')
        .get('/events')
        .query(true)
        .times(3)
        .reply(200, {
          events: mockEvents,
          pagination: { hasMore: false }
        });

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      const startTime = Date.now();
      await Promise.all([
        partifulService.importEvents(startDate, endDate),
        partifulService.importEvents(startDate, endDate),
        partifulService.importEvents(startDate, endDate)
      ]);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      TestHelpers.expectResponseTime(processingTime, 4000); // Concurrent processing SLA
    });

    it('should maintain performance under load', async () => {
      const mockEvents = Array.from({ length: BATCH_SIZE }, () =>
        mockDataGenerator.generateMockEvent({
          platform: EventPlatform.PARTIFUL
        })
      );

      nock('https://api.partiful.com/v1')
        .get('/events')
        .query(true)
        .times(5)
        .reply(200, {
          events: mockEvents,
          pagination: { hasMore: false }
        });

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      const results = [];
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await partifulService.importEvents(startDate, endDate);
        results.push(Date.now() - startTime);
      }

      // Verify consistent performance
      const avgTime = results.reduce((a, b) => a + b) / results.length;
      expect(avgTime).toBeLessThan(2000); // 2-second average SLA
    });
  });
});