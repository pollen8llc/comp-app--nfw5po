import React from 'react'; // v18.0.0
import { motion } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0

// Type-safe size configurations
export const SPINNER_SIZES = {
  sm: '16',
  md: '24',
  lg: '32',
  xl: '48'
} as const;

// Type-safe variant configurations
export const SPINNER_VARIANTS = {
  primary: 'border-primary-500 dark:border-primary-400',
  secondary: 'border-secondary-500 dark:border-secondary-400',
  white: 'border-white dark:border-gray-100'
} as const;

type SpinnerSize = keyof typeof SPINNER_SIZES;
type SpinnerVariant = keyof typeof SPINNER_VARIANTS;

interface LoadingSpinnerProps {
  /** Size of the spinner - defaults to 'md' */
  size?: SpinnerSize;
  /** Visual variant of the spinner - defaults to 'primary' */
  variant?: SpinnerVariant;
  /** Optional additional classes */
  className?: string;
  /** Accessible label for screen readers - defaults to 'Loading' */
  ariaLabel?: string;
}

/**
 * Converts size prop to pixel dimensions with fallback handling
 * @param size - The desired spinner size
 * @returns The pixel dimension for the spinner
 */
const getSpinnerSize = (size?: SpinnerSize): string => {
  return SPINNER_SIZES[size ?? 'md'];
};

/**
 * Generates optimized class names for spinner styling
 * @param variant - The spinner's visual variant
 * @param className - Additional custom classes
 * @returns Optimized class string
 */
const getSpinnerClasses = (variant: SpinnerVariant = 'primary', className?: string): string => {
  return clsx(
    // Base classes with GPU acceleration hints
    'inline-block rounded-full border-2 border-solid',
    'animate-spin will-change-transform',
    'border-t-transparent border-l-transparent',
    // Variant-specific styling
    SPINNER_VARIANTS[variant],
    // Custom classes
    className
  );
};

/**
 * A highly optimized loading spinner component with smooth animations
 * and accessibility features. Built with Framer Motion for performance
 * and follows Material Design 3.0 principles.
 */
export const LoadingSpinner = React.memo(({
  size = 'md',
  variant = 'primary',
  className,
  ariaLabel = 'Loading'
}: LoadingSpinnerProps) => {
  const dimensions = getSpinnerSize(size);
  const classes = getSpinnerClasses(variant, className);

  return (
    <motion.div
      className={classes}
      style={{
        width: `${dimensions}px`,
        height: `${dimensions}px`
      }}
      initial={{ rotate: 0 }}
      animate={{ 
        rotate: 360,
      }}
      transition={{
        duration: 1,
        ease: "linear",
        repeat: Infinity,
        repeatType: "loop",
        // Performance optimizations
        type: "tween",
        useTransformOrigin: true
      }}
      // Accessibility attributes
      role="status"
      aria-label={ariaLabel}
      // Performance optimizations
      layoutId={`spinner-${size}-${variant}`}
      transformTemplate={(props, transform) => `${transform} translateZ(0)`}
    >
      <span className="sr-only">{ariaLabel}</span>
    </motion.div>
  );
});

// Display name for debugging
LoadingSpinner.displayName = 'LoadingSpinner';

// Type exports for consumers
export type { SpinnerSize, SpinnerVariant, LoadingSpinnerProps };