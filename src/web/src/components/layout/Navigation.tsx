import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion'; // ^10.0.0
import clsx from 'clsx'; // ^2.0.0
import { useAuth } from '../../hooks/useAuth';
import { Icon } from '../common/Icon';
import { Button } from '../common/Button';

// Navigation route types
interface NavRoute {
  path: string;
  icon: string;
  label: string;
  requiredRole: string;
}

// Admin routes with role-based access
const ADMIN_ROUTES: NavRoute[] = [
  { path: '/admin', icon: 'dashboard', label: 'Dashboard', requiredRole: 'admin' },
  { path: '/admin/members', icon: 'user', label: 'Members', requiredRole: 'admin' },
  { path: '/admin/graph', icon: 'graph', label: 'Knowledge Graph', requiredRole: 'admin' },
  { path: '/admin/analytics', icon: 'chart', label: 'Analytics', requiredRole: 'admin' },
  { path: '/admin/events', icon: 'calendar', label: 'Events', requiredRole: 'admin' },
  { path: '/admin/settings', icon: 'settings', label: 'Settings', requiredRole: 'admin' }
];

// Member routes with role-based access
const MEMBER_ROUTES: NavRoute[] = [
  { path: '/member', icon: 'dashboard', label: 'Dashboard', requiredRole: 'member' },
  { path: '/member/profile', icon: 'user', label: 'Profile', requiredRole: 'member' },
  { path: '/member/network', icon: 'graph', label: 'Network', requiredRole: 'member' },
  { path: '/member/events', icon: 'calendar', label: 'Events', requiredRole: 'member' }
];

// Animation variants for menu items
const menuItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
};

// Animation variants for mobile menu
const mobileMenuVariants = {
  hidden: { x: '-100%' },
  visible: { x: 0 },
  exit: { x: '-100%' }
};

export const Navigation: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { isAuthenticated, user, handleLogout } = useAuth();

  // Handle click outside to close mobile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, []);

  // Check if route is active
  const isActiveRoute = (path: string): boolean => {
    return router.pathname === path || router.pathname.startsWith(`${path}/`);
  };

  // Get navigation routes based on user role
  const getNavigationRoutes = (): NavRoute[] => {
    if (!user) return [];
    return user.role === 'ADMIN' ? ADMIN_ROUTES : MEMBER_ROUTES;
  };

  // Render navigation items with animations
  const renderNavigationItems = () => {
    const routes = getNavigationRoutes();

    return (
      <motion.ul
        className="space-y-1"
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {routes.map((route, index) => (
          <motion.li
            key={route.path}
            variants={menuItemVariants}
            transition={{ delay: index * 0.1 }}
          >
            <Link
              href={route.path}
              className={clsx(
                'flex items-center px-4 py-2 text-sm font-medium rounded-md',
                'transition-colors duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                isActiveRoute(route.path)
                  ? 'bg-primary-100 text-primary-900'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
              onClick={() => setIsOpen(false)}
            >
              <Icon
                name={route.icon as any}
                size="sm"
                className="mr-3"
                ariaLabel={`${route.label} icon`}
              />
              {route.label}
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    );
  };

  return (
    <nav
      className="bg-white shadow-sm"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Desktop Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex">
            <Link
              href="/"
              className="flex items-center text-xl font-bold text-primary-900"
            >
              Community Platform
            </Link>
          </div>

          {/* Desktop Menu Items */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {isAuthenticated && renderNavigationItems()}
            
            {isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                startIcon="user"
                onClick={handleLogout}
                ariaLabel="Sign out"
              >
                Sign Out
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                startIcon="user"
                onClick={() => router.push('/auth/login')}
                ariaLabel="Sign in"
              >
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
              ariaLabel={isOpen ? 'Close menu' : 'Open menu'}
            >
              <Icon
                name={isOpen ? 'close' : 'menu'}
                size="md"
                ariaLabel={isOpen ? 'Close menu' : 'Open menu'}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mobile-menu"
            ref={menuRef}
            className="md:hidden"
            variants={mobileMenuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'tween', duration: 0.3 }}
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {isAuthenticated && renderNavigationItems()}
              
              {isAuthenticated ? (
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  startIcon="user"
                  onClick={handleLogout}
                  ariaLabel="Sign out"
                >
                  Sign Out
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  startIcon="user"
                  onClick={() => router.push('/auth/login')}
                  ariaLabel="Sign in"
                >
                  Sign In
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navigation;