import { describe, it, beforeEach, afterEach, expect, jest } from 'jest';
import { neo4j, Driver, Session } from 'neo4j-driver'; // v5.12.0
import nock from 'nock'; // v13.3.0
import Redis from 'ioredis'; // v5.3.2

import { EventService } from '../../src/services/event.service';
import { EventPlatform, DataClassification, EventValidationStatus } from '../../../shared/types/event.types';

describe('Event Import Integration Tests', () => {
  let driver: Driver;
  let redis: Redis;
  let eventService: EventService;
  let session: Session;

  // Test configuration
  const testConfig = {
    apiKeys: {
      [EventPlatform.LUMA]: 'test-luma-key',
      [EventPlatform.EVENTBRITE]: 'test-eventbrite-key',
      [EventPlatform.PARTIFUL]: 'test-partiful-key'
    },
    neo4j: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'test'
    },
    redis: {
      host: 'localhost',
      port: 6379
    }
  };

  // Sample event data
  const sampleEvent = {
    title: 'Tech Conference 2024',
    description: 'Annual technology conference',
    start_date: new Date('2024-06-01T10:00:00Z'),
    end_date: new Date('2024-06-03T18:00:00Z'),
    location: 'San Francisco Convention Center',
    metadata: {
      tags: { type: 'conference', topic: 'technology' },
      categories: ['conference', 'professional'],
      capacity: 1000,
      is_private: false,
      dataClassification: DataClassification.INTERNAL,
      lastModifiedBy: 'system',
      lastModifiedAt: new Date()
    }
  };

  beforeEach(async () => {
    // Initialize Neo4j driver
    driver = neo4j.driver(
      testConfig.neo4j.uri,
      neo4j.auth.basic(testConfig.neo4j.username, testConfig.neo4j.password)
    );
    
    // Initialize Redis client
    redis = new Redis(testConfig.redis);
    
    // Initialize EventService
    eventService = new EventService(driver, redis, console, testConfig);
    
    // Clear database before each test
    session = driver.session();
    await session.run('MATCH (n) DETACH DELETE n');
    
    // Clear Redis cache
    await redis.flushall();
    
    // Reset HTTP mocks
    nock.cleanAll();
  });

  afterEach(async () => {
    await session.close();
    await driver.close();
    await redis.quit();
    nock.cleanAll();
  });

  describe('Luma Platform Integration', () => {
    const LUMA_API = 'https://api.lu.ma/v1';

    beforeEach(() => {
      // Mock Luma API responses
      nock(LUMA_API)
        .get('/events')
        .query(true)
        .reply(200, {
          events: [sampleEvent]
        });
    });

    it('should successfully import events from Luma', async () => {
      const importConfig = {
        platform: EventPlatform.LUMA,
        api_key: testConfig.apiKeys[EventPlatform.LUMA],
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31')
      };

      const result = await eventService.importEvents(importConfig);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify Neo4j storage
      const dbResult = await session.run(
        `MATCH (e:Event)-[:HAS_METADATA]->(m:EventMetadata)
         WHERE e.platform = $platform
         RETURN e, m`,
        { platform: EventPlatform.LUMA }
      );

      expect(dbResult.records).toHaveLength(1);
      const event = dbResult.records[0].get('e').properties;
      expect(event.title).toBe(sampleEvent.title);
    });

    it('should handle Luma API rate limiting', async () => {
      nock.cleanAll();
      nock(LUMA_API)
        .get('/events')
        .reply(429, { error: 'Rate limit exceeded' });

      const importConfig = {
        platform: EventPlatform.LUMA,
        api_key: testConfig.apiKeys[EventPlatform.LUMA],
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31')
      };

      const result = await eventService.importEvents(importConfig);

      expect(result.success).toBe(false);
      expect(result.imported).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].message).toContain('Rate limit exceeded');
    });
  });

  describe('Eventbrite Platform Integration', () => {
    const EVENTBRITE_API = 'https://www.eventbriteapi.com/v3';

    beforeEach(() => {
      // Mock Eventbrite API responses
      nock(EVENTBRITE_API)
        .get('/organizations/123/events')
        .query(true)
        .reply(200, {
          events: [sampleEvent]
        });
    });

    it('should successfully import events from Eventbrite', async () => {
      const importConfig = {
        platform: EventPlatform.EVENTBRITE,
        api_key: testConfig.apiKeys[EventPlatform.EVENTBRITE],
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31')
      };

      const result = await eventService.importEvents(importConfig);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.failed).toBe(0);

      // Verify data transformation and storage
      const dbResult = await session.run(
        `MATCH (e:Event)-[:HAS_METADATA]->(m:EventMetadata)
         WHERE e.platform = $platform
         RETURN e, m`,
        { platform: EventPlatform.EVENTBRITE }
      );

      expect(dbResult.records).toHaveLength(1);
      const metadata = dbResult.records[0].get('m').properties;
      expect(metadata.dataClassification).toBe(DataClassification.INTERNAL);
    });

    it('should handle malformed Eventbrite responses', async () => {
      nock.cleanAll();
      nock(EVENTBRITE_API)
        .get('/organizations/123/events')
        .reply(200, { events: [{ ...sampleEvent, start_date: 'invalid-date' }] });

      const importConfig = {
        platform: EventPlatform.EVENTBRITE,
        api_key: testConfig.apiKeys[EventPlatform.EVENTBRITE],
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31')
      };

      const result = await eventService.importEvents(importConfig);

      expect(result.success).toBe(false);
      expect(result.imported).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].message).toContain('Invalid date format');
    });
  });

  describe('Partiful Platform Integration', () => {
    const PARTIFUL_API = 'https://api.partiful.com/v1';

    beforeEach(() => {
      // Mock Partiful API responses
      nock(PARTIFUL_API)
        .get('/events')
        .query(true)
        .reply(200, {
          data: [sampleEvent]
        });
    });

    it('should successfully import events from Partiful', async () => {
      const importConfig = {
        platform: EventPlatform.PARTIFUL,
        api_key: testConfig.apiKeys[EventPlatform.PARTIFUL],
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31')
      };

      const result = await eventService.importEvents(importConfig);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.failed).toBe(0);

      // Verify cache invalidation
      const cachedEvents = await redis.keys('event:*');
      expect(cachedEvents).toHaveLength(1);
    });

    it('should handle Partiful authentication errors', async () => {
      nock.cleanAll();
      nock(PARTIFUL_API)
        .get('/events')
        .reply(401, { error: 'Invalid API key' });

      const importConfig = {
        platform: EventPlatform.PARTIFUL,
        api_key: 'invalid-key',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31')
      };

      const result = await eventService.importEvents(importConfig);

      expect(result.success).toBe(false);
      expect(result.imported).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].message).toContain('Authentication failed');
    });
  });

  describe('Import Validation and Error Handling', () => {
    it('should validate date ranges', async () => {
      const importConfig = {
        platform: EventPlatform.LUMA,
        api_key: testConfig.apiKeys[EventPlatform.LUMA],
        start_date: new Date('2024-12-31'),
        end_date: new Date('2024-01-01')
      };

      await expect(eventService.importEvents(importConfig))
        .rejects
        .toThrow('End date must be after start date');
    });

    it('should handle Neo4j connection errors', async () => {
      // Force Neo4j connection error
      await driver.close();

      const importConfig = {
        platform: EventPlatform.LUMA,
        api_key: testConfig.apiKeys[EventPlatform.LUMA],
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31')
      };

      const result = await eventService.importEvents(importConfig);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Database connection error');
    });

    it('should respect import rate limits', async () => {
      const promises = Array(10).fill(null).map(() => 
        eventService.importEvents({
          platform: EventPlatform.LUMA,
          api_key: testConfig.apiKeys[EventPlatform.LUMA],
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-12-31')
        })
      );

      const results = await Promise.all(promises);
      const rateLimited = results.some(r => 
        r.errors.some(e => e.message.includes('Rate limit exceeded'))
      );

      expect(rateLimited).toBe(true);
    });
  });
});