import { jest } from 'jest'; // ^29.0.0
import {
  setupTestDatabase,
  createTestClient,
  expectGraphStructure,
  expectResponseTime
} from '../../utils/test-helpers';
import { TestAPIClient } from '../../utils/api-client';
import { GraphQuery } from '../../../backend/shared/types/analytics.types';
import { Member } from '../../../web/src/types/members';
import { Event } from '../../../web/src/types/events';
import { HttpStatus, ErrorCode } from '../../../web/src/types/api';

// Performance thresholds from technical specifications
const TEST_TIMEOUT = 10000;
const PERFORMANCE_THRESHOLD = 2000; // 2 second response time requirement
const DEGRADATION_THRESHOLD = 1500; // Alert threshold for performance degradation

describe('Graph Query API Integration Tests', () => {
  let client: TestAPIClient;

  beforeAll(async () => {
    // Initialize test environment with comprehensive test data
    await setupTestDatabase({
      transactional: true,
      timeout: TEST_TIMEOUT
    });

    // Create authenticated test client with performance monitoring
    client = await createTestClient({
      auth: true,
      interceptors: [],
      caching: true
    });

    // Set up test data fixtures
    await seedTestData();
  });

  afterAll(async () => {
    // Clean up test data and save performance metrics
    await cleanupTestData();
  });

  async function seedTestData() {
    // Create test members with relationships
    const memberQueries = [
      `CREATE (m:Member {
        id: 'test-member-1',
        name: 'John Doe',
        email: 'john@example.com',
        location: 'San Francisco'
      })`,
      `CREATE (m:Member {
        id: 'test-member-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        location: 'New York'
      })`
    ];

    // Create test events with relationships
    const eventQueries = [
      `CREATE (e:Event {
        id: 'test-event-1',
        title: 'Tech Meetup',
        date: datetime('2023-12-01T19:00:00Z'),
        location: 'San Francisco'
      })`,
      `CREATE (e:Event {
        id: 'test-event-2',
        title: 'Developer Conference',
        date: datetime('2023-12-15T09:00:00Z'),
        location: 'New York'
      })`
    ];

    // Create relationships
    const relationshipQueries = [
      `MATCH (m:Member {id: 'test-member-1'}), (e:Event {id: 'test-event-1'})
       CREATE (m)-[:ATTENDED {role: 'attendee', timestamp: datetime()}]->(e)`,
      `MATCH (m:Member {id: 'test-member-2'}), (e:Event {id: 'test-event-1'})
       CREATE (m)-[:ATTENDED {role: 'organizer', timestamp: datetime()}]->(e)`,
      `MATCH (m1:Member {id: 'test-member-1'}), (m2:Member {id: 'test-member-2'})
       CREATE (m1)-[:KNOWS {strength: 0.8, last_interaction: datetime()}]->(m2)`
    ];

    for (const query of [...memberQueries, ...eventQueries, ...relationshipQueries]) {
      await client.post('/api/v1/graph/query', { query });
    }
  }

  async function cleanupTestData() {
    await client.post('/api/v1/graph/query', {
      query: 'MATCH (n) DETACH DELETE n'
    });
  }

  describe('Simple Queries', () => {
    it('should execute simple member-event query within performance limits', async () => {
      const query: GraphQuery = {
        queryPattern: `
          MATCH (m:Member)-[r:ATTENDED]->(e:Event)
          WHERE m.location = $location
          RETURN m, r, e
        `,
        parameters: { location: 'San Francisco' },
        limit: 10
      };

      const startTime = Date.now();
      const response = await client.post('/api/v1/graph/query', query);
      const endTime = Date.now();

      // Validate response time
      expectResponseTime(endTime - startTime, PERFORMANCE_THRESHOLD);

      // Validate response structure
      expect(response.status).toBe(HttpStatus.OK);
      expect(response.data).toBeDefined();
      expect(response.data.nodes).toBeInstanceOf(Array);
      expect(response.data.relationships).toBeInstanceOf(Array);

      // Verify result contents
      expect(response.data.nodes.length).toBeGreaterThan(0);
      expect(response.data.nodes[0].labels).toContain('Member');
      expect(response.data.relationships[0].type).toBe('ATTENDED');
    });
  });

  describe('Complex Queries', () => {
    it('should handle complex multi-hop queries efficiently', async () => {
      const query: GraphQuery = {
        queryPattern: `
          MATCH (m1:Member)-[:ATTENDED]->(e1:Event)<-[:ATTENDED]-(m2:Member)-[:ATTENDED]->(e2:Event)
          WHERE m1.id = $memberId
          RETURN m1, m2, e1, e2
        `,
        parameters: { memberId: 'test-member-1' },
        limit: 10
      };

      const startTime = Date.now();
      const response = await client.post('/api/v1/graph/query', query);
      const endTime = Date.now();

      // Check performance
      expectResponseTime(endTime - startTime, PERFORMANCE_THRESHOLD);

      // Validate complex query results
      expect(response.status).toBe(HttpStatus.OK);
      expect(response.data.nodes).toBeDefined();
      expect(response.data.relationships).toBeDefined();

      // Verify relationship chain
      const relationships = response.data.relationships;
      expect(relationships.some(r => r.type === 'ATTENDED')).toBe(true);
    });
  });

  describe('Query Parameters', () => {
    it('should apply query parameters correctly', async () => {
      const query: GraphQuery = {
        queryPattern: `
          MATCH (m:Member)-[r:ATTENDED]->(e:Event)
          WHERE e.date >= $startDate AND e.date <= $endDate
          RETURN m, r, e
        `,
        parameters: {
          startDate: '2023-12-01T00:00:00Z',
          endDate: '2023-12-31T23:59:59Z'
        },
        limit: 10
      };

      const response = await client.post('/api/v1/graph/query', query);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.data.nodes).toBeDefined();
      
      // Verify date filtering
      const events = response.data.nodes.filter(n => n.labels.includes('Event'));
      events.forEach(event => {
        const eventDate = new Date(event.properties.date);
        expect(eventDate >= new Date('2023-12-01')).toBe(true);
        expect(eventDate <= new Date('2023-12-31')).toBe(true);
      });
    });
  });

  describe('Pagination and Limits', () => {
    it('should handle pagination and limits', async () => {
      const query: GraphQuery = {
        queryPattern: `
          MATCH (m:Member)
          RETURN m
          SKIP $skip
          LIMIT $limit
        `,
        parameters: { skip: 0, limit: 1 },
        limit: 1
      };

      const response = await client.post('/api/v1/graph/query', query);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.data.nodes.length).toBeLessThanOrEqual(1);
      expect(response.data.metadata.hasMore).toBeDefined();
      expect(response.data.metadata.totalCount).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should validate query patterns', async () => {
      const invalidQuery: GraphQuery = {
        queryPattern: 'INVALID CYPHER QUERY',
        parameters: {},
        limit: 10
      };

      try {
        await client.post('/api/v1/graph/query', invalidQuery);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.status).toBe(HttpStatus.BAD_REQUEST);
        expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(error.message).toContain('Invalid Cypher query');
      }
    });
  });

  describe('Performance Monitoring', () => {
    it('should monitor performance degradation', async () => {
      const complexQuery: GraphQuery = {
        queryPattern: `
          MATCH (m1:Member)-[:KNOWS*1..3]-(m2:Member)-[:ATTENDED]->(e:Event)
          WHERE m1.id = $memberId
          RETURN m1, m2, e
        `,
        parameters: { memberId: 'test-member-1' },
        limit: 100
      };

      const startTime = Date.now();
      const response = await client.post('/api/v1/graph/query', complexQuery);
      const endTime = Date.now();

      const responseTime = endTime - startTime;

      // Check for performance degradation
      if (responseTime > DEGRADATION_THRESHOLD) {
        console.warn(`Performance degradation detected: ${responseTime}ms`);
      }

      expect(responseTime).toBeLessThanOrEqual(PERFORMANCE_THRESHOLD);
      expect(response.status).toBe(HttpStatus.OK);
    });
  });
});