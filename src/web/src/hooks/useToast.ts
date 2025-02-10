import { useContext } from 'react'; // v18.0.0
import { ToastContext } from '../providers/ToastProvider';

// Interface for toast notification options
interface ToastOptions {
  /** Type of toast notification */
  type: 'success' | 'error' | 'info';
  /** Main message to display */
  message: string;
  /** Optional detailed description */
  description?: string;
  /** Optional action button configuration */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional position override */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Optional custom duration in milliseconds */
  duration?: number;
  /** ARIA role override */
  role?: 'status' | 'alert';
}

// Return type for useToast hook
interface UseToastReturn {
  showToast: (options: ToastOptions) => void;
  hideToast: (id: string) => void;
}

/**
 * Custom hook that provides access to toast notification functionality
 * with type safety, accessibility support, and automatic duration handling
 * based on toast type (success: 3s, error: 5s, info: 4s)
 */
export const useToast = (): UseToastReturn => {
  const context = useContext(ToastContext);

  // Ensure hook is used within ToastProvider
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const { showToast: contextShowToast, hideToast } = context;

  // Enhanced showToast with default durations and ARIA roles
  const showToast = (options: ToastOptions) => {
    // Validate required fields in development
    if (process.env.NODE_ENV === 'development') {
      if (!options.message) {
        throw new Error('Toast message is required');
      }
      if (!options.type) {
        throw new Error('Toast type is required');
      }
    }

    // Set default ARIA role based on toast type
    const role = options.role || (options.type === 'error' ? 'alert' : 'status');

    // Set default durations based on type
    const defaultDurations = {
      success: 3000, // 3 seconds
      error: 5000,   // 5 seconds
      info: 4000,    // 4 seconds
    };

    // Show toast with enhanced options
    contextShowToast({
      ...options,
      role,
      duration: options.duration || defaultDurations[options.type],
    });
  };

  return {
    showToast,
    hideToast,
  };
};

export type { ToastOptions, UseToastReturn };