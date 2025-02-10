/**
 * @fileoverview Clerk authentication service integration library
 * @version 1.0.0
 */

import Clerk from '@clerk/clerk-js'; // v4.0.0
import * as newrelic from 'newrelic'; // v9.0.0
import { AuthUser, AuthSession, SocialProvider } from '../types/auth';
import { authConfig } from '../config/auth';

// Error types for enhanced error handling
enum ClerkErrorType {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SOCIAL_AUTH_FAILED = 'SOCIAL_AUTH_FAILED',
}

class ClerkError extends Error {
  constructor(type: ClerkErrorType, message: string) {
    super(message);
    this.name = type;
    newrelic.noticeError(this);
  }
}

// Rate limiting implementation
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  isRateLimited(key: string, config: { maxAttempts: number; windowMs: number }): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const windowAttempts = attempts.filter(timestamp => now - timestamp < config.windowMs);
    
    this.attempts.set(key, windowAttempts);
    return windowAttempts.length >= config.maxAttempts;
  }

  addAttempt(key: string): void {
    const attempts = this.attempts.get(key) || [];
    attempts.push(Date.now());
    this.attempts.set(key, attempts);
  }
}

class ClerkClient {
  private clerk: Clerk | null = null;
  private rateLimiter: RateLimiter;
  private sessionRenewalTimeout?: NodeJS.Timeout;

  constructor() {
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Initializes the Clerk authentication client with security monitoring
   */
  async initializeClerk(): Promise<void> {
    try {
      if (!authConfig.clerkPublishableKey) {
        throw new ClerkError(
          ClerkErrorType.INITIALIZATION_FAILED,
          'Missing Clerk publishable key'
        );
      }

      this.clerk = new Clerk(authConfig.clerkPublishableKey);
      await this.clerk.load();

      // Set up session monitoring
      this.clerk.addListener('signIn', () => {
        newrelic.addCustomAttribute('auth.event', 'signIn');
        this.setupSessionRenewal();
      });

      this.clerk.addListener('signOut', () => {
        newrelic.addCustomAttribute('auth.event', 'signOut');
        this.clearSessionRenewal();
      });

    } catch (error) {
      newrelic.noticeError(error);
      throw new ClerkError(
        ClerkErrorType.INITIALIZATION_FAILED,
        'Failed to initialize Clerk'
      );
    }
  }

  /**
   * Signs in a user with security monitoring and rate limiting
   */
  async signIn(email: string, password: string): Promise<AuthSession> {
    try {
      if (this.rateLimiter.isRateLimited(email, authConfig.rateLimiting.loginAttempts)) {
        throw new ClerkError(
          ClerkErrorType.RATE_LIMIT_EXCEEDED,
          'Too many login attempts'
        );
      }

      if (!this.clerk) {
        throw new ClerkError(
          ClerkErrorType.AUTHENTICATION_FAILED,
          'Clerk not initialized'
        );
      }

      const startTime = Date.now();
      const signInAttempt = await this.clerk.signIn.create({
        identifier: email,
        password,
      });

      newrelic.addCustomAttribute('auth.responseTime', Date.now() - startTime);

      if (!signInAttempt.status === 'complete') {
        this.rateLimiter.addAttempt(email);
        throw new ClerkError(
          ClerkErrorType.INVALID_CREDENTIALS,
          'Invalid credentials'
        );
      }

      const session = await this.clerk.session.get();
      if (!session) {
        throw new ClerkError(
          ClerkErrorType.AUTHENTICATION_FAILED,
          'Failed to create session'
        );
      }

      return {
        token: session.token,
        refreshToken: session.refreshToken,
        expiresAt: Date.now() + authConfig.tokenLifetime,
      };

    } catch (error) {
      newrelic.noticeError(error);
      throw error;
    }
  }

  /**
   * Initiates social login with security monitoring
   */
  async signInWithSocial(provider: SocialProvider): Promise<void> {
    try {
      if (!this.clerk) {
        throw new ClerkError(
          ClerkErrorType.SOCIAL_AUTH_FAILED,
          'Clerk not initialized'
        );
      }

      const startTime = Date.now();
      await this.clerk.signIn.authenticateWithRedirect({
        strategy: provider.toLowerCase(),
        redirectUrl: `${window.location.origin}/auth/callback`,
      });

      newrelic.addCustomAttribute('auth.socialLogin', {
        provider,
        responseTime: Date.now() - startTime,
      });

    } catch (error) {
      newrelic.noticeError(error);
      throw new ClerkError(
        ClerkErrorType.SOCIAL_AUTH_FAILED,
        `Failed to initiate ${provider} login`
      );
    }
  }

  /**
   * Signs out the current user with session cleanup
   */
  async signOut(): Promise<void> {
    try {
      if (!this.clerk) {
        throw new ClerkError(
          ClerkErrorType.AUTHENTICATION_FAILED,
          'Clerk not initialized'
        );
      }

      await this.clerk.signOut();
      this.clearSessionRenewal();
      newrelic.addCustomAttribute('auth.event', 'signOut');

    } catch (error) {
      newrelic.noticeError(error);
      throw error;
    }
  }

  /**
   * Gets current authenticated user with security validation
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      if (!this.clerk) {
        return null;
      }

      const user = await this.clerk.user.get();
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress || '',
        role: user.publicMetadata?.role || authConfig.defaultRole,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        profileImageUrl: user.profileImageUrl,
      };

    } catch (error) {
      newrelic.noticeError(error);
      return null;
    }
  }

  /**
   * Refreshes the current session with security monitoring
   */
  async refreshSession(): Promise<AuthSession> {
    try {
      if (!this.clerk) {
        throw new ClerkError(
          ClerkErrorType.AUTHENTICATION_FAILED,
          'Clerk not initialized'
        );
      }

      if (this.rateLimiter.isRateLimited('refresh', authConfig.rateLimiting.tokenRefresh)) {
        throw new ClerkError(
          ClerkErrorType.RATE_LIMIT_EXCEEDED,
          'Too many refresh attempts'
        );
      }

      const session = await this.clerk.session.get();
      if (!session) {
        throw new ClerkError(
          ClerkErrorType.SESSION_EXPIRED,
          'No active session'
        );
      }

      await session.refresh();
      
      return {
        token: session.token,
        refreshToken: session.refreshToken,
        expiresAt: Date.now() + authConfig.tokenLifetime,
      };

    } catch (error) {
      newrelic.noticeError(error);
      throw error;
    }
  }

  /**
   * Sets up automatic session renewal before expiration
   */
  private setupSessionRenewal(): void {
    this.clearSessionRenewal();
    
    // Renew 5 minutes before expiration
    const renewalTime = authConfig.tokenLifetime - (5 * 60 * 1000);
    
    this.sessionRenewalTimeout = setTimeout(async () => {
      try {
        await this.refreshSession();
        newrelic.addCustomAttribute('auth.sessionRenewal', 'success');
      } catch (error) {
        newrelic.noticeError(error);
      }
    }, renewalTime);
  }

  /**
   * Clears the session renewal timeout
   */
  private clearSessionRenewal(): void {
    if (this.sessionRenewalTimeout) {
      clearTimeout(this.sessionRenewalTimeout);
      this.sessionRenewalTimeout = undefined;
    }
  }
}

// Export singleton instance
export const clerkClient = new ClerkClient();