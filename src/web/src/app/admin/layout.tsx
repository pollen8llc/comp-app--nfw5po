'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as newrelic from '@newrelic/browser-agent'; // v1.0.0
import AdminLayout from '../../components/layout/AdminLayout';
import { AuthProvider, useAuth } from '../../providers/AuthProvider';

// Metadata configuration for admin pages
export const metadata = {
  title: 'Admin Dashboard | Community Platform',
  description: 'Administrative interface for community management and analytics',
  robots: {
    index: false,
    follow: false,
  },
  headers: {
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none';",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  },
};

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Protected Admin Layout wrapper component
 * Implements role-based access control and security monitoring
 */
const AdminLayoutWrapper: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, validateUserRole } = useAuth();

  // Security monitoring and access control
  useEffect(() => {
    const validateAccess = async () => {
      try {
        // Check authentication status
        if (!isAuthenticated || !user) {
          newrelic.addCustomAttribute('auth.adminAccess', 'denied');
          router.push('/auth/login');
          return;
        }

        // Validate admin role
        const hasAdminAccess = await validateUserRole('ADMIN');
        if (!hasAdminAccess) {
          newrelic.addCustomAttribute('auth.adminAccess', 'unauthorized');
          router.push('/unauthorized');
          return;
        }

        // Log successful access
        newrelic.addCustomAttribute('auth.adminAccess', 'granted');
        newrelic.addCustomAttribute('user.role', user.role);
      } catch (error) {
        newrelic.noticeError(error);
        router.push('/error');
      }
    };

    validateAccess();
  }, [isAuthenticated, user, validateUserRole, router]);

  // Show nothing while checking authentication
  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <AdminLayout>
      {children}
    </AdminLayout>
  );
};

/**
 * Root Admin Layout component
 * Provides authentication context and error boundaries
 */
const RootLayout: React.FC<LayoutProps> = React.memo(({ children }) => {
  // Initialize performance monitoring
  useEffect(() => {
    newrelic.setPageViewName('admin');
    newrelic.addCustomAttribute('page.section', 'admin');
  }, []);

  return (
    <AuthProvider>
      <AdminLayoutWrapper>
        {children}
      </AdminLayoutWrapper>
    </AuthProvider>
  );
});

// Display name for debugging
RootLayout.displayName = 'AdminRootLayout';

export default RootLayout;