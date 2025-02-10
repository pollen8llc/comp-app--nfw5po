import axios, { AxiosInstance, AxiosError } from 'axios'; // v1.4.0
import { Logger } from 'winston'; // v3.10.0
import CircuitBreaker from 'opossum'; // v6.0.0
import { RateLimiter } from 'rate-limiter-flexible'; // v2.4.1
import { Event, EventPlatform, ImportEventsInput, DataClassification } from '../../../shared/types/event.types';
import { EventModel } from '../models/event.model';

/**
 * Interface for Luma API event response
 */
interface LumaEventResponse {
  id: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  location: {
    name: string;
    address?: string;
  };
  capacity: number;
  isPrivate: boolean;
  metadata: Record<string, any>;
}

/**
 * Service class for Luma API integration with comprehensive error handling,
 * rate limiting, and security features
 */
export class LumaService {
  private readonly baseUrl: string = 'https://api.lu.ma/v1';
  private readonly apiClient: AxiosInstance;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly timeout: number = 10000;
  private readonly maxRetries: number = 3;

  constructor(
    private readonly apiKey: string,
    private readonly logger: Logger,
    private readonly rateLimiter: RateLimiter,
    circuitOptions: CircuitBreaker.Options = {
      timeout: 10000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    }
  ) {
    // Initialize axios client with security headers
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Community-Platform/1.0',
        'X-Request-ID': ''
      }
    });

    // Initialize circuit breaker for API resilience
    this.circuitBreaker = new CircuitBreaker(
      async (operation: () => Promise<any>) => operation(),
      circuitOptions
    );

    // Set up circuit breaker event handlers
    this.setupCircuitBreakerEvents();
  }

  /**
   * Imports events from Luma within a specified date range
   * @param input Import configuration parameters
   * @returns Array of validated and transformed events
   */
  public async importEvents(input: ImportEventsInput): Promise<Event[]> {
    try {
      // Validate input parameters
      if (!input.start_date || !input.end_date) {
        throw new Error('Start and end dates are required');
      }

      // Check rate limits
      await this.rateLimiter.consume('luma_import', 1);

      // Format date range for Luma API
      const params = {
        start_time: input.start_date.toISOString(),
        end_time: input.end_date.toISOString(),
        limit: 100
      };

      // Execute API request through circuit breaker
      const response = await this.circuitBreaker.fire(async () => {
        return this.apiClient.get<LumaEventResponse[]>('/events', { params });
      });

      // Transform and validate events
      const events: Event[] = await Promise.all(
        response.data.map(async (lumaEvent) => {
          const event = await this.transformLumaEvent(lumaEvent);
          const eventModel = new EventModel(event);
          await eventModel.validate();
          return event;
        })
      );

      this.logger.info(`Successfully imported ${events.length} events from Luma`);
      return events;

    } catch (error) {
      this.handleError('importEvents', error);
      throw error;
    }
  }

  /**
   * Retrieves a single event from Luma by ID
   * @param eventId Luma event ID
   * @returns Validated event data or null if not found
   */
  public async getEvent(eventId: string): Promise<Event | null> {
    try {
      // Validate event ID format
      if (!eventId.match(/^[a-zA-Z0-9-]+$/)) {
        throw new Error('Invalid event ID format');
      }

      // Check rate limits
      await this.rateLimiter.consume('luma_get_event', 1);

      // Execute API request through circuit breaker
      const response = await this.circuitBreaker.fire(async () => {
        return this.apiClient.get<LumaEventResponse>(`/events/${eventId}`);
      });

      // Transform and validate event
      const event = await this.transformLumaEvent(response.data);
      const eventModel = new EventModel(event);
      await eventModel.validate();

      return event;

    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        return null;
      }
      this.handleError('getEvent', error);
      throw error;
    }
  }

  /**
   * Transforms Luma event data to platform format with enhanced validation
   * @param lumaEvent Raw Luma event data
   * @returns Transformed and validated event
   */
  private async transformLumaEvent(lumaEvent: LumaEventResponse): Promise<Event> {
    const event: Event = {
      id: `luma_${lumaEvent.id}`,
      title: lumaEvent.name,
      description: lumaEvent.description,
      start_date: new Date(lumaEvent.startTime),
      end_date: new Date(lumaEvent.endTime),
      location: `${lumaEvent.location.name}${lumaEvent.location.address ? `, ${lumaEvent.location.address}` : ''}`,
      platform: EventPlatform.LUMA,
      external_id: lumaEvent.id,
      metadata: {
        tags: this.transformTags(lumaEvent.metadata?.tags || {}),
        categories: this.transformCategories(lumaEvent.metadata?.categories || []),
        capacity: lumaEvent.capacity,
        is_private: lumaEvent.isPrivate,
        dataClassification: this.determineDataClassification(lumaEvent),
        lastModifiedBy: 'luma_sync',
        lastModifiedAt: new Date()
      },
      participants: [],
      validationStatus: 'PENDING',
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'luma_sync',
      updated_by: 'luma_sync'
    };

    return event;
  }

  /**
   * Sets up circuit breaker event handlers for monitoring
   */
  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Luma API circuit breaker opened');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('Luma API circuit breaker half-opened');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Luma API circuit breaker closed');
    });

    this.circuitBreaker.on('fallback', () => {
      this.logger.error('Luma API fallback triggered');
    });
  }

  /**
   * Handles and logs errors with appropriate context
   * @param operation Name of the operation that failed
   * @param error Error object
   */
  private handleError(operation: string, error: any): void {
    const errorMessage = error instanceof AxiosError
      ? `${error.response?.status}: ${error.response?.data?.message || error.message}`
      : error.message;

    this.logger.error(`Luma API ${operation} failed: ${errorMessage}`, {
      operation,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Transforms Luma tags to platform format
   * @param tags Raw Luma tags
   * @returns Transformed tags object
   */
  private transformTags(tags: Record<string, any>): Record<string, { value: string; validated: boolean }> {
    const transformed: Record<string, { value: string; validated: boolean }> = {};
    for (const [key, value] of Object.entries(tags)) {
      transformed[key] = {
        value: String(value).substring(0, 100),
        validated: false
      };
    }
    return transformed;
  }

  /**
   * Transforms Luma categories to platform format
   * @param categories Raw Luma categories
   * @returns Transformed categories array
   */
  private transformCategories(categories: string[]): string[] {
    const validCategories = new Set([
      'conference', 'workshop', 'networking', 'social',
      'professional', 'education', 'other'
    ]);

    return categories
      .map(cat => cat.toLowerCase())
      .filter(cat => validCategories.has(cat))
      .slice(0, 5);
  }

  /**
   * Determines appropriate data classification based on event properties
   * @param lumaEvent Luma event data
   * @returns DataClassification level
   */
  private determineDataClassification(lumaEvent: LumaEventResponse): DataClassification {
    if (lumaEvent.isPrivate) {
      return DataClassification.CONFIDENTIAL;
    }
    return DataClassification.PUBLIC;
  }
}