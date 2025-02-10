import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, QueryClient, useQueryClient } from '@tanstack/react-query'; // ^4.0.0
import {
  TDAParameters,
  NetworkAnalysisConfig,
  NetworkMetrics,
  PersistenceDiagram,
  VisualizationConfig,
  AnalyticsError
} from '../types/analytics';
import { apiClient } from '../lib/api-client';

// Default configuration values based on technical specifications
const DEFAULT_TDA_PARAMS: TDAParameters = {
  epsilon: 0.5,
  minPoints: 15,
  dimension: 2,
  persistenceThreshold: 0.3,
  distanceMetric: 'euclidean'
};

const DEFAULT_NETWORK_CONFIG: NetworkAnalysisConfig = {
  metrics: ['centrality', 'community'],
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: new Date(),
  includeInactive: false,
  maxDepth: 3
};

const DEFAULT_VISUALIZATION_CONFIG: VisualizationConfig = {
  width: 800,
  height: 600,
  showLabels: true,
  colorScheme: 'default',
  accessibilityMode: false,
  locale: 'en',
  animationDuration: 300,
  interactionMode: 'default'
};

// Analytics Context Type Definition
interface AnalyticsContextType {
  tdaParams: TDAParameters;
  setTDAParams: (params: TDAParameters) => Promise<void>;
  networkConfig: NetworkAnalysisConfig;
  setNetworkConfig: (config: NetworkAnalysisConfig) => Promise<void>;
  visualizationConfig: VisualizationConfig;
  setVisualizationConfig: (config: VisualizationConfig) => void;
  persistenceDiagram: PersistenceDiagram | null;
  networkMetrics: NetworkMetrics | null;
  isLoading: boolean;
  progress: number;
  error: AnalyticsError | null;
  resetError: () => void;
  isCacheStale: boolean;
  computeTDA: (params: TDAParameters) => Promise<void>;
  fetchNetworkAnalysis: (config: NetworkAnalysisConfig) => Promise<void>;
  resetCache: () => void;
}

// Provider Props Interface
interface AnalyticsProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<NetworkAnalysisConfig>;
  enableCache?: boolean;
  retryAttempts?: number;
}

// Create Analytics Context
const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

// Analytics Provider Component
export const AnalyticsProvider: React.FC<AnalyticsProviderProps> = ({
  children,
  initialConfig,
  enableCache = true,
  retryAttempts = 3
}) => {
  // State Management
  const [tdaParams, setTDAParamsState] = useState<TDAParameters>(DEFAULT_TDA_PARAMS);
  const [networkConfig, setNetworkConfigState] = useState<NetworkAnalysisConfig>({
    ...DEFAULT_NETWORK_CONFIG,
    ...initialConfig
  });
  const [visualizationConfig, setVisualizationConfig] = useState<VisualizationConfig>(
    DEFAULT_VISUALIZATION_CONFIG
  );
  const [error, setError] = useState<AnalyticsError | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  // TDA Computation Mutation
  const tdaMutation = useMutation({
    mutationFn: async (params: TDAParameters) => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const response = await apiClient.post<PersistenceDiagram>(
        '/analytics/tda',
        params,
        {
          signal: abortControllerRef.current.signal,
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.loaded / progressEvent.total;
            setProgress(Math.round(progress * 100));
          }
        }
      );
      return response.data;
    },
    onError: (error: Error) => {
      setError({
        code: 'TDA_COMPUTATION_ERROR',
        message: error.message,
        details: { params: tdaParams }
      });
    },
    retry: retryAttempts
  });

  // Network Analysis Query
  const { data: networkMetrics, isLoading } = useQuery({
    queryKey: ['networkAnalysis', networkConfig],
    queryFn: async () => {
      const response = await apiClient.get<NetworkMetrics>(
        '/analytics/network',
        { params: networkConfig }
      );
      return response.data;
    },
    enabled: enableCache,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: retryAttempts
  });

  // Handlers
  const setTDAParams = useCallback(async (params: TDAParameters) => {
    setTDAParamsState(params);
    await tdaMutation.mutateAsync(params);
  }, [tdaMutation]);

  const setNetworkConfig = useCallback(async (config: NetworkAnalysisConfig) => {
    setNetworkConfigState(config);
    await queryClient.invalidateQueries(['networkAnalysis']);
  }, [queryClient]);

  const computeTDA = useCallback(async (params: TDAParameters) => {
    try {
      await tdaMutation.mutateAsync(params);
    } catch (error) {
      setError({
        code: 'TDA_COMPUTATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { params }
      });
      throw error;
    }
  }, [tdaMutation]);

  const fetchNetworkAnalysis = useCallback(async (config: NetworkAnalysisConfig) => {
    try {
      await queryClient.invalidateQueries(['networkAnalysis']);
      await queryClient.fetchQuery(['networkAnalysis', config]);
    } catch (error) {
      setError({
        code: 'NETWORK_ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { config }
      });
      throw error;
    }
  }, [queryClient]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const resetCache = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  // Context value
  const contextValue = useMemo(() => ({
    tdaParams,
    setTDAParams,
    networkConfig,
    setNetworkConfig,
    visualizationConfig,
    setVisualizationConfig,
    persistenceDiagram: tdaMutation.data || null,
    networkMetrics: networkMetrics || null,
    isLoading: tdaMutation.isLoading || isLoading,
    progress,
    error,
    resetError,
    isCacheStale: queryClient.isFetching() > 0,
    computeTDA,
    fetchNetworkAnalysis,
    resetCache
  }), [
    tdaParams,
    setTDAParams,
    networkConfig,
    setNetworkConfig,
    visualizationConfig,
    tdaMutation.data,
    networkMetrics,
    tdaMutation.isLoading,
    isLoading,
    progress,
    error,
    resetError,
    queryClient,
    computeTDA,
    fetchNetworkAnalysis,
    resetCache
  ]);

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
};

// Custom hook for using analytics context
export const useAnalyticsContext = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalyticsContext must be used within an AnalyticsProvider');
  }
  return context;
};