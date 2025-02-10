import React from 'react'; // v18.0.0
import { motion } from 'framer-motion'; // v10.0.0
import { APIError } from '../../types/api';
import { EmptyState } from './EmptyState';

interface ErrorBoundaryProps {
  /** Optional custom error reporting function */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Optional custom fallback component */
  FallbackComponent?: React.ComponentType<{ error: Error; resetError: () => void }>;
  /** Child components to be wrapped */
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in the child
 * component tree and displays a fallback UI with animated transitions and
 * accessibility support.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
    this.resetError = this.resetError.bind(this);
  }

  /**
   * Static method to derive error state from caught errors
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Format error as APIError if possible for consistent error handling
    const formattedError: APIError = {
      code: 'RUNTIME_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: {
        name: error.name,
        stack: error.stack
      },
      status: 500
    };

    return {
      hasError: true,
      error: formattedError
    };
  }

  /**
   * Lifecycle method called when an error occurs
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Update state with error details
    this.setState({
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', error);
      console.error('Error Info:', errorInfo);
    }
  }

  /**
   * Resets the error state to allow recovery
   */
  resetError(): void {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  }

  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { FallbackComponent, children } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (FallbackComponent) {
        return <FallbackComponent error={error} resetError={this.resetError} />;
      }

      // Default fallback UI with EmptyState component
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="alert"
          aria-live="assertive"
        >
          <EmptyState
            title="Something went wrong"
            description={error.message}
            iconName="close"
            actionLabel="Try Again"
            onAction={this.resetError}
            theme="light"
            variant="default"
            animationConfig={{
              delay: 0.2,
              duration: 0.5,
              staggerChildren: 0.1
            }}
          />
        </motion.div>
      );
    }

    // Render children when no error occurs
    return children;
  }
}

// Type exports for consuming components
export type { ErrorBoundaryProps, ErrorBoundaryState };
```

This implementation:

1. Creates a robust error boundary component that catches JavaScript errors and provides a fallback UI
2. Uses Framer Motion for smooth animations during error state transitions
3. Implements accessibility features with proper ARIA attributes
4. Provides flexible error reporting through optional callback props
5. Supports custom fallback components while providing a default EmptyState fallback
6. Formats errors consistently using the APIError interface
7. Includes development-mode error logging
8. Provides error recovery through a reset mechanism
9. Follows Material Design principles through the EmptyState component
10. Exports TypeScript types for type safety

The component can be used to wrap any part of the application where error handling is needed:

```typescript
<ErrorBoundary onError={(error, errorInfo) => logErrorToService(error, errorInfo)}>
  <YourComponent />
</ErrorBoundary>