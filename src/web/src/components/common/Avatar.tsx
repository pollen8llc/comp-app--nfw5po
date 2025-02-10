import React, { useState, useEffect } from 'react'; // v18.0.0
import { motion } from 'framer-motion'; // v10.0.0
import clsx from 'clsx'; // v2.0.0
import { Icon } from '../common/Icon';

// Available avatar sizes with pixel values
export const AVATAR_SIZES = {
  sm: '32',
  md: '40',
  lg: '48',
  xl: '64',
} as const;

// Accessible background colors for fallback state
const FALLBACK_COLORS = [
  'bg-blue-100',
  'bg-green-100',
  'bg-purple-100',
  'bg-yellow-100',
  'bg-pink-100',
] as const;

// Type definitions
export type AvatarSize = keyof typeof AVATAR_SIZES;
export type AvatarShape = 'circle' | 'square';

interface AvatarProps {
  /** Image source URL */
  src?: string;
  /** User's full name for fallback and accessibility */
  name: string;
  /** Size of the avatar */
  size?: AvatarSize;
  /** Additional CSS classes */
  className?: string;
  /** Enable animation effects */
  animate?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Shape of the avatar */
  shape?: AvatarShape;
}

/**
 * Extracts initials from a user's name
 * @param name - User's full name
 * @returns Up to two characters representing the user's initials
 */
const getInitials = (name: string): string => {
  if (!name) return '?';
  
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';

  const firstInitial = words[0].charAt(0);
  const secondInitial = words.length > 1 ? words[words.length - 1].charAt(0) : '';

  return (firstInitial + secondInitial)
    .replace(/[^\p{L}]/gu, '') // Remove non-letter characters
    .toUpperCase()
    .slice(0, 2) || '?';
};

/**
 * Generates a consistent background color based on the user's name
 * @param name - User's full name
 * @returns Tailwind CSS background color class
 */
const getFallbackColor = (name: string): string => {
  const hash = name.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  const index = Math.abs(hash) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[index];
};

/**
 * Avatar component that displays a user's profile image or fallback initials
 * with support for loading states and animations
 */
export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className,
  animate = false,
  loading = false,
  shape = 'circle',
}) => {
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(loading);

  // Reset error state when src changes
  useEffect(() => {
    setError(false);
    if (src) {
      setIsLoading(true);
      const img = new Image();
      img.src = src;
      img.onload = () => setIsLoading(false);
      img.onerror = () => {
        setError(true);
        setIsLoading(false);
      };
      return () => {
        img.onload = null;
        img.onerror = null;
      };
    }
  }, [src]);

  // Animation variants
  const avatarVariants = {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.9, opacity: 0 },
  };

  // Base container classes
  const containerClasses = clsx(
    'relative inline-flex items-center justify-center overflow-hidden',
    {
      'rounded-full': shape === 'circle',
      'rounded-lg': shape === 'square',
    },
    {
      'w-8 h-8': size === 'sm',
      'w-10 h-10': size === 'md',
      'w-12 h-12': size === 'lg',
      'w-16 h-16': size === 'xl',
    },
    className
  );

  // Render loading state
  if (isLoading) {
    return (
      <div className={containerClasses} role="status" aria-label="Loading avatar">
        <motion.div
          className="w-full h-full bg-gray-200 animate-pulse"
          initial={animate ? "initial" : false}
          animate={animate ? "animate" : false}
          exit="exit"
          variants={avatarVariants}
        />
      </div>
    );
  }

  // Render fallback when image fails to load or is not provided
  if (error || !src) {
    const fallbackColor = getFallbackColor(name);
    const initials = getInitials(name);
    
    return (
      <motion.div
        className={clsx(containerClasses, fallbackColor, 'text-gray-700')}
        initial={animate ? "initial" : false}
        animate={animate ? "animate" : false}
        exit="exit"
        variants={avatarVariants}
        role="img"
        aria-label={`Avatar for ${name}`}
      >
        {initials === '?' ? (
          <Icon
            name="user"
            size={size === 'xl' ? 'lg' : 'md'}
            ariaLabel={`Default avatar for ${name}`}
          />
        ) : (
          <span className={clsx(
            'font-medium',
            {
              'text-xs': size === 'sm',
              'text-sm': size === 'md',
              'text-base': size === 'lg',
              'text-lg': size === 'xl',
            }
          )}>
            {initials}
          </span>
        )}
      </motion.div>
    );
  }

  // Render image avatar
  return (
    <motion.div
      className={containerClasses}
      initial={animate ? "initial" : false}
      animate={animate ? "animate" : false}
      exit="exit"
      variants={avatarVariants}
      role="img"
      aria-label={`Avatar for ${name}`}
    >
      <img
        src={src}
        alt={`${name}'s avatar`}
        className="w-full h-full object-cover"
        onError={() => setError(true)}
        loading="lazy"
      />
    </motion.div>
  );
};