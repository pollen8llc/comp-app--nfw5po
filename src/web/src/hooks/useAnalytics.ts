import { useState, useCallback, useMemo } from 'react'; // v18.0.0
import { useQuery, useMutation, UseQueryResult } from '@tanstack/react-query'; // v4.0.0
import { TDAParameters, NetworkAnalysisConfig, NetworkMetrics } from '../types/analytics';
import { apiClient } from '../lib/api-client';

// Constants for TDA parameter validation
const TDA_VALIDATION = {
  EPSILON: { min: 0.1, max: 1.0, default: 0.5 },
  MIN_POINTS: { min: 5, max: 50, default: 15 },
  DIMENSION: { min: 2, max: 3, default: 2 },
  PERSISTENCE: { min: 0.1, max: 0.9, default: 0.3 }
};

// Analytics error types
type AnalyticsError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

/**
 * Custom hook for managing analytics operations with advanced caching and error handling
 * @returns {Object} Analytics state and operations
 */
export const useAnalytics = () => {
  // State for TDA parameters with validated defaults
  const [tdaParams, setTDAParams] = useState<TDAParameters>({
    epsilon: TDA_VALIDATION.EPSILON.default,
    minPoints: TDA_VALIDATION.MIN_POINTS.default,
    dimension: TDA_VALIDATION.DIMENSION.default,
    persistenceThreshold: TDA_VALIDATION.PERSISTENCE.default,
    distanceMetric: 'euclidean'
  });

  // State for computation progress
  const [progress, setProgress] = useState<number>(0);

  // Error handling state
  const [error, setError] = useState<AnalyticsError | null>(null);

  /**
   * Validates TDA parameters against defined ranges
   */
  const validateTDAParams = useCallback((params: TDAParameters): boolean => {
    try {
      if (params.epsilon < TDA_VALIDATION.EPSILON.min || params.epsilon > TDA_VALIDATION.EPSILON.max) {
        throw new Error(`Epsilon must be between ${TDA_VALIDATION.EPSILON.min} and ${TDA_VALIDATION.EPSILON.max}`);
      }
      if (params.minPoints < TDA_VALIDATION.MIN_POINTS.min || params.minPoints > TDA_VALIDATION.MIN_POINTS.max) {
        throw new Error(`MinPoints must be between ${TDA_VALIDATION.MIN_POINTS.min} and ${TDA_VALIDATION.MIN_POINTS.max}`);
      }
      if (params.dimension < TDA_VALIDATION.DIMENSION.min || params.dimension > TDA_VALIDATION.DIMENSION.max) {
        throw new Error(`Dimension must be ${TDA_VALIDATION.DIMENSION.min} or ${TDA_VALIDATION.DIMENSION.max}`);
      }
      if (params.persistenceThreshold < TDA_VALIDATION.PERSISTENCE.min || params.persistenceThreshold > TDA_VALIDATION.PERSISTENCE.max) {
        throw new Error(`Persistence threshold must be between ${TDA_VALIDATION.PERSISTENCE.min} and ${TDA_VALIDATION.PERSISTENCE.max}`);
      }
      return true;
    } catch (err) {
      setError({ code: 'VALIDATION_ERROR', message: err instanceof Error ? err.message : 'Invalid parameters' });
      return false;
    }
  }, []);

  /**
   * Network analysis query with SWR caching
   */
  const networkAnalysisQuery: UseQueryResult<NetworkMetrics> = useQuery(
    ['networkAnalysis', tdaParams],
    async () => {
      try {
        const response = await apiClient.get<NetworkMetrics>('/analytics/network', {
          params: tdaParams,
          headers: {
            'Cache-Control': 'max-age=300' // 5 minute cache
          }
        });
        return response.data;
      } catch (err) {
        throw new Error('Failed to fetch network analysis');
      }
    },
    {
      staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
      cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
      retry: 2,
      onError: (err) => {
        setError({
          code: 'NETWORK_ANALYSIS_ERROR',
          message: err instanceof Error ? err.message : 'Network analysis failed'
        });
      }
    }
  );

  /**
   * TDA computation mutation with progress tracking
   */
  const tdaMutation = useMutation(
    async (params: TDAParameters) => {
      if (!validateTDAParams(params)) {
        throw new Error('Parameter validation failed');
      }

      const response = await apiClient.post<void>('/analytics/tda', params, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(progress);
          }
        }
      });
      return response.data;
    },
    {
      onError: (err) => {
        setError({
          code: 'TDA_COMPUTATION_ERROR',
          message: err instanceof Error ? err.message : 'TDA computation failed'
        });
      },
      onSuccess: () => {
        setProgress(100);
        networkAnalysisQuery.refetch(); // Refresh network analysis after successful computation
      }
    }
  );

  /**
   * Memoized network analysis configuration
   */
  const networkConfig = useMemo<NetworkAnalysisConfig>(() => ({
    metrics: ['centrality', 'community', 'performance'],
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    endDate: new Date(),
    includeInactive: false,
    maxDepth: 3
  }), []);

  /**
   * Error reset handler
   */
  const resetError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Parameter update handler with validation
   */
  const updateTDAParams = useCallback((newParams: Partial<TDAParameters>) => {
    setTDAParams((current) => {
      const updated = { ...current, ...newParams };
      validateTDAParams(updated);
      return updated;
    });
  }, [validateTDAParams]);

  return {
    // State
    tdaParams,
    networkData: networkAnalysisQuery.data,
    isLoading: networkAnalysisQuery.isLoading || tdaMutation.isLoading,
    error,
    progress,

    // Operations
    setTDAParams: updateTDAParams,
    computeTDA: tdaMutation.mutate,
    resetError,
    refetchNetwork: networkAnalysisQuery.refetch,

    // Configuration
    networkConfig
  };
};