import { z } from 'zod'; // v3.22.0

// Supported social platform types
export const socialPlatformEnum = ['LINKEDIN', 'GMAIL'] as const;

// Schema for social platform validation
export const socialPlatformSchema = z.enum(socialPlatformEnum).describe('Social platform type').openapi({
  example: 'LINKEDIN'
});

// Base profile schema with PII validation
export const profileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens and apostrophes')
    .describe('Member full name'),
    
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email cannot exceed 255 characters')
    .regex(/^[^@]+@[^@]+\.[^@]+$/, 'Invalid email format')
    .describe('Member email address')
    .openapi({ 
      example: 'user@example.com',
      classification: 'CONFIDENTIAL'
    }),

  location: z.string()
    .min(2, 'Location must be at least 2 characters')
    .max(100, 'Location cannot exceed 100 characters')
    .describe('Member location')
    .optional(),

  bio: z.string()
    .max(500, 'Bio cannot exceed 500 characters')
    .describe('Member biography')
    .optional(),

  avatarUrl: z.string()
    .url('Invalid avatar URL')
    .max(2048, 'Avatar URL cannot exceed 2048 characters')
    .describe('Member avatar image URL')
    .optional(),
    
  metadata: z.record(z.string(), z.unknown())
    .describe('Additional profile metadata')
    .optional()
}).strict();

// Social profile schema with platform-specific validation
export const socialProfileSchema = z.object({
  platform: socialPlatformSchema,
  
  externalId: z.string()
    .min(1, 'External ID is required')
    .max(255, 'External ID cannot exceed 255 characters')
    .describe('Platform-specific user identifier'),
    
  profileUrl: z.string()
    .url('Invalid profile URL')
    .max(2048, 'Profile URL cannot exceed 2048 characters')
    .describe('Social profile URL')
    .optional(),
    
  authData: z.object({
    accessToken: z.string()
      .min(1, 'Access token is required')
      .describe('OAuth access token'),
      
    refreshToken: z.string()
      .min(1, 'Refresh token is required')
      .describe('OAuth refresh token'),
      
    expiresAt: z.number()
      .int('Expiration must be an integer timestamp')
      .describe('Token expiration timestamp')
  }).strict()
  .describe('OAuth authentication data')
  .openapi({ classification: 'RESTRICTED' }),
  
  verified: z.boolean()
    .default(false)
    .describe('Profile verification status'),
    
  lastSyncedAt: z.date()
    .describe('Last profile sync timestamp')
    .optional()
}).strict();

// Comprehensive member schema
export const memberSchema = z.object({
  id: z.string()
    .uuid('Invalid member ID format')
    .describe('Unique member identifier'),
    
  profile: profileSchema,
  
  socialProfiles: z.array(socialProfileSchema)
    .max(10, 'Cannot exceed 10 social profiles')
    .describe('Connected social profiles'),
    
  createdAt: z.date()
    .describe('Member creation timestamp'),
    
  updatedAt: z.date()
    .describe('Last update timestamp'),
    
  isActive: z.boolean()
    .default(true)
    .describe('Member active status'),
    
  roles: z.array(z.enum(['ADMIN', 'MEMBER', 'ANALYST']))
    .min(1, 'At least one role is required')
    .describe('Member roles'),
    
  entityConfidence: z.number()
    .min(0, 'Confidence score must be between 0 and 1')
    .max(1, 'Confidence score must be between 0 and 1')
    .describe('Entity resolution confidence score')
    .optional()
}).strict();

// Schema for member creation
export const createMemberSchema = memberSchema.omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
  entityConfidence: true 
}).extend({
  socialProfiles: z.array(socialProfileSchema)
    .min(1, 'At least one social profile is required')
});

// Schema for member updates
export const updateMemberSchema = memberSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Schema for entity resolution
export const resolveMemberEntitySchema = z.object({
  sourceId: z.string()
    .uuid('Invalid source member ID')
    .describe('Source member identifier'),
    
  targetId: z.string()
    .uuid('Invalid target member ID')
    .describe('Target member identifier'),
    
  confidence: z.number()
    .min(0, 'Confidence score must be between 0 and 1')
    .max(1, 'Confidence score must be between 0 and 1')
    .describe('Entity resolution confidence score'),
    
  matchedAttributes: z.array(z.string())
    .min(1, 'At least one matched attribute is required')
    .describe('List of attributes that matched between entities'),
    
  resolution: z.enum(['MERGE', 'KEEP_SEPARATE', 'NEEDS_REVIEW'])
    .describe('Entity resolution decision')
}).strict();