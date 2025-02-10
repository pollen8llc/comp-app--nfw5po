import React, { useEffect } from 'react'; // ^18.0.0
import { motion } from 'framer-motion'; // ^10.0.0
import { useRouter } from 'next/router'; // ^13.0.0
import clsx from 'clsx'; // ^2.0.0

// Internal imports
import { Header } from './Header';
import { Navigation } from './Navigation';
import { Footer } from './Footer';
import { useAuth } from '../../hooks/useAuth';
import { ErrorBoundary } from '../common/ErrorBoundary';

// Type imports
import type { UserRole } from '../../types/auth';

/**
 * Props interface for MemberLayout component with enhanced security features
 */
interface MemberLayoutProps {
  /** Child components to render within the layout */
  children: React.ReactNode;
  /** Optional custom class name */
  className?: string;
  /** Whether authentication is required */
  requireAuth?: boolean;
  /** Required access level for the page */
  accessLevel?: UserRole;
}

/**
 * Layout animation variants following Material Design principles
 */
const layoutVariants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

/**
 * Secure layout component for member pages with enhanced role-based access control
 * and session validation following Material Design 3.0 principles
 */
const MemberLayout: React.FC<MemberLayoutProps> = React.memo(({
  children,
  className,
  requireAuth = true,
  accessLevel = 'MEMBER',
}) => {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, validateUserRole } = useAuth();

  // Session and access validation
  useEffect(() => {
    const validateAccess = async () => {
      if (requireAuth && !isLoading) {
        // Redirect to login if not authenticated
        if (!isAuthenticated) {
          router.push('/auth/login?redirect=' + encodeURIComponent(router.asPath));
          return;
        }

        // Validate user role for access level
        if (user && !validateUserRole(accessLevel)) {
          router.push('/unauthorized');
          return;
        }
      }
    };

    validateAccess();
  }, [isAuthenticated, isLoading, user, requireAuth, accessLevel, router, validateUserRole]);

  // Show loading state
  if (isLoading) {
    return (
      <motion.div
        className="flex items-center justify-center min-h-screen"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={layoutVariants}
        role="status"
        aria-label="Loading"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </motion.div>
    );
  }

  // Show layout only if authentication requirements are met
  if (requireAuth && (!isAuthenticated || !user)) {
    return null;
  }

  return (
    <ErrorBoundary>
      <motion.div
        className={clsx(
          // Base layout styles
          'min-h-screen flex flex-col',
          'bg-surface-light dark:bg-surface-dark',
          'transition-colors duration-200',
          className
        )}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={layoutVariants}
      >
        {/* Header with authentication state */}
        <Header className="flex-shrink-0" />

        {/* Main content area with navigation */}
        <div className="flex-1 flex flex-col md:flex-row">
          {/* Side navigation for authenticated users */}
          {isAuthenticated && (
            <Navigation />
          )}

          {/* Main content */}
          <main
            className={clsx(
              'flex-1',
              'px-4 py-6 sm:px-6 lg:px-8',
              'transition-all duration-200'
            )}
            role="main"
            id="main-content"
          >
            {/* Skip to main content link for accessibility */}
            <a
              href="#main-content"
              className={clsx(
                'sr-only focus:not-sr-only',
                'focus:absolute focus:top-0 focus:left-0',
                'p-2 bg-primary-600 text-white',
                'z-50'
              )}
            >
              Skip to main content
            </a>

            {/* Page content */}
            {children}
          </main>
        </div>

        {/* Footer */}
        <Footer className="flex-shrink-0" />
      </motion.div>
    </ErrorBoundary>
  );
});

// Display name for debugging
MemberLayout.displayName = 'MemberLayout';

export default MemberLayout;