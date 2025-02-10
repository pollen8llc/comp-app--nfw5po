import { z } from 'zod'; // v3.22.0
import type { Member, Profile, SocialProfile } from '../types/members';
import type { Event, EventPlatform, ImportEventsInput } from '../types/events';
import type { APIError, ValidationError } from '../types/api';

// Constants for validation rules
const CONSTANTS = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  TITLE_MIN_LENGTH: 3,
  TITLE_MAX_LENGTH: 200,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: ['csv', 'xlsx', 'json'] as const,
  URL_PATTERN: /^https:\/\/([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/,
  EMAIL_PATTERN: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  XSS_PATTERNS: [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, /javascript:/gi, /on\w+=/gi],
} as const;

/**
 * Enhanced validation result interface with warnings
 */
export interface ValidationResult {
  success: boolean;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
}

/**
 * Base schema for social profile URLs with security checks
 */
const socialUrlSchema = z.string()
  .url()
  .regex(CONSTANTS.URL_PATTERN)
  .refine(url => url.startsWith('https://'), {
    message: 'Only HTTPS URLs are allowed'
  });

/**
 * Enhanced member profile schema with strict validation
 */
export const memberProfileSchema = z.object({
  name: z.string()
    .min(CONSTANTS.NAME_MIN_LENGTH, 'Name is too short')
    .max(CONSTANTS.NAME_MAX_LENGTH, 'Name is too long')
    .regex(/^[\p{L}\s'-]+$/u, 'Name contains invalid characters')
    .transform(str => str.trim()),
  
  email: z.string()
    .email('Invalid email format')
    .regex(CONSTANTS.EMAIL_PATTERN, 'Email format is invalid')
    .transform(str => str.toLowerCase()),
  
  location: z.string()
    .optional()
    .transform(str => str?.trim()),
  
  role: z.enum(['ADMIN', 'MEMBER', 'ANALYST']),
  
  socialProfiles: z.array(z.object({
    platform: z.enum(['LINKEDIN', 'GMAIL']),
    externalId: z.string(),
    verified: z.boolean(),
    lastSynced: z.date()
  })).optional()
});

/**
 * Enhanced event schema with comprehensive validation
 */
export const eventSchema = z.object({
  title: z.string()
    .min(CONSTANTS.TITLE_MIN_LENGTH, 'Title is too short')
    .max(CONSTANTS.TITLE_MAX_LENGTH, 'Title is too long')
    .transform(str => str.trim()),
  
  description: z.string()
    .optional()
    .transform(str => str?.trim()),
  
  start_date: z.date()
    .refine(date => date > new Date(), 'Start date must be in the future'),
  
  end_date: z.date()
    .refine(date => date > new Date(), 'End date must be in the future'),
  
  location: z.string()
    .min(1, 'Location is required')
    .transform(str => str.trim()),
  
  metadata: z.object({
    tags: z.record(z.string()),
    categories: z.array(z.string()),
    capacity: z.number()
      .int('Capacity must be an integer')
      .min(1, 'Capacity must be positive'),
    is_private: z.boolean()
  })
});

/**
 * Enhanced import configuration schema with strict validation
 */
export const importConfigSchema = z.object({
  platform: z.enum(['LUMA', 'EVENTBRITE', 'PARTIFUL']),
  
  api_key: z.string()
    .min(16, 'API key is too short')
    .regex(/^[A-Za-z0-9_-]+$/, 'API key contains invalid characters'),
  
  date_range: z.object({
    start_date: z.date(),
    end_date: z.date()
  }).refine(({ start_date, end_date }) => end_date > start_date, {
    message: 'End date must be after start date'
  }),
  
  file_config: z.object({
    type: z.enum(CONSTANTS.ALLOWED_FILE_TYPES),
    size: z.number()
      .max(CONSTANTS.MAX_FILE_SIZE, 'File size exceeds limit'),
    name: z.string()
      .regex(/^[\w\-. ]+$/, 'Invalid file name')
  }).optional()
});

/**
 * Sanitizes input string against XSS attacks
 */
const sanitizeInput = (input: string): string => {
  let sanitized = input;
  CONSTANTS.XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  return sanitized;
};

/**
 * Validates member profile data with enhanced security checks
 */
export async function validateMemberProfile(profile: Profile): Promise<ValidationResult> {
  const result: ValidationResult = {
    success: true,
    errors: {},
    warnings: {}
  };

  try {
    // Sanitize text inputs
    const sanitizedProfile = {
      ...profile,
      name: sanitizeInput(profile.name),
      email: sanitizeInput(profile.email),
      location: profile.location ? sanitizeInput(profile.location) : undefined
    };

    // Validate against schema
    await memberProfileSchema.parseAsync(sanitizedProfile);

    // Additional security checks
    if (profile.name !== sanitizedProfile.name) {
      result.warnings.name = ['Potentially unsafe characters were removed'];
    }

    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.success = false;
      result.errors = error.errors.reduce((acc, err) => {
        const path = err.path.join('.');
        acc[path] = acc[path] || [];
        acc[path].push(err.message);
        return acc;
      }, {} as Record<string, string[]>);
    }
    return result;
  }
}

/**
 * Validates event data with enhanced checks
 */
export async function validateEventData(event: Event): Promise<ValidationResult> {
  const result: ValidationResult = {
    success: true,
    errors: {},
    warnings: {}
  };

  try {
    // Sanitize text inputs
    const sanitizedEvent = {
      ...event,
      title: sanitizeInput(event.title),
      description: event.description ? sanitizeInput(event.description) : undefined,
      location: sanitizeInput(event.location)
    };

    // Validate against schema
    await eventSchema.parseAsync(sanitizedEvent);

    // Additional date validation
    if (event.end_date.getTime() - event.start_date.getTime() > 30 * 24 * 60 * 60 * 1000) {
      result.warnings.date_range = ['Event duration exceeds 30 days'];
    }

    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.success = false;
      result.errors = error.errors.reduce((acc, err) => {
        const path = err.path.join('.');
        acc[path] = acc[path] || [];
        acc[path].push(err.message);
        return acc;
      }, {} as Record<string, string[]>);
    }
    return result;
  }
}

/**
 * Validates import configuration with comprehensive checks
 */
export async function validateImportConfig(config: ImportEventsInput): Promise<ValidationResult> {
  const result: ValidationResult = {
    success: true,
    errors: {},
    warnings: {}
  };

  try {
    // Validate against schema
    await importConfigSchema.parseAsync(config);

    // Additional platform-specific validation
    if (config.platform === EventPlatform.LUMA && !config.api_key.startsWith('luma_')) {
      result.errors.api_key = ['Invalid Luma API key format'];
    }

    // Date range validation
    const dateRange = (config.end_date.getTime() - config.start_date.getTime()) / (24 * 60 * 60 * 1000);
    if (dateRange > 90) {
      result.warnings.date_range = ['Import range exceeds 90 days'];
    }

    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.success = false;
      result.errors = error.errors.reduce((acc, err) => {
        const path = err.path.join('.');
        acc[path] = acc[path] || [];
        acc[path].push(err.message);
        return acc;
      }, {} as Record<string, string[]>);
    }
    return result;
  }
}