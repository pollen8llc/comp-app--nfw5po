import React, { useState, useEffect } from 'react'; // v18.0.0
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { useAuth } from '../../hooks/useAuth';

// Animation variants for menu transitions
const menuVariants = {
  hidden: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
    },
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
    },
  },
};

// Responsive breakpoints following design specifications
const BREAKPOINTS = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

interface HeaderProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Header component implementing main navigation with authentication state
 * and responsive design following Material Design 3.0 principles
 */
export const Header: React.FC<HeaderProps> = ({ className }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated, user, handleLogout } = useAuth();

  // Monitor scroll position for header styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= BREAKPOINTS.tablet) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  const handleLogoutClick = async () => {
    try {
      await handleLogout();
      setIsMobileMenuOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-200',
        'bg-white dark:bg-gray-900',
        {
          'shadow-md': isScrolled,
          'border-b border-gray-200 dark:border-gray-800': !isScrolled,
        },
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and brand */}
          <div className="flex items-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon
                name="graph"
                size="lg"
                className="text-primary-600 dark:text-primary-400"
                ariaLabel="Community Platform Logo"
              />
            </motion.div>
            <span className="ml-3 text-xl font-semibold text-gray-900 dark:text-white hidden sm:block">
              Community Platform
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Button
                  variant="ghost"
                  startIcon="search"
                  ariaLabel="Search"
                >
                  Search
                </Button>
                <Button
                  variant="ghost"
                  startIcon="graph"
                  ariaLabel="Knowledge Graph"
                >
                  Graph
                </Button>
                <Button
                  variant="ghost"
                  startIcon="filter"
                  ariaLabel="Analytics"
                >
                  Analytics
                </Button>
                <div className="relative ml-3">
                  <motion.div whileHover={{ scale: 1.05 }}>
                    <Avatar
                      src={user?.profileImageUrl}
                      name={`${user?.firstName} ${user?.lastName}`}
                      size="md"
                      className="cursor-pointer"
                    />
                  </motion.div>
                  <Button
                    variant="ghost"
                    startIcon="settings"
                    className="ml-2"
                    onClick={handleLogoutClick}
                    ariaLabel="Logout"
                  >
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-x-2">
                <Button
                  variant="outline"
                  ariaLabel="Sign In"
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  ariaLabel="Sign Up"
                >
                  Sign Up
                </Button>
              </div>
            )}
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              onClick={toggleMobileMenu}
              ariaLabel={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <Icon
                name={isMobileMenuOpen ? 'close' : 'menu'}
                size="md"
                ariaLabel={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={menuVariants}
            className="md:hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white dark:bg-gray-900 shadow-lg">
              {isAuthenticated ? (
                <>
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center">
                      <Avatar
                        src={user?.profileImageUrl}
                        name={`${user?.firstName} ${user?.lastName}`}
                        size="sm"
                      />
                      <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                        {user?.firstName} {user?.lastName}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    fullWidth
                    startIcon="search"
                    className="justify-start"
                    ariaLabel="Search"
                  >
                    Search
                  </Button>
                  <Button
                    variant="ghost"
                    fullWidth
                    startIcon="graph"
                    className="justify-start"
                    ariaLabel="Knowledge Graph"
                  >
                    Graph
                  </Button>
                  <Button
                    variant="ghost"
                    fullWidth
                    startIcon="filter"
                    className="justify-start"
                    ariaLabel="Analytics"
                  >
                    Analytics
                  </Button>
                  <Button
                    variant="ghost"
                    fullWidth
                    startIcon="settings"
                    className="justify-start"
                    onClick={handleLogoutClick}
                    ariaLabel="Logout"
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <div className="space-y-2 p-4">
                  <Button
                    variant="outline"
                    fullWidth
                    ariaLabel="Sign In"
                  >
                    Sign In
                  </Button>
                  <Button
                    variant="primary"
                    fullWidth
                    ariaLabel="Sign Up"
                  >
                    Sign Up
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};