import React from 'react'; // v18.0.0
import { motion } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0
import { Icon, type IconName } from './Icon';

// Type-safe button variants following Material Design 3.0 principles
export const BUTTON_VARIANTS = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const;
export const BUTTON_SIZES = ['sm', 'md', 'lg'] as const;

type ButtonVariant = typeof BUTTON_VARIANTS[number];
type ButtonSize = typeof BUTTON_SIZES[number];

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant following Material Design 3.0 */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Custom class name */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Start icon name */
  startIcon?: IconName;
  /** End icon name */
  endIcon?: IconName;
  /** Accessible label */
  ariaLabel?: string;
  /** Button content */
  children: React.ReactNode;
}

/**
 * Generates class names for button styling based on props
 */
const getButtonClasses = (
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
  disabled: boolean,
  className?: string
): string => {
  return clsx(
    // Base styles
    'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none',
    'focus-visible:ring-2 focus-visible:ring-offset-2',
    // Variant styles
    {
      'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus-visible:ring-primary-500':
        variant === 'primary',
      'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300 focus-visible:ring-gray-500':
        variant === 'secondary',
      'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 active:bg-primary-100 focus-visible:ring-primary-500':
        variant === 'outline',
      'text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-gray-500':
        variant === 'ghost',
      'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500':
        variant === 'danger',
    },
    // Size styles
    {
      'text-sm h-8 px-3 gap-1.5': size === 'sm',
      'text-base h-10 px-4 gap-2': size === 'md',
      'text-lg h-12 px-6 gap-3': size === 'lg',
    },
    // Width styles
    {
      'w-full': fullWidth,
    },
    // Disabled styles
    {
      'opacity-50 cursor-not-allowed pointer-events-none': disabled,
    },
    className
  );
};

/**
 * Button component that follows Material Design 3.0 principles
 * and WCAG 2.1 Level AA accessibility guidelines
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  disabled = false,
  loading = false,
  fullWidth = false,
  startIcon,
  endIcon,
  ariaLabel,
  children,
  onClick,
  type = 'button',
  ...props
}) => {
  // Animation variants for hover and tap effects
  const buttonAnimation = {
    whileHover: { scale: disabled || loading ? 1 : 1.02 },
    whileTap: { scale: disabled || loading ? 1 : 0.98 },
    transition: { duration: 0.1 },
  };

  return (
    <motion.button
      type={type}
      className={getButtonClasses(variant, size, fullWidth, disabled || loading, className)}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-disabled={disabled || loading}
      onClick={onClick}
      {...buttonAnimation}
      {...props}
    >
      {/* Loading spinner */}
      {loading && (
        <Icon
          name="settings"
          size={size === 'lg' ? 'md' : 'sm'}
          className="animate-spin"
          ariaLabel="Loading"
        />
      )}

      {/* Start icon */}
      {!loading && startIcon && (
        <Icon
          name={startIcon}
          size={size === 'lg' ? 'md' : 'sm'}
          ariaLabel={`${startIcon} icon`}
        />
      )}

      {/* Button content */}
      <span className={loading ? 'opacity-0' : undefined}>{children}</span>

      {/* End icon */}
      {!loading && endIcon && (
        <Icon
          name={endIcon}
          size={size === 'lg' ? 'md' : 'sm'}
          ariaLabel={`${endIcon} icon`}
        />
      )}
    </motion.button>
  );
};

// Type exports for consuming components
export type { ButtonProps, ButtonVariant, ButtonSize };