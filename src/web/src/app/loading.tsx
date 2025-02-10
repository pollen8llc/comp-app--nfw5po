'use client';

import React from 'react'; // v18.0.0
import { LoadingSpinner } from '../components/common/LoadingSpinner';

/**
 * Global loading component for Next.js 13+ app directory that provides 
 * a full-page loading state during route transitions and data fetching.
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA compliance.
 */
export default function Loading() {
  return (
    <div 
      className={`
        min-h-screen w-full
        flex items-center justify-center
        bg-background dark:bg-background-dark
        transition-colors duration-200
        p-4 md:p-6
      `}
      // Accessibility attributes
      role="status"
      aria-live="polite"
      aria-label="Page content is loading"
      // Performance optimizations
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    >
      <LoadingSpinner
        size="xl"
        variant="primary"
        className="opacity-90"
        ariaLabel="Loading page content"
      />
    </div>
  );
}