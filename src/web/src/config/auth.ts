/**
 * @fileoverview Authentication configuration settings for the web application
 * @version 1.0.0
 */

import { UserRole, SocialProvider } from '../types/auth';

/**
 * Core authentication configuration settings
 * Implements authentication requirements from technical specifications
 */
export const authConfig = {
  // Clerk API Configuration
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
  frontendApi: process.env.NEXT_PUBLIC_CLERK_FRONTEND_API || '',

  // Token Lifecycle Configuration (in milliseconds)
  tokenLifetime: 60 * 60 * 1000, // 1 hour
  refreshTokenLifetime: 7 * 24 * 60 * 60 * 1000, // 7 days
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  maxConcurrentSessions: 3,

  // Social Login Providers
  socialProviders: [
    SocialProvider.LINKEDIN,
    SocialProvider.GMAIL
  ],

  // Default Role Assignment
  defaultRole: UserRole.GUEST,

  // Security Settings
  securitySettings: {
    jwtAlgorithm: 'RS256',
    requireEmailVerification: true,
    allowPasswordlessAuth: true,
    mfaEnabled: true,
    sessionInvalidationModes: ['manual', 'timeout', 'security_event'],
  },

  // Rate Limiting Configuration
  rateLimiting: {
    loginAttempts: {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDuration: 30 * 60 * 1000, // 30 minutes
    },
    tokenRefresh: {
      maxAttempts: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
  },

  // Security Monitoring Configuration
  monitoring: {
    logFailedAttempts: true,
    logSuccessfulLogins: true,
    alertOnSuspiciousActivity: true,
    suspiciousActivityThresholds: {
      failedLoginAttempts: 10,
      passwordResetAttempts: 3,
      mfaFailures: 3,
    },
  },
} as const;

/**
 * Role-based permission configuration
 * Implements authorization matrix from technical specifications
 */
export const rolePermissions = {
  [UserRole.ADMIN]: {
    memberManagement: ['create', 'read', 'update', 'delete', 'list'],
    knowledgeGraph: ['read', 'write', 'query', 'export'],
    analytics: ['view', 'export', 'configure'],
    systemConfig: ['read', 'write'],
    events: ['create', 'read', 'update', 'delete', 'import'],
  },
  
  [UserRole.MEMBER]: {
    memberManagement: ['read_self', 'update_self'],
    knowledgeGraph: ['read'],
    analytics: ['view_limited'],
    events: ['read', 'register'],
    profile: ['read', 'update'],
  },
  
  [UserRole.ANALYST]: {
    memberManagement: ['read', 'list'],
    knowledgeGraph: ['read', 'query', 'export'],
    analytics: ['view', 'export', 'configure'],
    events: ['read', 'export'],
  },
  
  [UserRole.GUEST]: {
    memberManagement: [],
    knowledgeGraph: [],
    analytics: [],
    events: ['view_public'],
    profile: ['create'],
  },
} as const;