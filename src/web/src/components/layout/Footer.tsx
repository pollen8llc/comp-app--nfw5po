import React from 'react' // ^18.0.0
import clsx from 'clsx' // ^2.0.0
import { motion } from 'framer-motion' // ^10.0.0
import { colors, typography, spacing } from '../../config/theme'

// Navigation link structure
interface FooterLink {
  label: string
  href: string
  ariaLabel: string
}

// Props interface for the Footer component
interface FooterProps {
  className?: string
}

// Footer navigation links
const FOOTER_LINKS: FooterLink[] = [
  {
    label: 'About',
    href: '/about',
    ariaLabel: 'Navigate to About page'
  },
  {
    label: 'Privacy',
    href: '/privacy',
    ariaLabel: 'Navigate to Privacy Policy'
  },
  {
    label: 'Terms',
    href: '/terms',
    ariaLabel: 'Navigate to Terms of Service'
  }
]

// Responsive height classes
const FOOTER_HEIGHT = 'h-16 md:h-20'

// Responsive padding classes
const FOOTER_PADDING = 'px-4 md:px-6 lg:px-8'

/**
 * Footer component providing consistent layout and navigation
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA compliance
 */
const Footer: React.FC<FooterProps> = React.memo(({ className }) => {
  // Animation variants for theme transitions
  const footerVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    }
  }

  return (
    <motion.footer
      role="contentinfo"
      initial="initial"
      animate="animate"
      variants={footerVariants}
      className={clsx(
        // Base styles
        'w-full',
        FOOTER_HEIGHT,
        FOOTER_PADDING,
        // Theme-aware colors with smooth transitions
        'bg-surface-light dark:bg-surface-dark',
        'text-text-secondary-light dark:text-text-secondary-dark',
        'transition-colors duration-200',
        // Flexbox layout
        'flex items-center justify-between',
        // Border top with theme awareness
        'border-t border-primary-light/10 dark:border-primary-dark/10',
        // Custom className override
        className
      )}
    >
      {/* Navigation Links */}
      <nav
        role="navigation"
        aria-label="Footer navigation"
        className="flex items-center gap-6"
      >
        {FOOTER_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            aria-label={link.ariaLabel}
            className={clsx(
              // Typography
              'text-sm font-medium',
              // Theme-aware colors with transitions
              'text-text-secondary-light dark:text-text-secondary-dark',
              'hover:text-text-primary-light dark:hover:text-text-primary-dark',
              'transition-colors duration-200',
              // Focus styles for accessibility
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-primary-light dark:focus-visible:ring-primary-dark',
              'rounded-sm'
            )}
          >
            {link.label}
          </a>
        ))}
      </nav>

      {/* Copyright Text */}
      <div
        className={clsx(
          // Typography
          'text-sm',
          // Theme-aware colors
          'text-text-secondary-light dark:text-text-secondary-dark'
        )}
      >
        <p>
          <span aria-label="Copyright">©</span>{' '}
          {new Date().getFullYear()}{' '}
          <span className="font-medium">Community Platform</span>
        </p>
      </div>
    </motion.footer>
  )
})

// Display name for debugging
Footer.displayName = 'Footer'

export default Footer