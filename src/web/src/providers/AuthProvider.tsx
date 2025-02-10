/**
 * @fileoverview Enhanced authentication provider with security monitoring and RBAC
 * @version 1.0.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as newrelic from 'newrelic-browser'; // v1.0.0
import { SecurityMonitor } from '@clerk/security'; // v4.0.0
import { authConfig } from '../config/auth';
import { clerkClient } from '../lib/clerk';
import type { AuthUser, AuthSession, AuthState, UserRole, SocialProvider } from '../types/auth';

// Security monitoring instance
const securityMonitor = new SecurityMonitor({
  enableAnomalyDetection: true,
  logLevel: 'warn',
  reportingInterval: 60000,
});

interface SecurityContext {
  lastActivity: number;
  deviceId: string;
  riskScore: number;
  anomalyDetected: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginWithSocial: (provider: SocialProvider) => Promise<void>;
  logout: () => Promise<void>;
  validateAccess: (resource: string, action: string) => Promise<boolean>;
  securityContext: SecurityContext;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    session: null,
  });

  const [securityContext, setSecurityContext] = useState<SecurityContext>({
    lastActivity: Date.now(),
    deviceId: crypto.randomUUID(),
    riskScore: 0,
    anomalyDetected: false,
  });

  // Initialize authentication and security monitoring
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await clerkClient.initializeClerk();
        
        // Initialize security monitoring
        securityMonitor.initialize({
          deviceId: securityContext.deviceId,
          sessionTimeout: authConfig.sessionTimeout,
          maxConcurrentSessions: authConfig.maxConcurrentSessions,
        });

        // Load initial authentication state
        const user = await clerkClient.getCurrentUser();
        if (user) {
          const session = await clerkClient.refreshSession();
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user,
            session,
          });
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }

        newrelic.addCustomAttribute('auth.initialized', true);
      } catch (error) {
        newrelic.noticeError(error);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();

    return () => {
      securityMonitor.cleanup();
    };
  }, []);

  // Session activity monitoring
  useEffect(() => {
    const activityHandler = () => {
      setSecurityContext(prev => ({
        ...prev,
        lastActivity: Date.now(),
      }));
    };

    window.addEventListener('mousemove', activityHandler);
    window.addEventListener('keydown', activityHandler);

    return () => {
      window.removeEventListener('mousemove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
    };
  }, []);

  // Session timeout monitoring
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    const checkSessionTimeout = setInterval(() => {
      const inactiveTime = Date.now() - securityContext.lastActivity;
      if (inactiveTime >= authConfig.sessionTimeout) {
        logout();
        newrelic.addCustomAttribute('auth.sessionTimeout', true);
      }
    }, 60000);

    return () => clearInterval(checkSessionTimeout);
  }, [authState.isAuthenticated, securityContext.lastActivity]);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const startTime = Date.now();
      const session = await clerkClient.signIn(email, password);
      const user = await clerkClient.getCurrentUser();

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user,
        session,
      });

      securityMonitor.logEvent('login_success', {
        email,
        deviceId: securityContext.deviceId,
        responseTime: Date.now() - startTime,
      });

      newrelic.addCustomAttribute('auth.loginSuccess', true);
    } catch (error) {
      securityMonitor.logEvent('login_failure', {
        email,
        deviceId: securityContext.deviceId,
        error: error.message,
      });
      throw error;
    }
  };

  const loginWithSocial = async (provider: SocialProvider): Promise<void> => {
    try {
      securityMonitor.logEvent('social_login_attempt', {
        provider,
        deviceId: securityContext.deviceId,
      });

      await clerkClient.signInWithSocial(provider);
    } catch (error) {
      securityMonitor.logEvent('social_login_failure', {
        provider,
        deviceId: securityContext.deviceId,
        error: error.message,
      });
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await clerkClient.signOut();
      securityMonitor.logEvent('logout', {
        deviceId: securityContext.deviceId,
      });

      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        session: null,
      });
    } catch (error) {
      newrelic.noticeError(error);
      throw error;
    }
  };

  const validateAccess = useCallback(async (
    resource: string,
    action: string
  ): Promise<boolean> => {
    if (!authState.user?.role) return false;

    try {
      const userRole = authState.user.role as UserRole;
      const permissions = authConfig.rolePermissions[userRole];

      const hasPermission = permissions[resource]?.includes(action) ?? false;

      securityMonitor.logEvent('access_validation', {
        userId: authState.user.id,
        role: userRole,
        resource,
        action,
        granted: hasPermission,
      });

      return hasPermission;
    } catch (error) {
      newrelic.noticeError(error);
      return false;
    }
  }, [authState.user]);

  const contextValue: AuthContextType = {
    ...authState,
    login,
    loginWithSocial,
    logout,
    validateAccess,
    securityContext,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;