/**
 * @fileoverview Type definitions for analytics service interfaces including TDA computation 
 * parameters, network analysis configurations, and graph query types.
 * @version 1.0.0
 */

// google-protobuf v3.x - Protocol buffer runtime types
import { Timestamp } from 'google-protobuf';

/**
 * Supported distance metrics for TDA computation
 */
export enum DistanceMetric {
  EUCLIDEAN = 'euclidean',
  MANHATTAN = 'manhattan',
  COSINE = 'cosine'
}

/**
 * Interface defining TDA computation parameters
 * @see Technical Specification Section 9.1.2
 */
export interface TDAParameters {
  /** Neighborhood size (range: 0.1-1.0, default: 0.5) */
  epsilon: number;
  
  /** Cluster density threshold (range: 5-50, default: 15) */
  minPoints: number;
  
  /** Visualization dimensionality (range: 2-3, default: 2) */
  dimension: number;
  
  /** Feature significance threshold (range: 0.1-0.9, default: 0.3) */
  persistenceThreshold: number;
  
  /** Distance metric for similarity measurement */
  distanceMetric: DistanceMetric;
}

/**
 * Interface defining network analysis configuration
 */
export interface NetworkAnalysisConfig {
  /** Array of network metrics to compute */
  metrics: string[];
  
  /** Analysis start date */
  startDate: Date;
  
  /** Analysis end date */
  endDate: Date;
}

/**
 * Interface defining graph query parameters
 * Supports sub-2 second response time requirement
 */
export interface GraphQuery {
  /** Cypher query pattern */
  queryPattern: string;
  
  /** Query parameters */
  parameters: Record<string, unknown>;
  
  /** Maximum number of results to return */
  limit: number;
}

/**
 * Interface defining persistence diagram data structure
 */
export interface PersistenceDiagram {
  /** Homology dimension */
  dimension: number;
  
  /** Array of birth-death point pairs */
  points: [number, number][];
}

/**
 * Interface defining topological feature properties
 */
export interface TopologicalFeature {
  /** Feature dimension */
  dimension: number;
  
  /** Feature persistence value */
  persistence: number;
  
  /** Feature birth value */
  birth: number;
  
  /** Feature death value */
  death: number;
}

/**
 * Interface defining network analysis metrics results
 */
export interface NetworkMetrics {
  /** Node centrality scores by node ID */
  centralityScores: Record<string, number>;
  
  /** Community-level metrics by community ID */
  communityMetrics: Record<string, number>;
  
  /** Timestamp when metrics were computed */
  computationTime: Date;
}