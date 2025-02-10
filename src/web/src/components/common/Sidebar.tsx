import React, { useCallback, useEffect, useState, memo } from 'react'; // v18.0.0
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0
import { useRouter } from 'next/router'; // v13.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

import { Icon } from './Icon';
import { Button } from './Button';
import { useAuth } from '../../hooks/useAuth';

// Animation variants for sidebar transitions
const sidebarVariants = {
  expanded: {
    width: '240px',
    transition: { duration: 0.2, ease: 'easeInOut' }
  },
  collapsed: {
    width: '64px',
    transition: { duration: 0.2, ease: 'easeInOut' }
  }
};

// Animation variants for nav item text
const textVariants = {
  expanded: { opacity: 1, x: 0 },
  collapsed: { opacity: 0, x: -10 }
};

// Breakpoint for auto-collapse
const COLLAPSE_BREAKPOINT = 768;

interface NavItem {
  path: string;
  icon: string;
  label: string;
  requiredRole: string;
}

// Navigation items for different roles
const ADMIN_NAV_ITEMS: NavItem[] = [
  { path: '/admin', icon: 'dashboard', label: 'Dashboard', requiredRole: 'admin' },
  { path: '/admin/members', icon: 'user', label: 'Members', requiredRole: 'admin' },
  { path: '/admin/graph', icon: 'graph', label: 'Knowledge Graph', requiredRole: 'admin' },
  { path: '/admin/analytics', icon: 'chart', label: 'Analytics', requiredRole: 'admin' },
  { path: '/admin/events', icon: 'calendar', label: 'Events', requiredRole: 'admin' },
  { path: '/admin/settings', icon: 'settings', label: 'Settings', requiredRole: 'admin' }
];

const MEMBER_NAV_ITEMS: NavItem[] = [
  { path: '/member', icon: 'home', label: 'Home', requiredRole: 'member' },
  { path: '/member/profile', icon: 'user', label: 'Profile', requiredRole: 'member' },
  { path: '/member/network', icon: 'graph', label: 'My Network', requiredRole: 'member' },
  { path: '/member/events', icon: 'calendar', label: 'Events', requiredRole: 'member' }
];

interface SidebarProps {
  /** Controls if sidebar is collapsed */
  isCollapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Custom hook to manage responsive collapse behavior
 */
const useResponsiveCollapse = (
  isCollapsed: boolean,
  onCollapseChange?: (collapsed: boolean) => void
) => {
  useEffect(() => {
    const handleResize = () => {
      const shouldCollapse = window.innerWidth <= COLLAPSE_BREAKPOINT;
      onCollapseChange?.(shouldCollapse);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener('resize', handleResize);
  }, [onCollapseChange]);

  return isCollapsed;
};

/**
 * Sidebar component that implements Material Design 3.0 principles with
 * role-based navigation and responsive design
 */
const Sidebar: React.FC<SidebarProps> = memo(({
  isCollapsed = false,
  onCollapseChange,
  className
}) => {
  const router = useRouter();
  const { user, validateUserRole } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Handle responsive collapse
  const responsiveCollapsed = useResponsiveCollapse(isCollapsed, onCollapseChange);

  // Get role-based navigation items
  const navItems = useCallback(() => {
    if (!user?.role) return [];
    return user.role === 'ADMIN' ? ADMIN_NAV_ITEMS : MEMBER_NAV_ITEMS;
  }, [user?.role]);

  // Check if route is active
  const isActiveRoute = useCallback((path: string): boolean => {
    return router.pathname === path || router.pathname.startsWith(`${path}/`);
  }, [router.pathname]);

  // Handle navigation with role validation
  const handleNavigation = useCallback(async (path: string, requiredRole: string) => {
    if (await validateUserRole(requiredRole)) {
      router.push(path);
    }
  }, [router, validateUserRole]);

  // Handle sidebar collapse toggle
  const handleToggleCollapse = useCallback(() => {
    onCollapseChange?.(!responsiveCollapsed);
  }, [responsiveCollapsed, onCollapseChange]);

  // Hydration fix
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <ErrorBoundary fallback={<div>Error loading navigation</div>}>
      <motion.aside
        initial={false}
        animate={responsiveCollapsed ? 'collapsed' : 'expanded'}
        variants={sidebarVariants}
        className={clsx(
          'flex flex-col h-screen bg-white border-r border-gray-200',
          'shadow-sm overflow-hidden transition-all',
          className
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="self-end m-2"
          onClick={handleToggleCollapse}
          ariaLabel={responsiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon
            name={responsiveCollapsed ? 'menu' : 'close'}
            size="sm"
            ariaLabel={responsiveCollapsed ? 'Expand' : 'Collapse'}
          />
        </Button>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto">
          <ul className="py-2 space-y-1">
            <AnimatePresence mode="wait">
              {navItems().map((item) => (
                <motion.li key={item.path}>
                  <Button
                    variant={isActiveRoute(item.path) ? 'primary' : 'ghost'}
                    size="md"
                    className={clsx(
                      'w-full justify-start px-4',
                      isActiveRoute(item.path) ? 'bg-primary-50' : 'hover:bg-gray-50'
                    )}
                    onClick={() => handleNavigation(item.path, item.requiredRole)}
                    ariaLabel={item.label}
                    aria-current={isActiveRoute(item.path) ? 'page' : undefined}
                  >
                    <Icon
                      name={item.icon as any}
                      size="sm"
                      ariaLabel={item.label}
                    />
                    <motion.span
                      variants={textVariants}
                      initial={false}
                      animate={responsiveCollapsed ? 'collapsed' : 'expanded'}
                      className="ml-3 whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </nav>
      </motion.aside>
    </ErrorBoundary>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;