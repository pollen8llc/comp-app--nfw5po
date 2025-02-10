import { z } from 'zod'; // v3.22.0
import { EventPlatform } from '../types/event.types';

/**
 * Schema for event metadata validation with security classifications
 * Implements data classification requirements from section 7.2.2
 */
export const eventMetadataSchema = z.object({
  tags: z.record(z.string(), z.string())
    .describe('Key-value pairs for event categorization and filtering')
    .refine(tags => Object.keys(tags).length <= 20, {
      message: 'Maximum of 20 tags allowed per event'
    }),
  
  categories: z.array(z.string())
    .min(1, 'At least one category is required')
    .max(5, 'Maximum of 5 categories allowed')
    .refine(cats => cats.every(cat => cat.length <= 50), {
      message: 'Category names must not exceed 50 characters'
    }),
  
  capacity: z.number().int().positive()
    .max(10000, 'Maximum capacity is 10000')
    .describe('Maximum number of participants allowed'),
  
  is_private: z.boolean()
    .describe('Indicates if the event is private/invitation-only'),
  
  version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning')
    .describe('Metadata version for tracking schema changes')
});

/**
 * Schema for complete event data validation
 * Implements event integration requirements from section 1.3
 */
export const eventSchema = z.object({
  id: z.string().uuid()
    .describe('Unique identifier for the event'),
  
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must not exceed 200 characters')
    .describe('Event title'),
  
  description: z.string()
    .max(2000, 'Description must not exceed 2000 characters')
    .optional()
    .describe('Detailed event description'),
  
  start_date: z.date()
    .min(new Date(), 'Start date must be in the future')
    .describe('Event start date and time'),
  
  end_date: z.date()
    .describe('Event end date and time')
    .refine(date => date > new Date(), {
      message: 'End date must be in the future'
    }),
  
  location: z.string()
    .min(1, 'Location is required')
    .describe('Event location or venue'),
  
  platform: z.nativeEnum(EventPlatform)
    .describe('Source platform for the event'),
  
  external_id: z.string()
    .optional()
    .describe('Platform-specific event identifier'),
  
  metadata: eventMetadataSchema
    .describe('Additional event metadata and classifications'),
  
  created_at: z.date()
    .describe('Timestamp of event creation'),
  
  updated_at: z.date()
    .describe('Timestamp of last update'),
  
  created_by: z.string().uuid()
    .describe('ID of user who created the event')
}).refine(data => data.end_date > data.start_date, {
  message: 'End date must be after start date',
  path: ['end_date']
});

/**
 * Schema for event creation input validation
 * Implements core event management requirements
 */
export const createEventSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must not exceed 200 characters'),
  
  description: z.string()
    .max(2000, 'Description must not exceed 2000 characters')
    .optional(),
  
  start_date: z.date()
    .min(new Date(), 'Start date must be in the future'),
  
  end_date: z.date()
    .refine(date => date > new Date(), {
      message: 'End date must be in the future'
    }),
  
  location: z.string()
    .min(1, 'Location is required'),
  
  metadata: eventMetadataSchema
}).refine(data => data.end_date > data.start_date, {
  message: 'End date must be after start date',
  path: ['end_date']
});

/**
 * Schema for event import configuration validation
 * Implements event platform integration requirements with strict security controls
 */
export const importEventsSchema = z.object({
  platform: z.nativeEnum(EventPlatform)
    .describe('Platform to import events from'),
  
  api_key: z.string()
    .min(32, 'API key must be at least 32 characters')
    .max(256, 'API key must not exceed 256 characters')
    .describe('Platform-specific API key'),
  
  start_date: z.date()
    .min(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), 'Cannot import events older than 1 year')
    .describe('Start date for event import range'),
  
  end_date: z.date()
    .max(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'Cannot import events more than 1 year in future')
    .describe('End date for event import range'),
  
  batch_size: z.number().int()
    .min(1, 'Batch size must be at least 1')
    .max(100, 'Batch size must not exceed 100')
    .default(50)
    .describe('Number of events to process per batch'),
  
  retry_attempts: z.number().int()
    .min(1, 'Must have at least 1 retry attempt')
    .max(5, 'Maximum 5 retry attempts allowed')
    .default(3)
    .describe('Number of retry attempts for failed imports')
}).refine(data => data.end_date > data.start_date, {
  message: 'End date must be after start date',
  path: ['end_date']
});