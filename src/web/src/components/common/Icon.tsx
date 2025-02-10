import React from 'react'; // v18.0.0
import { motion } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0

// Type-safe icon size mappings
export const ICON_SIZES = {
  sm: '16',
  md: '24',
  lg: '32',
} as const;

// Type-safe list of available icons
export const ICON_NAMES = [
  'add',
  'close',
  'delete',
  'edit',
  'export',
  'filter',
  'graph',
  'import',
  'menu',
  'search',
  'settings',
  'user',
] as const;

// Type definitions
type IconSize = keyof typeof ICON_SIZES;
type IconName = typeof ICON_NAMES[number];

interface IconProps {
  /** Name of the icon to display */
  name: IconName;
  /** Size of the icon (sm: 16px, md: 24px, lg: 32px) */
  size?: IconSize;
  /** Custom CSS classes */
  className?: string;
  /** Icon color - defaults to currentColor */
  color?: string;
  /** Enable spinning animation */
  spin?: boolean;
  /** Accessible label for the icon */
  ariaLabel: string;
  /** Whether the icon should be focusable */
  focusable?: boolean;
  /** ARIA role - defaults to 'img' */
  role?: string;
}

/**
 * Converts size prop to pixel dimensions with validation
 * @param size - Icon size identifier
 * @returns Validated pixel dimension
 */
const getIconSize = (size: IconSize): string => {
  return ICON_SIZES[size] || ICON_SIZES.md;
};

/**
 * Icon component that renders accessible SVG icons with animation support
 * following Material Design 3.0 principles and WCAG 2.1 Level AA guidelines
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  className,
  color = 'currentColor',
  spin = false,
  ariaLabel,
  focusable = false,
  role = 'img',
}) => {
  // Animation variants for spinning icons
  const spinAnimation = {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      },
    },
  };

  // SVG path mapping following Material Design 3.0 principles
  const iconPaths: Record<IconName, string> = {
    add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    export: 'M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z',
    filter: 'M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z',
    graph: 'M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z',
    import: 'M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z',
    menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
    search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    user: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  };

  // Ensure proper contrast ratio for accessibility
  const ensureAccessibleColor = (color: string): string => {
    return color === 'currentColor' ? 'currentColor' : color;
  };

  const iconSize = getIconSize(size);
  const accessibleColor = ensureAccessibleColor(color);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      fill={accessibleColor}
      className={clsx('icon', className)}
      aria-label={ariaLabel}
      role={role}
      focusable={focusable}
      {...(spin && spinAnimation)}
    >
      <path d={iconPaths[name]} />
    </motion.svg>
  );
};

// Type exports for consuming components
export type { IconProps, IconSize, IconName };