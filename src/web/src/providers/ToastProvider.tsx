import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion'; // v10.0.0
import Toast, { ToastProps } from '../components/common/Toast';

// Constants for auto-dismiss durations (in ms)
const AUTO_DISMISS_DURATION = {
  success: 3000,
  error: 5000,
  info: 4000,
} as const;

// Maximum number of toasts to show at once
const TOAST_LIMIT = 5;

// Responsive positioning for different screen sizes
const TOAST_POSITIONS = {
  desktop: {
    top: '24px',
    right: '24px',
  },
  mobile: {
    top: '16px',
    right: '16px',
  },
} as const;

// Interface definitions
interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  hideToast: (id: string) => void;
  pauseToast: (id: string) => void;
  resumeToast: (id: string) => void;
}

interface ToastOptions {
  type: 'success' | 'error' | 'info';
  message: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

interface Toast extends ToastOptions {
  id: string;
  isPaused: boolean;
  createdAt: number;
}

// Create context with default values
export const ToastContext = createContext<ToastContextType>({
  showToast: () => undefined,
  hideToast: () => undefined,
  pauseToast: () => undefined,
  resumeToast: () => undefined,
});

// Generate unique ID for each toast
const generateToastId = (): string => {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastTimers, setToastTimers] = useState<Record<string, NodeJS.Timeout>>({});

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      Object.values(toastTimers).forEach(timer => clearTimeout(timer));
    };
  }, [toastTimers]);

  // Start auto-dismiss timer for a toast
  const startToastTimer = useCallback((toast: Toast) => {
    const duration = AUTO_DISMISS_DURATION[toast.type];
    const timer = setTimeout(() => {
      hideToast(toast.id);
    }, duration);

    setToastTimers(prev => ({
      ...prev,
      [toast.id]: timer,
    }));
  }, []);

  // Show new toast notification
  const showToast = useCallback((options: ToastOptions) => {
    setToasts(prev => {
      if (prev.length >= TOAST_LIMIT) {
        const [, ...remainingToasts] = prev;
        return [
          ...remainingToasts,
          {
            ...options,
            id: generateToastId(),
            isPaused: false,
            createdAt: Date.now(),
          },
        ];
      }

      return [
        ...prev,
        {
          ...options,
          id: generateToastId(),
          isPaused: false,
          createdAt: Date.now(),
        },
      ];
    });
  }, []);

  // Hide/remove toast notification
  const hideToast = useCallback((id: string) => {
    // Clear existing timer
    if (toastTimers[id]) {
      clearTimeout(toastTimers[id]);
      setToastTimers(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    }

    // Remove toast from state
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, [toastTimers]);

  // Pause toast timer (on hover/focus)
  const pauseToast = useCallback((id: string) => {
    if (toastTimers[id]) {
      clearTimeout(toastTimers[id]);
      setToastTimers(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    }

    setToasts(prev =>
      prev.map(toast =>
        toast.id === id ? { ...toast, isPaused: true } : toast
      )
    );
  }, [toastTimers]);

  // Resume toast timer (after hover/focus ends)
  const resumeToast = useCallback((id: string) => {
    setToasts(prev =>
      prev.map(toast => {
        if (toast.id === id) {
          const updatedToast = { ...toast, isPaused: false };
          startToastTimer(updatedToast);
          return updatedToast;
        }
        return toast;
      })
    );
  }, [startToastTimer]);

  // Memoize context value
  const contextValue = useMemo(
    () => ({
      showToast,
      hideToast,
      pauseToast,
      resumeToast,
    }),
    [showToast, hideToast, pauseToast, resumeToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={() => pauseToast(toast.id)}
            onMouseLeave={() => resumeToast(toast.id)}
            onFocus={() => pauseToast(toast.id)}
            onBlur={() => resumeToast(toast.id)}
          >
            <Toast
              id={toast.id}
              type={toast.type}
              message={toast.message}
              onClose={hideToast}
              autoCloseDelay={AUTO_DISMISS_DURATION[toast.type]}
              position={toast.position || 'top-right'}
              zIndex={1000 + toasts.length - toasts.indexOf(toast)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};

export default ToastProvider;