import axios, { AxiosInstance } from 'axios'; // v1.6.0
import { z } from 'zod'; // v3.22.0
import { RateLimiter } from '@nestjs/throttler'; // v5.0.0
import { CircuitBreaker } from '@nestjs/circuit-breaker'; // v10.0.0
import { Logger } from '@nestjs/common'; // v10.0.0

import { EventModel } from '../models/event.model';
import { Event, EventPlatform } from '../../../shared/types/event.types';
import { validateSchema } from '../../../shared/utils/validation';
import { ERROR_CODES, BaseError } from '../../../shared/utils/error-codes';

// Constants
const PARTIFUL_API_BASE_URL = 'https://api.partiful.com/v1';
const PARTIFUL_API_VERSION = '1';
const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds

// Partiful API response schemas
const partifulEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  location: z.string(),
  capacity: z.number().int().positive(),
  isPrivate: z.boolean(),
  metadata: z.record(z.unknown()).optional()
});

const partifulEventsResponseSchema = z.object({
  events: z.array(partifulEventSchema),
  pagination: z.object({
    nextCursor: z.string().optional(),
    hasMore: z.boolean()
  })
});

/**
 * Service class for handling Partiful event platform integration
 * Implements requirements from sections 1.3 and 2.2.4
 */
export class PartifulService {
  private readonly client: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly logger: Logger;

  constructor(private readonly apiKey: string) {
    this.logger = new Logger(PartifulService.name);

    // Initialize HTTP client with security headers
    this.client = axios.create({
      baseURL: PARTIFUL_API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Version': PARTIFUL_API_VERSION,
        'User-Agent': 'Community-Platform/1.0',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    // Configure request interceptors
    this.client.interceptors.request.use(
      async config => {
        await this.rateLimiter.checkLimit('partiful_api');
        return config;
      },
      error => Promise.reject(error)
    );

    // Configure response interceptors
    this.client.interceptors.response.use(
      response => response,
      error => this.handleApiError(error)
    );

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter({
      ttl: RATE_LIMIT_WINDOW,
      limit: RATE_LIMIT_REQUESTS
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      timeout: 5000,
      maxFailures: 3,
      resetTimeout: 30000
    });
  }

  /**
   * Imports events from Partiful within a date range
   * @param startDate Start date for event import
   * @param endDate End date for event import
   * @returns Array of imported events
   */
  public async importEvents(startDate: Date, endDate: Date): Promise<Event[]> {
    try {
      const events: Event[] = [];
      let nextCursor: string | undefined;

      do {
        const response = await this.circuitBreaker.fire(() => 
          this.client.get('/events', {
            params: {
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              cursor: nextCursor,
              limit: 50
            }
          })
        );

        // Validate response data
        const validatedResponse = await validateSchema(
          partifulEventsResponseSchema,
          response.data
        );

        // Transform and validate each event
        for (const partifulEvent of validatedResponse.events) {
          const transformedEvent = await this.transformEvent(partifulEvent);
          const eventModel = new EventModel(transformedEvent);
          await eventModel.validate();
          events.push(transformedEvent);
        }

        nextCursor = validatedResponse.pagination.nextCursor;
      } while (nextCursor);

      this.logger.log(`Successfully imported ${events.length} events from Partiful`);
      return events;

    } catch (error) {
      this.logger.error(`Failed to import events from Partiful: ${error.message}`);
      throw new BaseError(
        ERROR_CODES.EVENT_IMPORT_ERROR,
        'Failed to import events from Partiful',
        { startDate, endDate },
        {
          component: 'PartifulService',
          service: 'event-service',
          additionalMetadata: { error: error.message }
        }
      );
    }
  }

  /**
   * Retrieves a single event from Partiful
   * @param eventId Partiful event ID
   * @returns Event details
   */
  public async getEvent(eventId: string): Promise<Event> {
    try {
      const response = await this.circuitBreaker.fire(() =>
        this.client.get(`/events/${eventId}`)
      );

      // Validate response data
      const validatedEvent = await validateSchema(
        partifulEventSchema,
        response.data
      );

      // Transform and validate event
      const transformedEvent = await this.transformEvent(validatedEvent);
      const eventModel = new EventModel(transformedEvent);
      await eventModel.validate();

      return transformedEvent;

    } catch (error) {
      this.logger.error(`Failed to get event from Partiful: ${error.message}`);
      throw new BaseError(
        ERROR_CODES.EVENT_IMPORT_ERROR,
        'Failed to get event from Partiful',
        { eventId },
        {
          component: 'PartifulService',
          service: 'event-service',
          additionalMetadata: { error: error.message }
        }
      );
    }
  }

  /**
   * Transforms Partiful event data to platform format
   * @param partifulEvent Event data from Partiful
   * @returns Transformed event data
   */
  private async transformEvent(partifulEvent: z.infer<typeof partifulEventSchema>): Promise<Event> {
    return {
      id: partifulEvent.id,
      title: partifulEvent.title,
      description: partifulEvent.description,
      start_date: new Date(partifulEvent.startTime),
      end_date: new Date(partifulEvent.endTime),
      location: partifulEvent.location,
      platform: EventPlatform.PARTIFUL,
      external_id: partifulEvent.id,
      metadata: {
        tags: {},
        categories: [],
        capacity: partifulEvent.capacity,
        is_private: partifulEvent.isPrivate,
        dataClassification: partifulEvent.isPrivate ? 'CONFIDENTIAL' : 'PUBLIC',
        lastModifiedBy: 'partiful-import',
        lastModifiedAt: new Date()
      },
      participants: [],
      validationStatus: 'PENDING',
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'partiful-import',
      updated_by: 'partiful-import'
    };
  }

  /**
   * Handles API errors with detailed error information
   * @param error Axios error object
   * @throws BaseError with appropriate error code and details
   */
  private handleApiError(error: any): never {
    const errorDetails = {
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers
    };

    if (error.response?.status === 429) {
      throw new BaseError(
        ERROR_CODES.RATE_LIMIT_ERROR,
        'Partiful API rate limit exceeded',
        errorDetails,
        { component: 'PartifulService', service: 'event-service' }
      );
    }

    if (error.response?.status === 401) {
      throw new BaseError(
        ERROR_CODES.AUTHENTICATION_ERROR,
        'Invalid Partiful API credentials',
        errorDetails,
        { component: 'PartifulService', service: 'event-service' }
      );
    }

    throw new BaseError(
      ERROR_CODES.EVENT_IMPORT_ERROR,
      'Partiful API request failed',
      errorDetails,
      { component: 'PartifulService', service: 'event-service' }
    );
  }
}