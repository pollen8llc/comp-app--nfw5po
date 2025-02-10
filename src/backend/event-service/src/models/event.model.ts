import { z } from 'zod'; // v3.22.0
import { CacheManager } from '@nestjs/cache-manager'; // v2.0.0
import { RateLimiter } from '@nestjs/throttler'; // v5.0.0
import { Logger } from '@nestjs/common'; // v10.0.0

import { Event, EventPlatform, DataClassification } from '../../shared/types/event.types';
import { eventSchema } from '../../shared/schemas/event.schema';
import { EventMetadataModel } from './event-metadata.model';

/**
 * Model class for handling events with comprehensive validation, caching,
 * rate limiting, and graph database integration.
 * Implements requirements from sections 1.3, 2.2.4, and 7.2.2
 */
export class EventModel {
  private readonly id: string;
  private readonly title: string;
  private readonly description?: string;
  private readonly start_date: Date;
  private readonly end_date: Date;
  private readonly location: string;
  private readonly platform: EventPlatform;
  private readonly external_id?: string;
  private readonly metadata: EventMetadataModel;
  private participants: string[];
  private readonly created_at: Date;
  private updated_at: Date;

  private readonly cacheManager: CacheManager;
  private readonly rateLimiter: RateLimiter;
  private readonly logger: Logger;

  /**
   * Creates a new event instance with comprehensive validation and security checks
   * @param data The event input data
   * @throws {Error} If validation fails or security constraints are not met
   */
  constructor(data: Event) {
    // Initialize utilities
    this.cacheManager = new CacheManager({
      ttl: 3600, // 1 hour cache TTL
      max: 1000 // Maximum cache items
    });
    this.rateLimiter = new RateLimiter({
      ttl: 60,
      limit: 100 // 100 operations per minute
    });
    this.logger = new Logger('EventModel');

    try {
      // Validate input data
      const validatedData = eventSchema.parse(data);

      // Initialize event properties
      this.id = validatedData.id;
      this.title = this.sanitizeInput(validatedData.title);
      this.description = validatedData.description ? 
        this.sanitizeInput(validatedData.description) : undefined;
      this.start_date = validatedData.start_date;
      this.end_date = validatedData.end_date;
      this.location = this.sanitizeInput(validatedData.location);
      this.platform = validatedData.platform;
      this.external_id = validatedData.external_id;
      
      // Initialize metadata with enhanced security
      this.metadata = new EventMetadataModel(validatedData.metadata);
      
      // Initialize timestamps and participants
      this.created_at = validatedData.created_at || new Date();
      this.updated_at = validatedData.updated_at || new Date();
      this.participants = validatedData.participants || [];

      // Log event creation
      this.logger.log(`Event created: ${this.id}`);
    } catch (error) {
      this.logger.error(`Event creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Converts the event to a secure JSON representation
   * @returns Sanitized JSON representation of event
   */
  public toJSON(): Event {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      start_date: this.start_date,
      end_date: this.end_date,
      location: this.location,
      platform: this.platform,
      external_id: this.external_id,
      metadata: this.metadata.toJSON(),
      participants: [...this.participants],
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Transforms event to optimized Neo4j node properties
   * @returns Neo4j optimized property object
   */
  public toNeo4j(): Record<string, any> {
    return {
      _id: this.id,
      _type: 'Event',
      title: this.title,
      description: this.description,
      start_date: this.start_date.toISOString(),
      end_date: this.end_date.toISOString(),
      location: this.location,
      platform: this.platform,
      external_id: this.external_id,
      metadata: this.metadata.toNeo4j(),
      participants: this.participants,
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString()
    };
  }

  /**
   * Adds a participant with rate limiting and cache management
   * @param memberId The ID of the member to add
   * @throws {Error} If rate limit exceeded or validation fails
   */
  public async addParticipant(memberId: string): Promise<void> {
    try {
      // Check rate limit
      await this.rateLimiter.checkLimit(`participant_add_${this.id}`);

      // Validate member ID
      if (!this.isValidUUID(memberId)) {
        throw new Error('Invalid member ID format');
      }

      // Check if member already exists
      if (this.participants.includes(memberId)) {
        throw new Error('Member already added to event');
      }

      // Add member and update timestamp
      this.participants.push(memberId);
      this.updated_at = new Date();

      // Invalidate relevant caches
      await this.cacheManager.del(`event_${this.id}`);
      await this.cacheManager.del(`event_participants_${this.id}`);

      this.logger.log(`Participant added to event ${this.id}: ${memberId}`);
    } catch (error) {
      this.logger.error(`Failed to add participant: ${error.message}`);
      throw error;
    }
  }

  /**
   * Removes a participant with rate limiting and cache management
   * @param memberId The ID of the member to remove
   * @throws {Error} If rate limit exceeded or validation fails
   */
  public async removeParticipant(memberId: string): Promise<void> {
    try {
      // Check rate limit
      await this.rateLimiter.checkLimit(`participant_remove_${this.id}`);

      // Validate member ID
      if (!this.isValidUUID(memberId)) {
        throw new Error('Invalid member ID format');
      }

      // Remove member and update timestamp
      const index = this.participants.indexOf(memberId);
      if (index === -1) {
        throw new Error('Member not found in event');
      }

      this.participants.splice(index, 1);
      this.updated_at = new Date();

      // Invalidate relevant caches
      await this.cacheManager.del(`event_${this.id}`);
      await this.cacheManager.del(`event_participants_${this.id}`);

      this.logger.log(`Participant removed from event ${this.id}: ${memberId}`);
    } catch (error) {
      this.logger.error(`Failed to remove participant: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validates the event data with comprehensive error handling
   * @returns Promise resolving to validation result
   * @throws {Error} If validation fails with detailed context
   */
  public async validate(): Promise<boolean> {
    try {
      // Validate basic event data
      eventSchema.parse(this.toJSON());

      // Validate metadata
      await this.metadata.validate();

      // Validate date constraints
      if (this.end_date <= this.start_date) {
        throw new Error('End date must be after start date');
      }

      // Validate participant list
      if (!this.participants.every(id => this.isValidUUID(id))) {
        throw new Error('Invalid participant ID format detected');
      }

      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Sanitizes input strings for security
   * @param input String to sanitize
   * @returns Sanitized string
   */
  private sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 2000); // Limit string length
  }

  /**
   * Validates UUID format
   * @param id String to validate as UUID
   * @returns boolean indicating if string is valid UUID
   */
  private isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}