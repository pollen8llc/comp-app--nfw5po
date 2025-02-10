import { jest } from 'jest'; // ^29.0.0
import nock from 'nock'; // ^13.3.0

import { EventbriteService } from '../../../backend/event-service/src/services/eventbrite.service';
import { setupTestDatabase, expectGraphStructure, expectResponseTime } from '../../utils/test-helpers';
import { generateMockEvent } from '../../utils/mock-data';
import { Event, EventPlatform, DataClassification } from '../../../backend/shared/types/event.types';

// Test environment configuration
const MOCK_API_KEY = process.env.TEST_EVENTBRITE_API_KEY || 'test-api-key';
const TEST_TIMEOUT = 30000;
const RATE_LIMIT_DELAY = 100;

describe('EventbriteService Integration', () => {
  let eventbriteService: EventbriteService;
  let mockEvents: Event[];

  beforeAll(async () => {
    // Initialize test database and environment
    await setupTestDatabase({
      transactional: true,
      timeout: TEST_TIMEOUT
    });

    // Configure nock for Eventbrite API mocking
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  afterAll(async () => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  beforeEach(() => {
    // Initialize service with test configuration
    eventbriteService = new EventbriteService(MOCK_API_KEY);

    // Generate mock event data
    mockEvents = Array.from({ length: 5 }, () => 
      generateMockEvent({
        platform: EventPlatform.EVENTBRITE,
        external_id: `eb-${Math.random().toString(36).substr(2, 9)}`
      })
    );
  });

  test('should successfully import events with proper data transformation', async () => {
    // Mock Eventbrite API responses
    const baseUrl = 'https://www.eventbriteapi.com/v3';
    nock(baseUrl)
      .get('/organizations/me/events')
      .query(true)
      .reply(200, {
        events: mockEvents.map(event => ({
          id: event.external_id,
          name: { text: event.title },
          description: { text: event.description },
          start: { utc: event.start_date.toISOString() },
          end: { utc: event.end_date.toISOString() },
          venue: {
            address: {
              localized_address_display: event.location
            }
          },
          capacity: event.metadata.capacity,
          is_private: event.metadata.is_private,
          category_id: '1',
          subcategory_id: '1'
        })),
        pagination: { has_more_items: false }
      });

    // Mock category API calls
    nock(baseUrl)
      .get(/\/categories\/\d+/)
      .reply(200, { name: 'Technology' })
      .persist();

    nock(baseUrl)
      .get(/\/subcategories\/\d+/)
      .reply(200, { name: 'Software' })
      .persist();

    const startTime = Date.now();

    // Execute event import
    const importResult = await eventbriteService.importEvents({
      platform: EventPlatform.EVENTBRITE,
      api_key: MOCK_API_KEY,
      start_date: new Date(Date.now() - 86400000), // 24 hours ago
      end_date: new Date(Date.now() + 86400000) // 24 hours from now
    });

    const endTime = Date.now();

    // Verify response time meets requirements
    expectResponseTime(endTime - startTime, 2000);

    // Verify imported events
    expect(importResult).toHaveLength(mockEvents.length);
    
    // Verify data transformation
    importResult.forEach((event, index) => {
      expect(event).toMatchObject({
        id: expect.stringContaining('eventbrite_'),
        title: mockEvents[index].title,
        description: mockEvents[index].description,
        platform: EventPlatform.EVENTBRITE,
        external_id: mockEvents[index].external_id,
        metadata: expect.objectContaining({
          categories: expect.arrayContaining(['Technology', 'Software']),
          capacity: mockEvents[index].metadata.capacity,
          is_private: mockEvents[index].metadata.is_private
        })
      });
    });

    // Verify graph structure
    await expectGraphStructure({
      nodes: importResult.map(event => ({
        id: event.id,
        labels: ['Event'],
        properties: {
          platform: EventPlatform.EVENTBRITE,
          external_id: event.external_id
        }
      })),
      relationships: []
    });
  });

  test('should handle pagination correctly for large event sets', async () => {
    // Generate large set of mock events
    const largeEventSet = Array.from({ length: 100 }, () => generateMockEvent());
    const pageSize = 50;
    const pages = Math.ceil(largeEventSet.length / pageSize);

    // Mock paginated API responses
    const baseUrl = 'https://www.eventbriteapi.com/v3';
    for (let i = 0; i < pages; i++) {
      const pageEvents = largeEventSet.slice(i * pageSize, (i + 1) * pageSize);
      nock(baseUrl)
        .get('/organizations/me/events')
        .query(true)
        .reply(200, {
          events: pageEvents.map(event => ({
            id: event.external_id,
            name: { text: event.title },
            description: { text: event.description },
            start: { utc: event.start_date.toISOString() },
            end: { utc: event.end_date.toISOString() },
            venue: {
              address: {
                localized_address_display: event.location
              }
            },
            capacity: event.metadata.capacity,
            is_private: event.metadata.is_private
          })),
          pagination: {
            has_more_items: i < pages - 1,
            continuation: i < pages - 1 ? `page_${i + 1}` : null
          }
        });
    }

    const importResult = await eventbriteService.importEvents({
      platform: EventPlatform.EVENTBRITE,
      api_key: MOCK_API_KEY,
      start_date: new Date(Date.now() - 86400000),
      end_date: new Date(Date.now() + 86400000)
    });

    // Verify all events were imported
    expect(importResult).toHaveLength(largeEventSet.length);

    // Verify no duplicates
    const uniqueIds = new Set(importResult.map(event => event.external_id));
    expect(uniqueIds.size).toBe(largeEventSet.length);
  });

  test('should handle API errors gracefully', async () => {
    const baseUrl = 'https://www.eventbriteapi.com/v3';

    // Mock various API errors
    nock(baseUrl)
      .get('/organizations/me/events')
      .query(true)
      .reply(401, { error: 'Invalid authentication credentials' });

    await expect(eventbriteService.importEvents({
      platform: EventPlatform.EVENTBRITE,
      api_key: 'invalid-key',
      start_date: new Date(),
      end_date: new Date()
    })).rejects.toThrow('Event import failed');

    nock(baseUrl)
      .get('/organizations/me/events')
      .query(true)
      .reply(429, {}, { 'Retry-After': '60' });

    await expect(eventbriteService.importEvents({
      platform: EventPlatform.EVENTBRITE,
      api_key: MOCK_API_KEY,
      start_date: new Date(),
      end_date: new Date()
    })).rejects.toThrow('Failed to fetch events');
  });

  test('should validate event data correctly', async () => {
    const baseUrl = 'https://www.eventbriteapi.com/v3';
    
    // Mock events with validation issues
    const invalidEvents = [
      {
        id: 'invalid-1',
        name: { text: '' }, // Invalid: empty title
        start: { utc: new Date().toISOString() },
        end: { utc: new Date(Date.now() - 86400000).toISOString() } // Invalid: end before start
      },
      {
        id: 'invalid-2',
        name: { text: 'Valid Title' },
        start: { utc: new Date().toISOString() },
        end: { utc: new Date().toISOString() },
        venue: null // Invalid: missing venue
      }
    ];

    nock(baseUrl)
      .get('/organizations/me/events')
      .query(true)
      .reply(200, {
        events: invalidEvents,
        pagination: { has_more_items: false }
      });

    const importResult = await eventbriteService.importEvents({
      platform: EventPlatform.EVENTBRITE,
      api_key: MOCK_API_KEY,
      start_date: new Date(),
      end_date: new Date()
    });

    // Verify invalid events were filtered out
    expect(importResult).toHaveLength(0);
  });
});