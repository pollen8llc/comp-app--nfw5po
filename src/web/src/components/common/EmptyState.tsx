import React from 'react'; // v18.0.0
import { motion } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0
import { Icon, type IconName } from './Icon';
import { Button } from './Button';

// Available empty state variants
export const EMPTY_STATE_VARIANTS = ['default', 'compact', 'minimal'] as const;
type EmptyStateVariant = typeof EMPTY_STATE_VARIANTS[number];

// Animation variants for staggered entrance
export const ANIMATION_VARIANTS = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

interface EmptyStateProps {
  /** Title text for the empty state */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional icon name to display */
  iconName?: IconName;
  /** Visual variant of the empty state */
  variant?: EmptyStateVariant;
  /** Custom class name */
  className?: string;
  /** Label for the action button */
  actionLabel?: string;
  /** Loading state for the action button */
  loading?: boolean;
  /** Theme for styling - light or dark */
  theme?: 'light' | 'dark';
  /** Custom animation configuration */
  animationConfig?: {
    delay?: number;
    duration?: number;
    staggerChildren?: number;
  };
  /** Action button click handler */
  onAction?: () => void;
}

/**
 * Generates theme-aware class names for empty state container
 */
const getEmptyStateClasses = (
  variant: EmptyStateVariant,
  className?: string,
  theme: 'light' | 'dark' = 'light'
): string => {
  return clsx(
    // Base styles
    'flex flex-col items-center justify-center text-center p-8 rounded-lg',
    // Theme-specific styles
    {
      'bg-gray-50 text-gray-900': theme === 'light',
      'bg-gray-800 text-gray-100': theme === 'dark',
    },
    // Variant-specific styles
    {
      'min-h-[400px] space-y-6': variant === 'default',
      'min-h-[200px] space-y-4': variant === 'compact',
      'min-h-[100px] space-y-2': variant === 'minimal',
    },
    // Custom classes
    className
  );
};

/**
 * EmptyState component that displays a message when no data is available
 * Follows Material Design 3.0 principles and WCAG 2.1 Level AA guidelines
 */
export const EmptyState: React.FC<EmptyStateProps> = React.memo(({
  title,
  description,
  iconName,
  variant = 'default',
  className,
  actionLabel,
  loading = false,
  theme = 'light',
  animationConfig = {
    delay: 0.2,
    duration: 0.5,
    staggerChildren: 0.1,
  },
  onAction,
}) => {
  // Animation configuration
  const containerAnimation = {
    initial: 'initial',
    animate: 'animate',
    exit: 'exit',
    variants: ANIMATION_VARIANTS,
    transition: {
      duration: animationConfig.duration,
      delay: animationConfig.delay,
      staggerChildren: animationConfig.staggerChildren,
    },
  };

  return (
    <motion.div
      className={getEmptyStateClasses(variant, className, theme)}
      role="alert"
      aria-live="polite"
      {...containerAnimation}
    >
      {/* Icon */}
      {iconName && (
        <motion.div variants={ANIMATION_VARIANTS}>
          <Icon
            name={iconName}
            size={variant === 'minimal' ? 'md' : 'lg'}
            className={clsx(
              'mb-4',
              theme === 'light' ? 'text-gray-400' : 'text-gray-500'
            )}
            ariaLabel={`${iconName} illustration`}
          />
        </motion.div>
      )}

      {/* Title */}
      <motion.h3
        variants={ANIMATION_VARIANTS}
        className={clsx(
          'font-medium',
          {
            'text-2xl': variant === 'default',
            'text-xl': variant === 'compact',
            'text-lg': variant === 'minimal',
          }
        )}
      >
        {title}
      </motion.h3>

      {/* Description */}
      {description && (
        <motion.p
          variants={ANIMATION_VARIANTS}
          className={clsx(
            'text-gray-500 dark:text-gray-400',
            {
              'text-lg': variant === 'default',
              'text-base': variant === 'compact',
              'text-sm': variant === 'minimal',
            }
          )}
        >
          {description}
        </motion.p>
      )}

      {/* Action Button */}
      {actionLabel && onAction && (
        <motion.div variants={ANIMATION_VARIANTS}>
          <Button
            variant="primary"
            size={variant === 'minimal' ? 'sm' : 'md'}
            loading={loading}
            onClick={onAction}
            ariaLabel={actionLabel}
          >
            {actionLabel}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
});

EmptyState.displayName = 'EmptyState';

// Type exports for consuming components
export type { EmptyStateProps, EmptyStateVariant };