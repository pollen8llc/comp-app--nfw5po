import { DistanceMetric, TDAParameters, VisualizationConfig } from '../types/analytics';

/**
 * Default TDA computation parameters
 * Configured based on empirical testing and performance benchmarks
 */
export const TDA_DEFAULTS: TDAParameters = {
  epsilon: 0.5,
  minPoints: 15,
  dimension: 2,
  persistenceThreshold: 0.3,
  distanceMetric: DistanceMetric.EUCLIDEAN
};

/**
 * Valid parameter ranges for TDA computation
 * Ensures input validation and prevents invalid configurations
 */
export const TDA_RANGES = {
  epsilon: {
    min: 0.1,
    max: 1.0,
    step: 0.1
  },
  minPoints: {
    min: 5,
    max: 50,
    step: 5
  },
  dimension: {
    min: 2,
    max: 3,
    step: 1
  },
  persistenceThreshold: {
    min: 0.1,
    max: 0.9,
    step: 0.1
  }
};

/**
 * Default visualization configuration with accessibility support
 * Implements WCAG 2.1 Level AA compliance requirements
 */
export const VISUALIZATION_DEFAULTS: VisualizationConfig = {
  width: 800,
  height: 600,
  showLabels: true,
  colorScheme: 'd3.schemeCategory10',
  accessibilityMode: false,
  locale: 'en',
  animationDuration: 300,
  interactionMode: 'default',
  zoomExtent: [0.1, 3],
  nodeSize: 8,
  linkDistance: 100,
  fontScaling: 1,
  screenReaderSupport: true,
  keyboardNavigation: true,
  ariaLabels: {
    node: 'Community member',
    edge: 'Connection between members',
    cluster: 'Group of related members'
  },
  highContrastMode: false
};

/**
 * Performance-optimized computation settings
 * Based on system benchmarks and resource constraints
 */
export const COMPUTATION_SETTINGS = {
  maxNodes: 1000,
  timeoutMs: 30000,
  batchSize: 100,
  cacheTimeMs: 300000,
  maxConcurrentComputations: 5,
  memoryLimitMB: 4096,
  errorRetryCount: 3,
  errorRetryDelayMs: 1000,
  performanceThresholds: {
    simpleQueryMs: 200,
    complexQueryMs: 1000,
    tdaComputationMs: 5000
  }
};

/**
 * Analytics event tracking configuration
 * Enables monitoring and performance analysis
 */
export const ANALYTICS_EVENTS = {
  computation: {
    start: 'analytics:computation:start',
    complete: 'analytics:computation:complete',
    error: 'analytics:computation:error'
  },
  visualization: {
    update: 'analytics:visualization:update',
    accessibilityToggle: 'analytics:visualization:accessibility',
    interactionComplete: 'analytics:visualization:interaction'
  }
};

/**
 * Consolidated analytics configuration object
 * Exports all settings for application-wide use
 */
export const analyticsConfig = {
  tda: {
    defaults: TDA_DEFAULTS,
    ranges: TDA_RANGES
  },
  visualization: VISUALIZATION_DEFAULTS,
  computation: COMPUTATION_SETTINGS,
  events: ANALYTICS_EVENTS
} as const;

/**
 * Type guard for validating TDA parameters
 * @param params - Parameters to validate
 * @returns boolean indicating if parameters are valid
 */
export const isValidTDAParams = (params: Partial<TDAParameters>): boolean => {
  if (!params) return false;

  return (
    (!params.epsilon || (params.epsilon >= TDA_RANGES.epsilon.min && params.epsilon <= TDA_RANGES.epsilon.max)) &&
    (!params.minPoints || (params.minPoints >= TDA_RANGES.minPoints.min && params.minPoints <= TDA_RANGES.minPoints.max)) &&
    (!params.dimension || (params.dimension >= TDA_RANGES.dimension.min && params.dimension <= TDA_RANGES.dimension.max)) &&
    (!params.persistenceThreshold || (params.persistenceThreshold >= TDA_RANGES.persistenceThreshold.min && 
      params.persistenceThreshold <= TDA_RANGES.persistenceThreshold.max))
  );
};

export default analyticsConfig;