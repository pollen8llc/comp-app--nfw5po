/**
 * @fileoverview Zod schema definitions for analytics service data validation
 * Implements strict validation rules for TDA parameters, network analysis configs,
 * and graph queries with performance constraints.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.21.4
import { DistanceMetric, TDAParameters } from '../types/analytics.types';

/**
 * Schema for validating distance metric enum values
 */
export const distanceMetricSchema = z.enum([
  DistanceMetric.EUCLIDEAN,
  DistanceMetric.MANHATTAN,
  DistanceMetric.COSINE
], {
  errorMap: (issue) => ({
    message: 'Invalid distance metric. Must be one of: euclidean, manhattan, cosine'
  })
});

/**
 * Schema for validating TDA computation parameters
 * Implements strict range validation based on technical specifications
 */
export const tdaParametersSchema = z.object({
  epsilon: z.number()
    .min(0.1, 'Epsilon must be at least 0.1')
    .max(1.0, 'Epsilon cannot exceed 1.0')
    .default(0.5),
    
  minPoints: z.number()
    .int('MinPoints must be an integer')
    .min(5, 'MinPoints must be at least 5')
    .max(50, 'MinPoints cannot exceed 50')
    .default(15),
    
  dimension: z.number()
    .int('Dimension must be an integer')
    .min(2, 'Dimension must be at least 2')
    .max(3, 'Dimension cannot exceed 3')
    .default(2),
    
  persistenceThreshold: z.number()
    .min(0.1, 'Persistence threshold must be at least 0.1')
    .max(0.9, 'Persistence threshold cannot exceed 0.9')
    .default(0.3),
    
  distanceMetric: distanceMetricSchema.default(DistanceMetric.EUCLIDEAN)
}).strict();

/**
 * Schema for validating network analysis configuration
 * Implements performance constraints for computation time
 */
export const networkAnalysisConfigSchema = z.object({
  metrics: z.array(z.string())
    .min(1, 'At least one metric must be specified')
    .max(10, 'Cannot compute more than 10 metrics simultaneously')
    .refine(metrics => metrics.every(m => 
      ['centrality', 'community', 'density', 'diameter'].includes(m)
    ), 'Invalid metric specified'),
    
  startDate: z.string()
    .datetime('Invalid start date format')
    .refine(date => new Date(date) <= new Date(), 'Start date cannot be in the future'),
    
  endDate: z.string()
    .datetime('Invalid end date format')
    .refine(date => new Date(date) <= new Date(), 'End date cannot be in the future'),
    
  maxComputationTime: z.number()
    .int('Computation time limit must be an integer')
    .min(1, 'Computation time limit must be at least 1 second')
    .max(30, 'Computation time cannot exceed 30 seconds')
    .default(10)
}).refine(
  data => new Date(data.startDate) < new Date(data.endDate),
  'Start date must be before end date'
);

/**
 * Schema for validating graph queries with performance constraints
 * Supports sub-2 second response time requirement
 */
export const graphQuerySchema = z.object({
  queryPattern: z.string()
    .min(1, 'Query pattern cannot be empty')
    .max(1000, 'Query pattern too complex')
    .refine(pattern => !pattern.includes('DELETE'), 'DELETE operations not allowed')
    .refine(pattern => !pattern.includes('CREATE'), 'CREATE operations not allowed'),
    
  parameters: z.record(z.string(), z.unknown())
    .refine(params => Object.keys(params).length <= 20, 'Too many query parameters'),
    
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(1000, 'Cannot return more than 1000 results')
    .default(100),
    
  complexity: z.number()
    .int('Complexity score must be an integer')
    .min(1, 'Complexity score must be at least 1')
    .max(10, 'Query too complex for performance requirements')
    .default(1)
}).strict();

/**
 * Schema for validating network analysis results with performance tracking
 */
export const networkMetricsSchema = z.object({
  centralityScores: z.record(z.string(), z.number()
    .min(0, 'Centrality score cannot be negative')
    .max(1, 'Centrality score cannot exceed 1')
  ),
  
  communityMetrics: z.record(z.string(), z.number()
    .min(0, 'Community metric cannot be negative')
  ),
  
  computationTime: z.date()
    .refine(date => date <= new Date(), 'Computation time cannot be in the future'),
    
  performanceMetrics: z.object({
    queryTime: z.number()
      .min(0, 'Query time cannot be negative')
      .max(2000, 'Query time exceeds 2 second SLA'),
      
    memoryUsage: z.number()
      .min(0, 'Memory usage cannot be negative'),
      
    nodeCount: z.number()
      .int('Node count must be an integer')
      .min(0, 'Node count cannot be negative')
  })
}).strict();