import { Member } from '../types/members';

/**
 * Supported distance metrics for TDA computation
 * @enum {string}
 */
export enum DistanceMetric {
  EUCLIDEAN = 'euclidean',
  MANHATTAN = 'manhattan',
  COSINE = 'cosine'
}

/**
 * TDA computation parameters with strict range validation
 * @interface
 * @property {number} epsilon - Neighborhood size (range: 0.1-1.0)
 * @property {number} minPoints - Cluster density threshold (range: 5-50)
 * @property {number} dimension - Visualization dimensionality (2 or 3)
 * @property {number} persistenceThreshold - Feature significance threshold (range: 0.1-0.9)
 * @property {DistanceMetric} distanceMetric - Distance calculation method
 */
export interface TDAParameters {
  epsilon: number; // Range: 0.1-1.0
  minPoints: number; // Range: 5-50
  dimension: number; // Values: 2 or 3
  persistenceThreshold: number; // Range: 0.1-0.9
  distanceMetric: DistanceMetric;
}

/**
 * Network analysis configuration options
 * @interface
 * @property {string[]} metrics - Array of metrics to compute
 * @property {Date} startDate - Analysis period start
 * @property {Date} endDate - Analysis period end
 * @property {boolean} includeInactive - Include inactive members
 * @property {number} maxDepth - Maximum traversal depth
 */
export interface NetworkAnalysisConfig {
  metrics: string[];
  startDate: Date;
  endDate: Date;
  includeInactive: boolean;
  maxDepth: number;
}

/**
 * Graph query parameters with timeout and validation
 * @interface
 * @property {string} queryPattern - Cypher query pattern
 * @property {Record<string, unknown>} parameters - Query parameters
 * @property {number} limit - Maximum results limit
 * @property {number} timeout - Query timeout in milliseconds
 */
export interface GraphQuery {
  queryPattern: string;
  parameters: Record<string, unknown>;
  limit: number;
  timeout: number;
}

/**
 * Comprehensive network analysis metrics with performance tracking
 * @interface
 * @property {Record<string, number>} centralityScores - Node centrality metrics
 * @property {Record<string, number>} communityMetrics - Community detection metrics
 * @property {Date} computationTime - Metrics computation timestamp
 * @property {Record<string, number>} performanceMetrics - Computation performance data
 * @property {Record<string, number>} errorMargins - Statistical error margins
 */
export interface NetworkMetrics {
  centralityScores: Record<string, number>;
  communityMetrics: Record<string, number>;
  computationTime: Date;
  performanceMetrics: Record<string, number>;
  errorMargins: Record<string, number>;
}

/**
 * Visualization configuration with accessibility and i18n support
 * @interface
 * @property {number} width - Visualization width in pixels
 * @property {number} height - Visualization height in pixels
 * @property {boolean} showLabels - Toggle node/edge labels
 * @property {string} colorScheme - Color palette identifier
 * @property {boolean} accessibilityMode - Enable accessibility features
 * @property {string} locale - Internationalization locale
 * @property {number} animationDuration - Animation duration in milliseconds
 * @property {string} interactionMode - User interaction mode
 */
export interface VisualizationConfig {
  width: number;
  height: number;
  showLabels: boolean;
  colorScheme: string;
  accessibilityMode: boolean;
  locale: string;
  animationDuration: number;
  interactionMode: string;
}