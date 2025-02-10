import axios, { AxiosInstance } from 'axios'; // v1.6.0
import { z } from 'zod'; // v3.22.0
import { Event, EventPlatform, ImportEventsInput, DataClassification } from '../../shared/types/event.types';
import { EventModel } from '../models/event.model';

/**
 * Service for integrating with Eventbrite API with enhanced error handling,
 * rate limiting, and data validation
 */
export class EventbriteService {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://www.eventbriteapi.com/v3';
  private readonly client: AxiosInstance;
  private readonly rateLimitDelay: number = 100; // ms between requests
  private readonly maxRetries: number = 3;
  
  // Zod schema for Eventbrite event validation
  private readonly eventSchema = z.object({
    id: z.string(),
    name: z.object({ text: z.string() }),
    description: z.object({ text: z.string() }).optional(),
    start: z.object({ utc: z.string() }),
    end: z.object({ utc: z.string() }),
    venue: z.object({
      address: z.object({
        localized_address_display: z.string()
      })
    }),
    capacity: z.number(),
    is_private: z.boolean(),
    category_id: z.string().optional(),
    subcategory_id: z.string().optional()
  });

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    
    // Initialize axios client with auth and timeout
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Add request interceptor for rate limiting
    this.client.interceptors.request.use(async (config) => {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 60;
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return this.client.request(error.config);
        }
        throw error;
      }
    );
  }

  /**
   * Imports events from Eventbrite with enhanced error handling and validation
   */
  public async importEvents(importConfig: ImportEventsInput): Promise<Event[]> {
    try {
      const events: Event[] = [];
      let continuationToken: string | null = null;
      let retryCount = 0;

      do {
        try {
          const queryParams = {
            start_date: importConfig.start_date.toISOString(),
            end_date: importConfig.end_date.toISOString(),
            continuation: continuationToken
          };

          const response = await this.client.get('/organizations/me/events', {
            params: queryParams
          });

          const rawEvents = response.data.events;
          continuationToken = response.data.pagination?.continuation;

          for (const rawEvent of rawEvents) {
            if (this.validateEventbriteEvent(rawEvent)) {
              const event = await this.transformEventbriteEvent(rawEvent);
              events.push(event);
            }
          }

          retryCount = 0;
        } catch (error) {
          retryCount++;
          if (retryCount >= this.maxRetries) {
            throw new Error(`Failed to fetch events after ${this.maxRetries} retries: ${error.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      } while (continuationToken);

      return events;
    } catch (error) {
      throw new Error(`Event import failed: ${error.message}`);
    }
  }

  /**
   * Validates Eventbrite event data with enhanced checks
   */
  private validateEventbriteEvent(eventbriteEvent: any): boolean {
    try {
      this.eventSchema.parse(eventbriteEvent);
      
      // Additional validation checks
      const startDate = new Date(eventbriteEvent.start.utc);
      const endDate = new Date(eventbriteEvent.end.utc);
      
      if (endDate <= startDate) {
        return false;
      }

      if (!eventbriteEvent.venue?.address?.localized_address_display) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Transforms Eventbrite event with enhanced normalization
   */
  private async transformEventbriteEvent(eventbriteEvent: any): Promise<Event> {
    const categories = await this.fetchEventCategories(
      eventbriteEvent.category_id,
      eventbriteEvent.subcategory_id
    );

    const eventData = {
      id: `eventbrite_${eventbriteEvent.id}`,
      title: eventbriteEvent.name.text,
      description: eventbriteEvent.description?.text,
      start_date: new Date(eventbriteEvent.start.utc),
      end_date: new Date(eventbriteEvent.end.utc),
      location: eventbriteEvent.venue.address.localized_address_display,
      platform: EventPlatform.EVENTBRITE,
      external_id: eventbriteEvent.id,
      metadata: {
        tags: this.extractTags(eventbriteEvent),
        categories,
        capacity: eventbriteEvent.capacity,
        is_private: eventbriteEvent.is_private,
        dataClassification: eventbriteEvent.is_private ? 
          DataClassification.CONFIDENTIAL : 
          DataClassification.PUBLIC,
        lastModifiedBy: 'eventbrite_sync',
        lastModifiedAt: new Date()
      },
      participants: [],
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'eventbrite_sync',
      updated_by: 'eventbrite_sync'
    };

    return new EventModel(eventData).toJSON();
  }

  /**
   * Fetches event categories from Eventbrite
   */
  private async fetchEventCategories(categoryId?: string, subcategoryId?: string): Promise<string[]> {
    const categories: string[] = [];

    if (categoryId) {
      try {
        const response = await this.client.get(`/categories/${categoryId}`);
        categories.push(response.data.name);
      } catch {
        // Ignore category fetch errors
      }
    }

    if (subcategoryId) {
      try {
        const response = await this.client.get(`/subcategories/${subcategoryId}`);
        categories.push(response.data.name);
      } catch {
        // Ignore subcategory fetch errors
      }
    }

    return categories;
  }

  /**
   * Extracts tags from Eventbrite event data
   */
  private extractTags(eventbriteEvent: any): Record<string, string> {
    const tags: Record<string, string> = {};

    if (eventbriteEvent.format_id) {
      tags['format'] = eventbriteEvent.format_id;
    }

    if (eventbriteEvent.status) {
      tags['status'] = eventbriteEvent.status;
    }

    if (eventbriteEvent.online_event) {
      tags['type'] = 'online';
    } else {
      tags['type'] = 'in-person';
    }

    return tags;
  }
}