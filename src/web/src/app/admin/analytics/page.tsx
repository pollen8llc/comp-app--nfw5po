'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion'; // v10.0.0
import classNames from 'classnames'; // v2.3.2
import { useErrorBoundary } from 'react-error-boundary'; // v4.0.0

import { VisualizationPanel } from '../../../components/analytics/VisualizationPanel';
import { useAnalytics } from '../../../hooks/useAnalytics';
import AdminLayout from '../../../components/layout/AdminLayout';
import ErrorBoundary from '../../../components/common/ErrorBoundary';
import { useAuth } from '../../../hooks/useAuth';

// Animation variants for page transitions
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.3,
      when: 'beforeChildren',
      staggerChildren: 0.1
    }
  },
  exit: { opacity: 0, y: -20 }
};

/**
 * Admin Analytics Page Component
 * Provides comprehensive network analysis and TDA visualization capabilities
 * with enhanced security, accessibility, and performance optimizations
 */
const AnalyticsPage: React.FC = () => {
  // Authentication and authorization
  const { validateUserRole } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Analytics state management
  const {
    tdaParams,
    networkData,
    isLoading,
    error: analyticsError,
    computeTDA,
    progress
  } = useAnalytics();

  // Error boundary integration
  const { showBoundary } = useErrorBoundary();

  // Performance monitoring
  const [renderTime, setRenderTime] = useState<number>(0);
  const renderStart = React.useRef<number>(performance.now());

  // Check admin authorization
  useEffect(() => {
    const checkAccess = async () => {
      const hasAccess = await validateUserRole('ADMIN');
      setIsAuthorized(hasAccess);
      if (!hasAccess) {
        showBoundary(new Error('Unauthorized access'));
      }
    };
    checkAccess();
  }, [validateUserRole, showBoundary]);

  // Monitor component performance
  useEffect(() => {
    const renderEnd = performance.now();
    setRenderTime(renderEnd - renderStart.current);
  }, [networkData]);

  // Handle TDA parameter changes
  const handleParameterChange = useCallback(async (params) => {
    try {
      await computeTDA(params);
    } catch (error) {
      showBoundary(error);
    }
  }, [computeTDA, showBoundary]);

  if (!isAuthorized) {
    return null;
  }

  return (
    <AdminLayout>
      <ErrorBoundary>
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          className="space-y-6"
        >
          {/* Page Header */}
          <header className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Network Analytics
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Analyze community relationships and patterns through advanced network visualization
              </p>
            </div>

            {/* Performance Metrics */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Render time: {renderTime.toFixed(2)}ms
              </div>
            )}
          </header>

          {/* Main Visualization Area */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <VisualizationPanel
              className={classNames(
                'w-full min-h-[600px]',
                'transition-all duration-200'
              )}
              onParameterChange={handleParameterChange}
            />
          </div>

          {/* Loading Progress */}
          {isLoading && (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg"
            >
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Computing... {progress}%
                </span>
              </div>
            </div>
          )}

          {/* Accessibility Information */}
          <div className="sr-only" role="status" aria-live="polite">
            {isLoading ? 'Computing network analysis' : 'Network analysis ready'}
            {networkData && ` - ${networkData.nodes.length} nodes and ${networkData.edges.length} edges analyzed`}
          </div>
        </motion.div>
      </ErrorBoundary>
    </AdminLayout>
  );
};

export default AnalyticsPage;