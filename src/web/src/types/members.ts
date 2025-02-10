import { z } from 'zod'; // v3.22.0

/**
 * Supported social platform integrations
 */
export type SocialPlatform = 'LINKEDIN' | 'GMAIL';

/**
 * Available member roles with corresponding access levels
 */
export type MemberRole = 'ADMIN' | 'MEMBER' | 'ANALYST';

/**
 * Generic paginated response interface for list operations
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Core member profile information with PII handling
 * @property name - Full name of the member
 * @property email - Unique email address (encrypted at rest)
 * @property location - Optional geographic location
 * @property role - Access control role
 */
export interface Profile {
  name: string;
  email: string;
  location?: string;
  role: MemberRole;
}

/**
 * Connected social platform profile data
 * @property platform - Integrated platform identifier
 * @property externalId - Platform-specific unique identifier
 * @property verified - Email/profile verification status
 * @property lastSynced - Latest synchronization timestamp
 */
export interface SocialProfile {
  platform: SocialPlatform;
  externalId: string;
  verified: boolean;
  lastSynced: Date;
}

/**
 * Complete member data structure including profile and integrations
 * @property id - Unique member identifier
 * @property profile - Core profile information
 * @property socialProfiles - Connected platform profiles
 * @property createdAt - Account creation timestamp
 * @property updatedAt - Latest update timestamp
 */
export interface Member {
  id: string;
  profile: Profile;
  socialProfiles: SocialProfile[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Paginated member list response type
 */
export type MemberListResponse = PaginatedResponse<Member>;

/**
 * Input type for member creation operations
 * Requires core profile data and optional social connections
 */
export type CreateMemberInput = {
  profile: Profile;
  socialProfiles?: SocialProfile[];
};

/**
 * Input type for member update operations
 * Supports partial profile updates and social connection management
 */
export type UpdateMemberInput = {
  profile?: Partial<Profile>;
  socialProfiles?: SocialProfile[];
};

/**
 * Filter parameters for member queries
 * Supports role-based, location-based, and platform-specific filtering
 */
export interface MemberFilterParams {
  role?: MemberRole;
  location?: string;
  platform?: SocialPlatform;
  search?: string;
}

/**
 * Zod schema for runtime validation of member profile data
 */
export const profileSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  location: z.string().optional(),
  role: z.enum(['ADMIN', 'MEMBER', 'ANALYST'])
});

/**
 * Zod schema for runtime validation of social profile data
 */
export const socialProfileSchema = z.object({
  platform: z.enum(['LINKEDIN', 'GMAIL']),
  externalId: z.string(),
  verified: z.boolean(),
  lastSynced: z.date()
});

/**
 * Zod schema for runtime validation of member filter parameters
 */
export const memberFilterSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'ANALYST']).optional(),
  location: z.string().optional(),
  platform: z.enum(['LINKEDIN', 'GMAIL']).optional(),
  search: z.string().optional()
});