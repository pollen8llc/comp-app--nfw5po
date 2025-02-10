import { z } from 'zod'; // v3.22.0
import type { Profile, SocialProfile } from '../types/members';
import type { Event, EventPlatform } from '../types/events';
import type { GraphQueryPattern, NodeType, EdgeType } from '../types/graph';

// Memoized schema definitions for performance
const profileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s-']+$/, 'Name can only contain letters, spaces, hyphens and apostrophes'),
  email: z.string()
    .email('Invalid email format')
    .regex(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Email must be in a valid format'
    ),
  location: z.string()
    .min(2, 'Location must be at least 2 characters')
    .max(100, 'Location cannot exceed 100 characters')
    .optional(),
  role: z.enum(['ADMIN', 'MEMBER', 'ANALYST'], {
    errorMap: () => ({ message: 'Invalid role. Must be ADMIN, MEMBER, or ANALYST' })
  })
});

const eventSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters')
    .regex(/^[\w\s-',.!?&()]+$/, 'Title contains invalid characters'),
  description: z.string().max(2000).optional(),
  start_date: z.date()
    .refine(date => date > new Date(), 'Start date must be in the future'),
  end_date: z.date()
    .refine(date => date > new Date(), 'End date must be in the future'),
  location: z.string()
    .min(2, 'Location must be at least 2 characters')
    .max(200, 'Location cannot exceed 200 characters'),
  platform: z.nativeEnum(EventPlatform),
  metadata: z.object({
    tags: z.record(z.string()),
    categories: z.array(z.string()),
    capacity: z.number().int().min(1),
    is_private: z.boolean()
  })
}).refine(
  data => data.end_date > data.start_date,
  'End date must be after start date'
);

const graphQuerySchema = z.object({
  nodes: z.array(z.object({
    type: z.nativeEnum(NodeType),
    conditions: z.record(z.unknown()).optional()
  })).min(1, 'Query must include at least one node'),
  relationships: z.array(z.object({
    type: z.nativeEnum(EdgeType),
    direction: z.enum(['incoming', 'outgoing', 'both'])
  })),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'contains', 'startsWith', 'endsWith', 'gt', 'lt', 'gte', 'lte']),
    value: z.unknown()
  })),
  limit: z.number()
    .int()
    .min(1)
    .max(1000, 'Query result limit cannot exceed 1000')
});

const socialProfileSchema = z.object({
  platform: z.enum(['LINKEDIN', 'GMAIL'], {
    errorMap: () => ({ message: 'Unsupported social platform' })
  }),
  externalId: z.string()
    .min(1, 'External ID is required')
    .max(100, 'External ID cannot exceed 100 characters'),
  verified: z.boolean(),
  lastSynced: z.date()
    .refine(
      date => date <= new Date(),
      'Last synced date cannot be in the future'
    )
});

/**
 * Validates member profile data against schema
 * @param profile - Profile data to validate
 * @returns Object containing validation success status and any error messages
 */
export const validateProfile = (profile: Profile): { 
  success: boolean; 
  errors?: string[] 
} => {
  try {
    profileSchema.parse(profile);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => err.message)
      };
    }
    return {
      success: false,
      errors: ['An unexpected validation error occurred']
    };
  }
};

/**
 * Validates event data against schema
 * @param event - Event data to validate
 * @returns Object containing validation success status and any error messages
 */
export const validateEvent = (event: Event): {
  success: boolean;
  errors?: string[]
} => {
  try {
    eventSchema.parse(event);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => err.message)
      };
    }
    return {
      success: false,
      errors: ['An unexpected validation error occurred']
    };
  }
};

/**
 * Validates graph query pattern against schema
 * @param queryPattern - Graph query pattern to validate
 * @returns Object containing validation success status and any error messages
 */
export const validateGraphQuery = (queryPattern: GraphQueryPattern): {
  success: boolean;
  errors?: string[]
} => {
  try {
    graphQuerySchema.parse(queryPattern);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => err.message)
      };
    }
    return {
      success: false,
      errors: ['An unexpected validation error occurred']
    };
  }
};

/**
 * Validates social profile data against schema
 * @param socialProfile - Social profile data to validate
 * @returns Object containing validation success status and any error messages
 */
export const validateSocialProfile = (socialProfile: SocialProfile): {
  success: boolean;
  errors?: string[]
} => {
  try {
    socialProfileSchema.parse(socialProfile);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => err.message)
      };
    }
    return {
      success: false,
      errors: ['An unexpected validation error occurred']
    };
  }
};