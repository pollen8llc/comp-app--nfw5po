import React, { useEffect, useState } from 'react'; // v18.0.0
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0
import { useRouter } from 'next/router'; // v13.0.0

import { Header } from './Header';
import Sidebar from '../common/Sidebar';
import Footer from './Footer';
import { useAuth } from '../../hooks/useAuth';

// Animation variants for layout transitions
const layoutVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.3,
      when: 'beforeChildren',
    },
  },
  exit: { opacity: 0 },
};

// Content animation variants
const contentVariants = {
  expanded: {
    marginLeft: '240px',
    transition: { duration: 0.2, ease: 'easeInOut' },
  },
  collapsed: {
    marginLeft: '64px',
    transition: { duration: 0.2, ease: 'easeInOut' },
  },
};

interface AdminLayoutProps {
  /** Child components to render in layout */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Option to disable sidebar */
  disableSidebar?: boolean;
}

/**
 * AdminLayout component that provides the base structure for admin pages
 * with enhanced security, role-based access control, and responsive design
 */
const AdminLayout: React.FC<AdminLayoutProps> = React.memo(({
  children,
  className,
  disableSidebar = false,
}) => {
  const router = useRouter();
  const { isAuthenticated, user, validateUserRole } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Check admin authorization on mount and route changes
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!isAuthenticated || !user) {
        router.push('/auth/login');
        return;
      }

      const hasAccess = await validateUserRole('ADMIN');
      setIsAuthorized(hasAccess);

      if (!hasAccess) {
        router.push('/unauthorized');
      }
    };

    checkAdminAccess();
  }, [isAuthenticated, user, router, validateUserRole]);

  // Handle sidebar state persistence
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedState = localStorage.getItem('adminSidebarState');
      setIsSidebarCollapsed(storedState === 'collapsed');
      setMounted(true);
    }
  }, []);

  // Update localStorage when sidebar state changes
  const handleSidebarCollapse = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
    localStorage.setItem('adminSidebarState', collapsed ? 'collapsed' : 'expanded');
  };

  // Handle hydration
  if (!mounted) return null;

  // Show nothing while checking authorization
  if (!isAuthorized) return null;

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={layoutVariants}
      className={clsx(
        'min-h-screen bg-gray-50 dark:bg-gray-900',
        'transition-colors duration-200',
        className
      )}
    >
      {/* Header */}
      <Header className="fixed top-0 left-0 right-0 z-50" />

      {/* Main content area */}
      <div className="flex min-h-screen pt-16">
        {/* Sidebar */}
        {!disableSidebar && (
          <AnimatePresence mode="wait">
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              onCollapseChange={handleSidebarCollapse}
              className="fixed left-0 h-[calc(100vh-4rem)]"
            />
          </AnimatePresence>
        )}

        {/* Main content */}
        <motion.main
          variants={contentVariants}
          initial={false}
          animate={isSidebarCollapsed ? 'collapsed' : 'expanded'}
          className={clsx(
            'flex-1 px-4 py-8',
            'transition-all duration-200',
            'md:px-6 lg:px-8',
            {
              'ml-0': disableSidebar,
            }
          )}
        >
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </motion.main>
      </div>

      {/* Footer */}
      <Footer className="fixed bottom-0 left-0 right-0" />
    </motion.div>
  );
});

// Display name for debugging
AdminLayout.displayName = 'AdminLayout';

export default AdminLayout;