'use client';

import React, { useEffect } from 'react'; // v18.0.0
import { motion } from 'framer-motion'; // v10.0.0
import newrelic from 'newrelic-browser'; // latest
import { EmptyState } from '../../components/common/EmptyState';

// Animation variants for error page transitions
const ERROR_ANIMATION_VARIANTS = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

// Error categories and their user-friendly messages
const ERROR_MESSAGES: Record<string, { title: string; description: string; icon: 'close' | 'settings' }> = {
  NOT_FOUND: {
    title: 'Resource Not Found',
    description: 'The requested resource could not be found. Please check the URL and try again.',
    icon: 'close',
  },
  UNAUTHORIZED: {
    title: 'Access Denied',
    description: 'You do not have permission to access this resource. Please sign in or contact support.',
    icon: 'close',
  },
  SERVER_ERROR: {
    title: 'Server Error',
    description: 'An unexpected error occurred. Our team has been notified and is working to resolve the issue.',
    icon: 'settings',
  },
  DEFAULT: {
    title: 'Something Went Wrong',
    description: 'An error occurred while processing your request. Please try again later.',
    icon: 'close',
  },
};

/**
 * Categorizes the error based on its properties and status code
 */
const categorizeError = (error: Error & { digest?: string }): keyof typeof ERROR_MESSAGES => {
  if (error.message?.includes('not found') || error.message?.includes('404')) {
    return 'NOT_FOUND';
  }
  if (error.message?.includes('unauthorized') || error.message?.includes('forbidden')) {
    return 'UNAUTHORIZED';
  }
  if (error.message?.includes('server error') || error.message?.includes('500')) {
    return 'SERVER_ERROR';
  }
  return 'DEFAULT';
};

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Next.js Error Page Component
 * Provides a user-friendly error UI with animations and monitoring integration
 */
export default function Error({ error, reset }: ErrorProps): React.ReactElement {
  useEffect(() => {
    // Log error to New Relic
    newrelic.noticeError(error, {
      errorType: categorizeError(error),
      errorDigest: error.digest,
    });

    // Attempt automatic reset for certain error types after 30 seconds
    const errorCategory = categorizeError(error);
    if (errorCategory === 'SERVER_ERROR') {
      const resetTimer = setTimeout(reset, 30000);
      return () => clearTimeout(resetTimer);
    }
  }, [error, reset]);

  const errorType = categorizeError(error);
  const errorMessage = ERROR_MESSAGES[errorType];

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center p-4"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={ERROR_ANIMATION_VARIANTS}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <EmptyState
        title={errorMessage.title}
        description={errorMessage.description}
        iconName={errorMessage.icon}
        actionLabel="Try Again"
        onAction={reset}
        variant="default"
        theme="light"
        animationConfig={{
          delay: 0.2,
          duration: 0.5,
          staggerChildren: 0.1,
        }}
      />
    </motion.div>
  );
}