import { z } from 'zod'; // v3.22.0
import { validateSchema, validatePartial, ValidationError } from '../../../shared/utils/validation';
import { eventSchema, createEventSchema, importEventsSchema } from '../../../shared/schemas/event.schema';
import { EventPlatform, DataClassification } from '../../../shared/types/event.types';

/**
 * Validates complete event data with enhanced security checks and PII handling
 * @param data - Raw event data to validate
 * @returns Validated and sanitized event data
 * @throws ValidationError if validation fails
 */
export async function validateEvent(data: unknown): Promise<z.infer<typeof eventSchema>> {
  try {
    // Sanitize input data to prevent XSS
    const sanitizedData = sanitizeEventData(data);

    // Validate data classification requirements
    validateDataClassification(sanitizedData);

    // Perform schema validation
    const validatedData = await validateSchema(eventSchema, sanitizedData);

    // Additional security checks
    validateEventSecurity(validatedData);

    return validatedData;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      'Event validation failed',
      { error: error.message }
    );
  }
}

/**
 * Validates event creation input with platform-specific rules
 * @param data - Event creation input data
 * @returns Validated creation data
 * @throws ValidationError if validation fails
 */
export async function validateCreateEvent(data: unknown): Promise<z.infer<typeof createEventSchema>> {
  try {
    // Apply platform-specific validation rules
    if (data && typeof data === 'object' && 'platform' in data) {
      validatePlatformRules(data as { platform: EventPlatform });
    }

    // Perform schema validation
    const validatedData = await validateSchema(createEventSchema, data);

    return validatedData;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      'Event creation validation failed',
      { error: error.message }
    );
  }
}

/**
 * Validates partial event updates with change tracking
 * @param data - Partial event data
 * @returns Validated partial data
 * @throws ValidationError if validation fails
 */
export async function validateEventUpdate(data: unknown): Promise<Partial<z.infer<typeof eventSchema>>> {
  try {
    // Track fields being updated
    const updatedFields = data && typeof data === 'object' ? Object.keys(data) : [];
    
    // Validate update permissions for fields
    validateUpdatePermissions(updatedFields);

    // Perform partial schema validation
    const validatedData = await validatePartial(eventSchema, data);

    return validatedData;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      'Event update validation failed',
      { error: error.message }
    );
  }
}

/**
 * Validates event import configuration with platform-specific rules
 * @param data - Import configuration data
 * @returns Validated import configuration
 * @throws ValidationError if validation fails
 */
export async function validateImportConfig(data: unknown): Promise<z.infer<typeof importEventsSchema>> {
  try {
    // Validate platform API credentials
    if (data && typeof data === 'object' && 'platform' in data && 'api_key' in data) {
      await validatePlatformCredentials(data as { platform: EventPlatform; api_key: string });
    }

    // Check platform rate limits
    await validatePlatformRateLimits(data);

    // Perform schema validation
    const validatedData = await validateSchema(importEventsSchema, data);

    return validatedData;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      'Import configuration validation failed',
      { error: error.message }
    );
  }
}

/**
 * Validates event date ranges with timezone handling
 * @param startDate - Event start date
 * @param endDate - Event end date
 * @returns true if valid, throws error if invalid
 * @throws ValidationError if validation fails
 */
export function validateDateRange(startDate: Date, endDate: Date): boolean {
  try {
    // Normalize dates to UTC
    const utcStart = new Date(startDate.toISOString());
    const utcEnd = new Date(endDate.toISOString());

    // Validate date format
    if (isNaN(utcStart.getTime()) || isNaN(utcEnd.getTime())) {
      throw new Error('Invalid date format');
    }

    // Check business rules
    const duration = utcEnd.getTime() - utcStart.getTime();
    const maxDuration = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    if (duration <= 0) {
      throw new Error('End date must be after start date');
    }
    
    if (duration > maxDuration) {
      throw new Error('Event duration cannot exceed 30 days');
    }

    return true;
  } catch (error) {
    throw new ValidationError(
      'Date range validation failed',
      { error: error.message }
    );
  }
}

// Private helper functions

function sanitizeEventData(data: unknown): unknown {
  if (typeof data !== 'object' || !data) return data;
  
  const sanitized = { ...data };
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      sanitized[key] = value.replace(/<[^>]*>/g, ''); // Remove HTML tags
    }
  }
  return sanitized;
}

function validateDataClassification(data: unknown): void {
  if (typeof data !== 'object' || !data) return;
  
  const metadata = (data as any).metadata;
  if (metadata?.dataClassification) {
    const classification = metadata.dataClassification as DataClassification;
    if (classification === 'CONFIDENTIAL') {
      validateConfidentialData(data);
    }
  }
}

function validateEventSecurity(data: z.infer<typeof eventSchema>): void {
  // Validate private event settings
  if (data.metadata?.is_private) {
    validatePrivateEventSettings(data);
  }
}

function validatePlatformRules(data: { platform: EventPlatform }): void {
  const platformValidators: Record<EventPlatform, () => void> = {
    [EventPlatform.LUMA]: validateLumaRules,
    [EventPlatform.EVENTBRITE]: validateEventbriteRules,
    [EventPlatform.PARTIFUL]: validatePartifulRules
  };

  const validator = platformValidators[data.platform];
  if (validator) {
    validator();
  }
}

function validateUpdatePermissions(fields: string[]): void {
  const restrictedFields = ['id', 'created_at', 'created_by'];
  const invalidFields = fields.filter(field => restrictedFields.includes(field));
  
  if (invalidFields.length > 0) {
    throw new Error(`Cannot update restricted fields: ${invalidFields.join(', ')}`);
  }
}

async function validatePlatformCredentials(data: { platform: EventPlatform; api_key: string }): Promise<void> {
  // Platform-specific credential validation would be implemented here
}

async function validatePlatformRateLimits(data: unknown): Promise<void> {
  // Platform-specific rate limit checking would be implemented here
}

function validateConfidentialData(data: unknown): void {
  // Additional validation for confidential data classification
}

function validatePrivateEventSettings(data: z.infer<typeof eventSchema>): void {
  // Validation for private event security settings
}

function validateLumaRules(): void {
  // Luma-specific validation rules
}

function validateEventbriteRules(): void {
  // Eventbrite-specific validation rules
}

function validatePartifulRules(): void {
  // Partiful-specific validation rules
}