import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import { useTheme } from '@mui/material'; // v5.0.0
import { ICON_NAMES } from './Icon';

// Animation variants for toast entrance/exit
const ANIMATION_VARIANTS = {
  initial: {
    opacity: 0,
    y: -20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

// Default auto-dismiss delays by toast type (in ms)
const AUTO_DISMISS_DELAYS = {
  error: 5000,
  success: 3000,
  info: 4000,
} as const;

// Position-based style configurations
const TOAST_POSITIONS = {
  top: { top: 16 },
  bottom: { bottom: 16 },
  'top-left': { top: 16, left: 16 },
  'top-right': { top: 16, right: 16 },
  'bottom-left': { bottom: 16, left: 16 },
  'bottom-right': { bottom: 16, right: 16 },
} as const;

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: (id: string) => void;
  autoCloseDelay?: number;
  position?: keyof typeof TOAST_POSITIONS;
  zIndex?: number;
}

/**
 * Get theme-aware style configuration for toast type
 */
const getToastStyles = (type: ToastProps['type'], theme: any) => {
  const styles = {
    success: {
      background: theme.palette.success.main,
      color: theme.palette.success.contrastText,
      borderColor: theme.palette.success.dark,
      icon: ICON_NAMES[11], // checkmark icon
      ariaLabel: 'Success notification',
    },
    error: {
      background: theme.palette.error.main,
      color: theme.palette.error.contrastText,
      borderColor: theme.palette.error.dark,
      icon: ICON_NAMES[1], // error icon
      ariaLabel: 'Error notification',
    },
    info: {
      background: theme.palette.info.main,
      color: theme.palette.info.contrastText,
      borderColor: theme.palette.info.dark,
      icon: ICON_NAMES[10], // info icon
      ariaLabel: 'Information notification',
    },
  };

  return styles[type];
};

/**
 * Custom hook to handle auto-dismissal of toasts
 */
const useAutoDismiss = (
  type: ToastProps['type'],
  delay: number | undefined,
  onClose: (id: string) => void,
  id: string
) => {
  useEffect(() => {
    if (delay === undefined) {
      delay = AUTO_DISMISS_DELAYS[type];
    }

    const timer = setTimeout(() => {
      onClose(id);
    }, delay);

    return () => clearTimeout(timer);
  }, [type, delay, onClose, id]);
};

/**
 * Toast notification component with animation and accessibility support
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA compliance
 */
export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  message,
  onClose,
  autoCloseDelay,
  position = 'top-right',
  zIndex = 1000,
}) => {
  const theme = useTheme();
  const styles = getToastStyles(type, theme);

  // Handle auto-dismissal
  useAutoDismiss(type, autoCloseDelay, onClose, id);

  // Handle keyboard interactions
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      onClose(id);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        role="alert"
        aria-live={type === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={ANIMATION_VARIANTS}
        style={{
          position: 'fixed',
          ...TOAST_POSITIONS[position],
          zIndex,
          minWidth: '320px',
          maxWidth: '480px',
          padding: '12px 16px',
          borderRadius: theme.shape.borderRadius,
          background: styles.background,
          color: styles.color,
          border: `1px solid ${styles.borderColor}`,
          boxShadow: theme.shadows[4],
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          ...theme.typography.body2,
        }}
        onKeyDown={handleKeyPress}
        tabIndex={0}
      >
        <motion.span
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Icon
            name={styles.icon}
            size="md"
            color={styles.color}
            ariaLabel={styles.ariaLabel}
          />
        </motion.span>

        <span className="toast-message">{message}</span>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onClose(id)}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: 'inherit',
          }}
          aria-label="Close notification"
        >
          <Icon
            name={ICON_NAMES[1]} // close icon
            size="sm"
            color={styles.color}
            ariaLabel="Close notification"
          />
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
};

export default Toast;