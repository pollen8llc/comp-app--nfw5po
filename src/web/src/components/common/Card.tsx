import React from 'react'; // v18.0.0
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0

// Type-safe variants and configuration
export const CARD_VARIANTS = ['default', 'outlined', 'elevated'] as const;
export const CARD_PADDING = ['none', 'sm', 'md', 'lg'] as const;
export const ELEVATION_LEVELS = [1, 2, 3, 4] as const;

type CardVariant = typeof CARD_VARIANTS[number];
type CardPadding = typeof CARD_PADDING[number];
type ElevationLevel = typeof ELEVATION_LEVELS[number];

// Animation configuration following Material Design motion principles
const ANIMATION_CONFIG = {
  hover: {
    scale: 1.02,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30
    }
  },
  tap: {
    scale: 0.98
  }
};

interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  elevation?: ElevationLevel;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  disableAnimation?: boolean;
}

// Utility function to generate Material Design compliant class names
const getCardClasses = (
  variant: CardVariant,
  padding: CardPadding,
  elevation: ElevationLevel,
  interactive: boolean,
  className?: string
): string => {
  return clsx(
    // Base card styles
    'card relative rounded-lg transition-shadow',
    // Variant-specific styles
    {
      'bg-surface': variant === 'default' || variant === 'elevated',
      'border border-outline': variant === 'outlined',
      [`shadow-${elevation}`]: variant === 'elevated',
      // Interactive states
      'cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary':
        interactive,
      // High contrast mode support
      'forced-colors:outline forced-colors:outline-1': true
    },
    // Padding variants
    {
      'p-0': padding === 'none',
      'p-2': padding === 'sm',
      'p-4': padding === 'md',
      'p-6': padding === 'lg'
    },
    // Custom classes
    className
  );
};

export const Card = React.memo(({
  variant = 'default',
  padding = 'md',
  elevation = 1,
  interactive = false,
  className,
  children,
  onClick,
  ariaLabel,
  disableAnimation = false
}: CardProps) => {
  // Ensure variant is valid
  if (!CARD_VARIANTS.includes(variant)) {
    console.warn(`Invalid card variant: ${variant}. Falling back to 'default'`);
    variant = 'default';
  }

  // Ensure padding is valid
  if (!CARD_PADDING.includes(padding)) {
    console.warn(`Invalid padding value: ${padding}. Falling back to 'md'`);
    padding = 'md';
  }

  // Ensure elevation is valid
  if (!ELEVATION_LEVELS.includes(elevation)) {
    console.warn(`Invalid elevation level: ${elevation}. Falling back to 1`);
    elevation = 1;
  }

  const classes = getCardClasses(variant, padding, elevation, interactive, className);

  // Base component props
  const componentProps = {
    className: classes,
    onClick: interactive ? onClick : undefined,
    role: interactive ? 'button' : undefined,
    tabIndex: interactive ? 0 : undefined,
    'aria-label': ariaLabel,
    // Support for high contrast mode
    'data-forced-colors-mode': 'active',
    // Support for color schemes
    'data-theme': 'light dark',
    // Support for reduced motion
    'data-reduced-motion': disableAnimation ? 'true' : undefined
  };

  // Handle keyboard interaction for interactive cards
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (interactive && onClick && (event.key === 'Enter' || event.key === 'Space')) {
      event.preventDefault();
      onClick();
    }
  };

  // If animations are disabled or card is not interactive, render static div
  if (disableAnimation || !interactive) {
    return (
      <div {...componentProps} onKeyDown={handleKeyDown}>
        {children}
      </div>
    );
  }

  // Render animated card with Framer Motion
  return (
    <AnimatePresence>
      <motion.div
        {...componentProps}
        onKeyDown={handleKeyDown}
        whileHover={ANIMATION_CONFIG.hover}
        whileTap={ANIMATION_CONFIG.tap}
        initial={false}
        // Support for reduced motion
        animate={typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? {}
          : undefined}
        // Improve performance with layout animations
        layoutId={`card-${variant}-${elevation}`}
        // Accessibility improvements
        aria-live="polite"
        aria-atomic="true"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
});

// Display name for debugging
Card.displayName = 'Card';

// Type exports for consuming components
export type { CardProps, CardVariant, CardPadding, ElevationLevel };