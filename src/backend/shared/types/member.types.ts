import { z } from 'zod'; // v3.22.0

/**
 * Supported social platform types for member profiles
 */
export type SocialPlatform = 'LINKEDIN' | 'GMAIL';

/**
 * Data classification levels for member information security
 */
export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

/**
 * Branded type for entity confidence level to ensure type safety
 */
export type EntityConfidenceLevel = number & { _brand: 'EntityConfidence' };

/**
 * Interface defining member profile information with data classification
 * Implements PII protection requirements through data classification
 */
export interface Profile {
  name: string;
  email: string;
  location?: string;
  bio?: string;
  dataClassification: DataClassification;
}

/**
 * Interface for member's social platform profile data
 * Includes verification and sync status for platform integration
 */
export interface SocialProfile {
  platform: SocialPlatform;
  externalId: string;
  authData: Record<string, string>;
  verified: boolean;
  lastSynced: Date;
}

/**
 * Interface for tracking entity resolution status
 * Supports 95% accuracy requirement in entity disambiguation
 */
export interface EntityStatus {
  isResolved: boolean;
  confidence: EntityConfidenceLevel;
  lastResolutionDate: Date | null;
}

/**
 * Complete member data structure with activity tracking
 * Implements comprehensive member data management requirements
 */
export interface Member {
  id: string;
  profile: Profile;
  socialProfiles: SocialProfile[];
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
  entityStatus: EntityStatus;
}

/**
 * Type definition for member creation input data
 * Enforces required fields for new member creation
 */
export type CreateMemberInput = {
  profile: Profile;
  socialProfiles: SocialProfile[];
};

/**
 * Type definition for member update input data
 * Allows partial updates to member profile information
 */
export type UpdateMemberInput = {
  profile?: Partial<Profile>;
  socialProfiles?: SocialProfile[];
};

/**
 * Interface for member entity resolution input
 * Supports entity disambiguation process with confidence tracking
 */
export interface ResolveMemberEntityInput {
  sourceId: string;
  targetId: string;
  confidence: EntityConfidenceLevel;
  resolutionMetadata: Record<string, unknown>;
}

/**
 * Zod schema for runtime validation of member profile data
 */
export const profileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  location: z.string().optional(),
  bio: z.string().optional(),
  dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'])
});

/**
 * Zod schema for runtime validation of social profile data
 */
export const socialProfileSchema = z.object({
  platform: z.enum(['LINKEDIN', 'GMAIL']),
  externalId: z.string(),
  authData: z.record(z.string()),
  verified: z.boolean(),
  lastSynced: z.date()
});

/**
 * Zod schema for runtime validation of entity status
 */
export const entityStatusSchema = z.object({
  isResolved: z.boolean(),
  confidence: z.number().min(0).max(1),
  lastResolutionDate: z.date().nullable()
});

/**
 * Zod schema for runtime validation of complete member data
 */
export const memberSchema = z.object({
  id: z.string(),
  profile: profileSchema,
  socialProfiles: z.array(socialProfileSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastActivity: z.date(),
  entityStatus: entityStatusSchema
});