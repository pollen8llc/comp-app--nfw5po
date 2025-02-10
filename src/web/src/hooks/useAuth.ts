/**
 * @fileoverview Enhanced authentication hook with security monitoring and RBAC
 * @version 1.0.0
 */

import { useCallback } from 'react'; // ^18.0.0
import { useAuthContext } from '../providers/AuthProvider';
import type { AuthUser, SocialProvider } from '../types/auth';

// Rate limiting state for login attempts
const loginAttempts = new Map<string, number[]>();

/**
 * Custom hook providing secure authentication functionality with rate limiting
 * and enhanced error handling
 */
export const useAuth = () => {
  const {
    isAuthenticated,
    isLoading,
    user,
    session,
    login,
    loginWithSocial,
    logout,
    refreshAuth,
  } = useAuthContext();

  /**
   * Handles email/password login with rate limiting and security validation
   */
  const handleLogin = useCallback(async (email: string, password: string): Promise<void> => {
    // Validate rate limiting
    const now = Date.now();
    const attempts = loginAttempts.get(email) || [];
    const recentAttempts = attempts.filter(
      timestamp => now - timestamp < 15 * 60 * 1000 // 15 minute window
    );

    if (recentAttempts.length >= 5) {
      throw new Error('Too many login attempts. Please try again later.');
    }

    try {
      // Validate input parameters
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      if (!email.includes('@')) {
        throw new Error('Invalid email format');
      }

      // Attempt login
      await login(email, password);

      // Clear rate limiting on success
      loginAttempts.delete(email);
    } catch (error) {
      // Update rate limiting on failure
      recentAttempts.push(now);
      loginAttempts.set(email, recentAttempts);
      throw error;
    }
  }, [login]);

  /**
   * Handles social provider login with enhanced security validation
   */
  const handleSocialLogin = useCallback(async (provider: SocialProvider): Promise<void> => {
    try {
      // Validate provider is supported
      if (![SocialProvider.LINKEDIN, SocialProvider.GMAIL].includes(provider)) {
        throw new Error('Unsupported social login provider');
      }

      await loginWithSocial(provider);
    } catch (error) {
      throw new Error(`Social login failed: ${error.message}`);
    }
  }, [loginWithSocial]);

  /**
   * Handles secure logout with session cleanup
   */
  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      // Validate current session exists
      if (!session) {
        throw new Error('No active session');
      }

      await logout();

      // Clear any stored auth state
      loginAttempts.clear();
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }, [logout, session]);

  /**
   * Validates user has required role for accessing a resource
   */
  const validateUserRole = useCallback((requiredRole: string): boolean => {
    if (!user?.role) return false;

    const roleHierarchy = {
      ADMIN: 3,
      ANALYST: 2,
      MEMBER: 1,
      GUEST: 0,
    };

    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  }, [user]);

  return {
    // Authentication state
    isAuthenticated,
    isLoading,
    user,

    // Enhanced security methods
    handleLogin,
    handleSocialLogin,
    handleLogout,
    validateUserRole,

    // Session management
    refreshAuth,
  };
};

export type {
  AuthUser,
  SocialProvider,
};