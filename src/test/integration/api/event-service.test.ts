import { jest } from 'jest'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.3
import { 
  setupTestDatabase, 
  createTestClient, 
  expectGraphStructure, 
  expectResponseTime 
} from '../../utils/test-helpers';
import { 
  generateMockEvent, 
  generateMockMember 
} from '../../utils/mock-data';
import { 
  Event, 
  EventPlatform, 
  EventMetadata,
  ImportEventsInput 
} from '../../../web/src/types/events';
import { 
  HttpStatus, 
  ErrorCode, 
  APIResponse 
} from '../../../web/src/types/api';
import { DataClassification } from '../../../backend/shared/types/event.types';

// Test configuration constants
const TEST_TIMEOUT = 30000;
const RATE_LIMIT_THRESHOLD = 5;
const PERFORMANCE_DEGRADATION_THRESHOLD = 1.5;

describe('Event Service API Integration Tests', () => {
  let testClient: any;

  beforeAll(async () => {
    // Initialize test environment
    await setupTestDatabase({
      transactional: true,
      parallel: false,
      timeout: TEST_TIMEOUT
    });

    // Create authenticated test client
    testClient = await createTestClient({
      auth: true,
      interceptors: [],
      caching: false
    });

    // Set up platform mock responses
    setupPlatformMocks();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  describe('Event CRUD Operations', () => {
    test('should create event with proper security classification', async () => {
      // Generate classified mock event
      const mockEvent = generateMockEvent({
        metadata: {
          ...generateMockEvent().metadata,
          dataClassification: DataClassification.INTERNAL
        }
      });

      const startTime = Date.now();
      const response = await testClient.post('/api/v1/events', mockEvent);
      const endTime = Date.now();

      // Verify response structure and security
      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.data).toHaveProperty('id');
      expect(response.headers['x-content-security-policy']).toBeDefined();

      // Verify data classification
      expect(response.data.metadata.dataClassification)
        .toBe(DataClassification.INTERNAL);

      // Verify graph structure
      await expectGraphStructure({
        nodes: [{
          id: response.data.id,
          labels: ['Event'],
          properties: {
            title: mockEvent.title,
            dataClassification: DataClassification.INTERNAL
          }
        }],
        relationships: []
      });

      // Verify performance
      expectResponseTime(endTime - startTime, 2000);
    });

    test('should handle concurrent event updates within rate limits', async () => {
      const mockEvent = await createTestEvent();
      const updates = Array(RATE_LIMIT_THRESHOLD).fill(null).map(() => ({
        title: `Updated Title ${Date.now()}`
      }));

      const results = await Promise.all(
        updates.map(update => 
          testClient.patch(`/api/v1/events/${mockEvent.id}`, update)
        )
      );

      // Verify rate limiting
      results.forEach(response => {
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      });

      // Verify final state
      const finalResponse = await testClient.get(`/api/v1/events/${mockEvent.id}`);
      expect(finalResponse.data.title).toBe(updates[updates.length - 1].title);
    });
  });

  describe('Platform Integration', () => {
    test('should import events from multiple platforms concurrently', async () => {
      const importConfigs: ImportEventsInput[] = [
        {
          platform: EventPlatform.LUMA,
          api_key: 'test-luma-key',
          start_date: new Date(),
          end_date: new Date()
        },
        {
          platform: EventPlatform.EVENTBRITE,
          api_key: 'test-eventbrite-key',
          start_date: new Date(),
          end_date: new Date()
        },
        {
          platform: EventPlatform.PARTIFUL,
          api_key: 'test-partiful-key',
          start_date: new Date(),
          end_date: new Date()
        }
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        importConfigs.map(config => 
          testClient.post('/api/v1/events/import', config)
        )
      );
      const endTime = Date.now();

      // Verify import success
      results.forEach(response => {
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.data.imported_count).toBeGreaterThan(0);
      });

      // Verify data classification
      const importedEvents = await testClient.get('/api/v1/events');
      importedEvents.data.forEach((event: Event) => {
        expect(event.metadata.dataClassification).toBeDefined();
      });

      // Verify import performance
      expectResponseTime(endTime - startTime, 30000);
    });

    test('should handle platform-specific validation errors', async () => {
      const invalidConfig: ImportEventsInput = {
        platform: EventPlatform.LUMA,
        api_key: 'invalid-key',
        start_date: new Date(),
        end_date: new Date()
      };

      const response = await testClient.post('/api/v1/events/import', invalidConfig);

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.data.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.data.details.platform).toBeDefined();
    });
  });

  describe('Event Participation', () => {
    test('should manage event participation with proper security context', async () => {
      const mockEvent = await createTestEvent();
      const mockMembers = Array(3).fill(null).map(() => generateMockMember());

      // Add participants
      const addResults = await Promise.all(
        mockMembers.map(member =>
          testClient.post(`/api/v1/events/${mockEvent.id}/participants`, {
            member_id: member.id,
            role: 'ATTENDEE'
          })
        )
      );

      // Verify participant addition
      addResults.forEach(response => {
        expect(response.status).toBe(HttpStatus.OK);
      });

      // Verify graph relationships
      await expectGraphStructure({
        nodes: [
          {
            id: mockEvent.id,
            labels: ['Event'],
            properties: { title: mockEvent.title }
          },
          ...mockMembers.map(member => ({
            id: member.id,
            labels: ['Member'],
            properties: { email: member.profile.email }
          }))
        ],
        relationships: mockMembers.map(member => ({
          start: member.id,
          end: mockEvent.id,
          type: 'ATTENDED',
          properties: { role: 'ATTENDEE' }
        }))
      });
    });
  });
});

// Helper Functions

async function setupPlatformMocks(): Promise<void> {
  // Mock Luma API responses
  testClient.mockResponse(
    { method: 'GET', path: /^\/api\/v1\/luma\/events/ },
    { status: 200, data: { events: [] } }
  );

  // Mock Eventbrite API responses
  testClient.mockResponse(
    { method: 'GET', path: /^\/api\/v1\/eventbrite\/events/ },
    { status: 200, data: { events: [] } }
  );

  // Mock Partiful API responses
  testClient.mockResponse(
    { method: 'GET', path: /^\/api\/v1\/partiful\/events/ },
    { status: 200, data: { events: [] } }
  );
}

async function cleanupTestEnvironment(): Promise<void> {
  await testClient.clearMocks();
  // Additional cleanup as needed
}

async function clearTestData(): Promise<void> {
  await testClient.delete('/api/v1/events/test-data');
}

async function createTestEvent(): Promise<Event> {
  const mockEvent = generateMockEvent();
  const response = await testClient.post('/api/v1/events', mockEvent);
  return response.data;
}