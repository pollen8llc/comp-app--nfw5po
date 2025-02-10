import { performance } from 'perf_hooks'; // v1.0.0
import { jest } from '@jest/globals'; // v29.0.0
import { Driver, Session, Transaction } from 'neo4j-driver'; // v5.0.0
import Redis from 'ioredis'; // v5.3.0
import { Logger } from 'winston'; // v3.10.0

import { EventService } from '../../src/services/event.service';
import { Event, EventPlatform, DataClassification, CreateEventInput, ImportEventsInput } from '../../../shared/types/event.types';

describe('EventService', () => {
  let eventService: EventService;
  let mockDriver: jest.Mocked<Driver>;
  let mockSession: jest.Mocked<Session>;
  let mockTransaction: jest.Mocked<Transaction>;
  let mockRedis: jest.Mocked<Redis>;
  let mockLogger: jest.Mocked<Logger>;

  const mockConfig = {
    apiKeys: {
      [EventPlatform.LUMA]: 'luma-api-key',
      [EventPlatform.EVENTBRITE]: 'eventbrite-api-key',
      [EventPlatform.PARTIFUL]: 'partiful-api-key'
    }
  };

  const mockEvent: Event = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Event',
    description: 'Test Description',
    start_date: new Date('2024-01-01T10:00:00Z'),
    end_date: new Date('2024-01-01T12:00:00Z'),
    location: 'Test Location',
    platform: EventPlatform.LUMA,
    metadata: {
      tags: { test: { value: 'tag', validated: true } },
      categories: ['conference'],
      capacity: 100,
      is_private: false,
      dataClassification: DataClassification.INTERNAL,
      lastModifiedBy: 'test-user',
      lastModifiedAt: new Date()
    },
    participants: [],
    validationStatus: 'VALIDATED',
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 'test-user',
    updated_by: 'test-user'
  };

  beforeEach(() => {
    // Setup Neo4j mocks
    mockTransaction = {
      run: jest.fn(),
    } as unknown as jest.Mocked<Transaction>;

    mockSession = {
      run: jest.fn(),
      executeRead: jest.fn(),
      executeWrite: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<Session>;

    mockDriver = {
      session: jest.fn().mockReturnValue(mockSession),
    } as unknown as jest.Mocked<Driver>;

    // Setup Redis mock
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    // Setup Logger mock
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    eventService = new EventService(
      mockDriver,
      mockRedis,
      mockLogger,
      mockConfig
    );
  });

  describe('CRUD Operations', () => {
    describe('createEvent', () => {
      const createEventInput: CreateEventInput = {
        title: 'Test Event',
        description: 'Test Description',
        start_date: new Date('2024-01-01T10:00:00Z'),
        end_date: new Date('2024-01-01T12:00:00Z'),
        location: 'Test Location',
        metadata: mockEvent.metadata
      };

      it('should create an event successfully', async () => {
        mockSession.executeWrite.mockImplementation(async (callback) => {
          const result = {
            records: [{
              get: jest.fn().mockReturnValue({
                properties: mockEvent
              })
            }]
          };
          return callback(mockTransaction);
        });

        const result = await eventService.createEvent(createEventInput);

        expect(result).toBeDefined();
        expect(result.title).toBe(createEventInput.title);
        expect(mockSession.executeWrite).toHaveBeenCalled();
        expect(mockRedis.setex).toHaveBeenCalled();
      });

      it('should handle validation errors', async () => {
        const invalidInput = {
          ...createEventInput,
          end_date: new Date('2023-01-01') // End date before start date
        };

        await expect(eventService.createEvent(invalidInput))
          .rejects
          .toThrow('End date must be after start date');
      });

      it('should enforce data classification', async () => {
        const sensitiveInput = {
          ...createEventInput,
          metadata: {
            ...mockEvent.metadata,
            dataClassification: DataClassification.CONFIDENTIAL
          }
        };

        mockSession.executeWrite.mockImplementation(async (callback) => {
          const result = {
            records: [{
              get: jest.fn().mockReturnValue({
                properties: { ...mockEvent, metadata: sensitiveInput.metadata }
              })
            }]
          };
          return callback(mockTransaction);
        });

        const result = await eventService.createEvent(sensitiveInput);
        expect(result.metadata.dataClassification).toBe(DataClassification.CONFIDENTIAL);
      });
    });

    describe('getEvent', () => {
      it('should retrieve event from cache if available', async () => {
        const cachedEvent = { ...mockEvent };
        mockRedis.get.mockResolvedValue(JSON.stringify(cachedEvent));

        const result = await eventService.getEvent(mockEvent.id);

        expect(result).toEqual(cachedEvent);
        expect(mockRedis.get).toHaveBeenCalled();
        expect(mockSession.executeRead).not.toHaveBeenCalled();
      });

      it('should retrieve event from database if not in cache', async () => {
        mockRedis.get.mockResolvedValue(null);
        mockSession.executeRead.mockImplementation(async (callback) => {
          const result = {
            records: [{
              get: jest.fn().mockReturnValue({
                properties: mockEvent
              })
            }]
          };
          return callback(mockTransaction);
        });

        const result = await eventService.getEvent(mockEvent.id);

        expect(result).toBeDefined();
        expect(mockSession.executeRead).toHaveBeenCalled();
        expect(mockRedis.setex).toHaveBeenCalled();
      });

      it('should handle non-existent events', async () => {
        mockRedis.get.mockResolvedValue(null);
        mockSession.executeRead.mockImplementation(async (callback) => {
          const result = { records: [] };
          return callback(mockTransaction);
        });

        await expect(eventService.getEvent('non-existent-id'))
          .rejects
          .toThrow('Event not found');
      });
    });

    describe('updateEvent', () => {
      const updateInput = {
        title: 'Updated Event',
        description: 'Updated Description'
      };

      it('should update event successfully', async () => {
        mockSession.executeWrite.mockImplementation(async (callback) => {
          const result = {
            records: [{
              get: jest.fn().mockReturnValue({
                properties: { ...mockEvent, ...updateInput }
              })
            }]
          };
          return callback(mockTransaction);
        });

        const result = await eventService.updateEvent(mockEvent.id, updateInput);

        expect(result.title).toBe(updateInput.title);
        expect(result.description).toBe(updateInput.description);
        expect(mockRedis.setex).toHaveBeenCalled();
      });

      it('should validate updates', async () => {
        const invalidUpdate = {
          start_date: new Date('2024-01-01T14:00:00Z'),
          end_date: new Date('2024-01-01T13:00:00Z')
        };

        await expect(eventService.updateEvent(mockEvent.id, invalidUpdate))
          .rejects
          .toThrow('End date must be after start date');
      });
    });
  });

  describe('Platform Integration', () => {
    describe('importEvents', () => {
      const importInput: ImportEventsInput = {
        platform: EventPlatform.LUMA,
        api_key: 'test-api-key',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-02-01')
      };

      it('should import events successfully', async () => {
        const result = await eventService.importEvents(importInput);

        expect(result.success).toBe(true);
        expect(result.imported).toBeGreaterThanOrEqual(0);
        expect(result.failed).toBe(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle platform-specific errors', async () => {
        const invalidInput = {
          ...importInput,
          platform: EventPlatform.EVENTBRITE,
          api_key: 'invalid-key'
        };

        await expect(eventService.importEvents(invalidInput))
          .rejects
          .toThrow('API key not configured');
      });

      it('should respect rate limits', async () => {
        const promises = Array(10).fill(null).map(() => 
          eventService.importEvents(importInput)
        );

        const results = await Promise.allSettled(promises);
        const fulfilled = results.filter(r => r.status === 'fulfilled');
        expect(fulfilled.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should meet response time requirements for graph queries', async () => {
      const start = performance.now();
      await eventService.getEvent(mockEvent.id);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2000); // 2 second requirement
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const start = performance.now();

      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() => eventService.getEvent(mockEvent.id));

      await Promise.all(promises);
      const duration = performance.now() - start;
      const avgDuration = duration / concurrentRequests;

      expect(avgDuration).toBeLessThan(2000);
    });
  });

  describe('Security Controls', () => {
    it('should enforce data classification on event creation', async () => {
      const sensitiveEvent = {
        ...createEventInput,
        metadata: {
          ...mockEvent.metadata,
          dataClassification: DataClassification.CONFIDENTIAL
        }
      };

      const result = await eventService.createEvent(sensitiveEvent);
      expect(result.metadata.dataClassification).toBe(DataClassification.CONFIDENTIAL);
    });

    it('should validate event security constraints', async () => {
      const publicPrivateEvent = {
        ...createEventInput,
        metadata: {
          ...mockEvent.metadata,
          is_private: true,
          dataClassification: DataClassification.PUBLIC
        }
      };

      await expect(eventService.createEvent(publicPrivateEvent))
        .rejects
        .toThrow('Private events cannot have PUBLIC data classification');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});