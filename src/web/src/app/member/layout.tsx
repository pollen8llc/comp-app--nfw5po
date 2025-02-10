'use client';

import React, { useEffect } from 'react';
import { memo } from 'react';
import { useRouter, redirect } from 'next/navigation';
import MemberLayout from '../../components/layout/MemberLayout';
import { useAuth } from '../../hooks/useAuth';
import * as newrelic from 'newrelic-browser'; // v9.0.0

// Props interface for RootLayout component
interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Validates member access based on user role and session status
 * @param user - Current authenticated user
 * @param session - Active auth session
 * @returns boolean indicating valid member access
 */
const validateMemberAccess = (user: any, session: any): boolean => {
  if (!user || !session) return false;

  // Verify user has required role
  const validRoles = ['MEMBER', 'ADMIN', 'ANALYST'];
  if (!validRoles.includes(user.role)) return false;

  // Verify session is active and not expired
  const now = Date.now();
  if (!session.expiresAt || now >= session.expiresAt) return false;

  return true;
};

/**
 * Secure root layout component for member pages with authentication,
 * authorization, and comprehensive security measures
 */
const RootLayout: React.FC<LayoutProps> = memo(({ children }) => {
  const router = useRouter();
  const { isAuthenticated, user, session } = useAuth();

  // Validate authentication and authorization on mount and updates
  useEffect(() => {
    const validateAccess = async () => {
      try {
        // Redirect to login if not authenticated
        if (!isAuthenticated) {
          const currentPath = window.location.pathname;
          redirect(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
          return;
        }

        // Validate member access
        const hasAccess = validateMemberAccess(user, session);
        if (!hasAccess) {
          newrelic.addCustomAttribute('auth.accessDenied', {
            path: window.location.pathname,
            role: user?.role
          });
          redirect('/unauthorized');
          return;
        }

        // Log successful access
        newrelic.addCustomAttribute('auth.memberAccess', {
          userId: user?.id,
          role: user?.role
        });

      } catch (error) {
        newrelic.noticeError(error);
        redirect('/error');
      }
    };

    validateAccess();
  }, [isAuthenticated, user, session]);

  // Apply security headers
  useEffect(() => {
    // Set security headers
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';";
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  // Render secure member layout if authenticated and authorized
  if (isAuthenticated && user && session) {
    return (
      <MemberLayout>
        {children}
      </MemberLayout>
    );
  }

  // Return null while authentication is being validated
  return null;
});

// Display name for debugging
RootLayout.displayName = 'MemberRootLayout';

export default RootLayout;