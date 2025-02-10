/**
 * @fileoverview Type definitions for authentication-related interfaces and enums
 * @version 1.0.0
 */

/**
 * Enum defining available user roles for authorization
 * Based on the authorization matrix from technical specifications
 */
export enum UserRole {
  ADMIN = 'ADMIN',     // Full access to all features
  MEMBER = 'MEMBER',   // Self-only access with limited features
  ANALYST = 'ANALYST', // Read-only access with analytics capabilities
  GUEST = 'GUEST'      // No access, public features only
}

/**
 * Enum defining supported social login providers
 * Integrated with Clerk API for authentication
 */
export enum SocialProvider {
  LINKEDIN = 'LINKEDIN',
  GMAIL = 'GMAIL'
}

/**
 * Interface defining authenticated user data structure
 * Contains essential user information retrieved from Clerk API
 */
export interface AuthUser {
  /** Unique identifier for the user */
  id: string;
  
  /** User's email address */
  email: string;
  
  /** User's assigned role for authorization */
  role: UserRole;
  
  /** User's first name */
  firstName: string;
  
  /** User's last name */
  lastName: string;
  
  /** URL to user's profile image */
  profileImageUrl: string;
}

/**
 * Interface defining authentication session data structure
 * Implements session management requirements with token lifecycle
 */
export interface AuthSession {
  /** JWT token for API authentication */
  token: string;
  
  /** Refresh token for extending session */
  refreshToken: string;
  
  /** Token expiration timestamp in milliseconds */
  expiresAt: number;
}

/**
 * Interface defining global authentication state
 * Used for managing authentication status throughout the application
 */
export interface AuthState {
  /** Flag indicating if user is currently authenticated */
  isAuthenticated: boolean;
  
  /** Flag indicating if authentication state is being loaded */
  isLoading: boolean;
  
  /** Currently authenticated user data or null if not authenticated */
  user: AuthUser | null;
  
  /** Current session data or null if no active session */
  session: AuthSession | null;
}