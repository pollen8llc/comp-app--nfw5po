'use client';

import React from 'react'; // v18.0.0
import { motion } from 'framer-motion'; // v10.0.0
import { useRouter } from 'next/navigation'; // v13.0.0
import { EmptyState } from '../../components/common/EmptyState';

/**
 * NotFound component that displays a user-friendly 404 error page
 * following Material Design 3.0 principles and WCAG accessibility guidelines
 */
export default function NotFound() {
  const router = useRouter();

  // Log 404 occurrence for monitoring
  React.useEffect(() => {
    // Send 404 event to analytics
    try {
      // Note: Replace with actual analytics implementation
      console.error('404 Error: Page not found');
    } catch (error) {
      console.error('Failed to log 404 error', error);
    }
  }, []);

  // Animation configuration for page-level transitions
  const pageAnimation = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: {
      duration: 0.5,
      ease: 'easeInOut',
    },
  };

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center p-4"
      {...pageAnimation}
    >
      <EmptyState
        title="Page Not Found"
        description="The page you're looking for doesn't exist or has been moved."
        iconName="search"
        actionLabel="Return Home"
        onAction={() => router.push('/')}
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