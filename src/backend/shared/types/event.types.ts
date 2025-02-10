import { z } from 'zod'; // v3.22.0
import { Member } from './member.types';

/**
 * Data classification levels for event information security
 */
export enum DataClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL'
}

/**
 * Supported event platforms for integration
 */
export enum EventPlatform {
  LUMA = 'LUMA',
  EVENTBRITE = 'EVENTBRITE',
  PARTIFUL = 'PARTIFUL'
}

/**
 * Event data validation status
 */
export enum EventValidationStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  FAILED = 'FAILED'
}

/**
 * Interface for event metadata with enhanced security and audit fields
 */
export interface EventMetadata {
  tags: Record<string, { value: string; validated: boolean }>;
  categories: string[];
  capacity: number;
  is_private: boolean;
  dataClassification: DataClassification;
  lastModifiedBy: string;
  lastModifiedAt: Date;
}

/**
 * Interface for comprehensive event data with enhanced audit and validation capabilities
 */
export interface Event {
  id: string;
  title: string;
  description?: string;
  start_date: Date;
  end_date: Date;
  location: string;
  platform: EventPlatform;
  external_id?: string;
  metadata: EventMetadata;
  participants: string[]; // Array of Member IDs
  validationStatus: EventValidationStatus;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
}

/**
 * Type definition for event creation input data
 */
export type CreateEventInput = {
  title: string;
  description?: string;
  start_date: Date;
  end_date: Date;
  location: string;
  metadata: EventMetadata;
};

/**
 * Interface for event import configuration from external platforms
 */
export interface ImportEventsInput {
  platform: EventPlatform;
  api_key: string;
  start_date: Date;
  end_date: Date;
}

/**
 * Interface for tracking event participation with role information
 */
export interface EventParticipation {
  event_id: string;
  member_id: string;
  role: string;
  joined_at: Date;
}

/**
 * Zod schema for runtime validation of event metadata
 */
export const eventMetadataSchema = z.object({
  tags: z.record(z.object({
    value: z.string(),
    validated: z.boolean()
  })),
  categories: z.array(z.string()),
  capacity: z.number().positive(),
  is_private: z.boolean(),
  dataClassification: z.nativeEnum(DataClassification),
  lastModifiedBy: z.string(),
  lastModifiedAt: z.date()
});

/**
 * Zod schema for runtime validation of event data
 */
export const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  start_date: z.date(),
  end_date: z.date(),
  location: z.string(),
  platform: z.nativeEnum(EventPlatform),
  external_id: z.string().optional(),
  metadata: eventMetadataSchema,
  participants: z.array(z.string()),
  validationStatus: z.nativeEnum(EventValidationStatus),
  created_at: z.date(),
  updated_at: z.date(),
  created_by: z.string(),
  updated_by: z.string()
});

/**
 * Zod schema for runtime validation of event creation input
 */
export const createEventInputSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  start_date: z.date(),
  end_date: z.date(),
  location: z.string(),
  metadata: eventMetadataSchema
});

/**
 * Zod schema for runtime validation of event import configuration
 */
export const importEventsInputSchema = z.object({
  platform: z.nativeEnum(EventPlatform),
  api_key: z.string(),
  start_date: z.date(),
  end_date: z.date()
});

/**
 * Zod schema for runtime validation of event participation
 */
export const eventParticipationSchema = z.object({
  event_id: z.string(),
  member_id: z.string(),
  role: z.string(),
  joined_at: z.date()
});