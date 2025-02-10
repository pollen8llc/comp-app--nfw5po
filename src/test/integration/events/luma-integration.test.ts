import { jest } from '@jest/globals'; // ^29.0.0
import nock from 'nock'; // ^13.0.0
import { LumaService } from '../../../backend/event-service/src/services/luma.service';
import { setupTestDatabase, expectResponseTime } from '../../utils/test-helpers';
import { generateMockEvent } from '../../utils/mock-data';
import { Event, EventPlatform, EventValidationStatus } from '../../../backend/shared/types/event.types';

// Constants for test configuration
const MOCK_API_KEY = process.env.TEST_LUMA_API_KEY || 'test-api-key';
const MOCK_BASE_URL = 'https://api.lu.ma/v1';
const RATE_LIMIT = 5; // Requests per minute
const RESPONSE_TIME_LIMIT = 30000; // 30 seconds

describe('Luma Integration', () => {
  let lumaService: LumaService;

  beforeAll(async () => {
    // Set up test environment
    await setupTestDatabase({ transactional: true });

    // Configure nock for API mocking
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');

    // Initialize LumaService with test configuration
    lumaService = new LumaService(
      MOCK_API_KEY,
      console as any, // Mock logger
      {
        points: RATE_LIMIT,
        duration: 60,
        blockDuration: 60
      }
    );
  });

  afterAll(async () => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('should successfully import events', async () => {
    // Generate mock events
    const mockEvents = Array.from({ length: 3 }, () => ({
      id: Math.random().toString(36).substring(7),
      name: 'Test Event',
      description: 'Test Description',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 86400000).toISOString(),
      location: {
        name: 'Test Venue',
        address: '123 Test St'
      },
      capacity: 100,
      isPrivate: false,
      metadata: {
        tags: { category: 'tech' },
        categories: ['conference']
      }
    }));

    // Mock Luma API response
    nock(MOCK_BASE_URL)
      .get('/events')
      .query(true)
      .reply(200, mockEvents);

    const startTime = Date.now();

    // Execute import
    const importedEvents = await lumaService.importEvents({
      platform: EventPlatform.LUMA,
      api_key: MOCK_API_KEY,
      start_date: new Date(Date.now() - 86400000),
      end_date: new Date()
    });

    const endTime = Date.now();

    // Verify response time
    expectResponseTime(endTime - startTime, RESPONSE_TIME_LIMIT);

    // Verify imported events
    expect(importedEvents).toHaveLength(mockEvents.length);
    importedEvents.forEach((event, index) => {
      expect(event).toMatchObject({
        id: expect.stringContaining('luma_'),
        title: mockEvents[index].name,
        description: mockEvents[index].description,
        platform: EventPlatform.LUMA,
        external_id: mockEvents[index].id,
        metadata: expect.objectContaining({
          capacity: mockEvents[index].capacity,
          is_private: mockEvents[index].isPrivate
        })
      });
    });
  });

  test('should handle API errors gracefully', async () => {
    // Mock various error scenarios
    nock(MOCK_BASE_URL)
      .get('/events')
      .query(true)
      .reply(401, { error: 'Invalid API key' });

    await expect(lumaService.importEvents({
      platform: EventPlatform.LUMA,
      api_key: 'invalid-key',
      start_date: new Date(),
      end_date: new Date()
    })).rejects.toThrow('Authentication failed');

    nock(MOCK_BASE_URL)
      .get('/events')
      .query(true)
      .reply(429, { error: 'Rate limit exceeded' });

    await expect(lumaService.importEvents({
      platform: EventPlatform.LUMA,
      api_key: MOCK_API_KEY,
      start_date: new Date(),
      end_date: new Date()
    })).rejects.toThrow('Rate limit exceeded');

    nock(MOCK_BASE_URL)
      .get('/events')
      .query(true)
      .reply(500, { error: 'Internal server error' });

    await expect(lumaService.importEvents({
      platform: EventPlatform.LUMA,
      api_key: MOCK_API_KEY,
      start_date: new Date(),
      end_date: new Date()
    })).rejects.toThrow('Failed to import events');
  });

  test('should retrieve single event by ID', async () => {
    const mockEvent = {
      id: 'test-event-id',
      name: 'Single Test Event',
      description: 'Test Description',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 86400000).toISOString(),
      location: {
        name: 'Test Venue',
        address: '123 Test St'
      },
      capacity: 100,
      isPrivate: false,
      metadata: {
        tags: { category: 'tech' },
        categories: ['conference']
      }
    };

    nock(MOCK_BASE_URL)
      .get(`/events/${mockEvent.id}`)
      .reply(200, mockEvent);

    const startTime = Date.now();
    const event = await lumaService.getEvent(mockEvent.id);
    const endTime = Date.now();

    expectResponseTime(endTime - startTime, RESPONSE_TIME_LIMIT);

    expect(event).toMatchObject({
      id: expect.stringContaining('luma_'),
      title: mockEvent.name,
      description: mockEvent.description,
      platform: EventPlatform.LUMA,
      external_id: mockEvent.id
    });
  });

  test('should validate event data format', async () => {
    const invalidEvent = {
      id: 'test-invalid-event',
      name: '', // Invalid: empty title
      startTime: 'invalid-date', // Invalid: date format
      endTime: new Date().toISOString(),
      location: {
        name: 'Test Venue'
      },
      capacity: -1, // Invalid: negative capacity
      isPrivate: false,
      metadata: {
        tags: { category: 'x'.repeat(101) }, // Invalid: tag too long
        categories: Array(6).fill('category') // Invalid: too many categories
      }
    };

    nock(MOCK_BASE_URL)
      .get('/events')
      .query(true)
      .reply(200, [invalidEvent]);

    await expect(lumaService.importEvents({
      platform: EventPlatform.LUMA,
      api_key: MOCK_API_KEY,
      start_date: new Date(),
      end_date: new Date()
    })).rejects.toThrow('Validation failed');
  });

  test('should handle rate limiting', async () => {
    // Generate multiple concurrent requests
    const requests = Array.from({ length: RATE_LIMIT + 1 }, () => 
      lumaService.importEvents({
        platform: EventPlatform.LUMA,
        api_key: MOCK_API_KEY,
        start_date: new Date(),
        end_date: new Date()
      })
    );

    nock(MOCK_BASE_URL)
      .get('/events')
      .query(true)
      .times(RATE_LIMIT + 1)
      .reply(200, []);

    // Execute requests concurrently
    const results = await Promise.allSettled(requests);

    // Verify rate limit enforcement
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    expect(succeeded).toBeLessThanOrEqual(RATE_LIMIT);
    expect(failed).toBeGreaterThan(0);
  });
});