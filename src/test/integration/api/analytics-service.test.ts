import { TestAPIClient } from '../../utils/api-client';
import { DistanceMetric, TDAParameters, NetworkAnalysisConfig } from '../../../web/src/types/analytics';
import { APIResponse } from '../../../web/src/types/api';
import { jest } from '@jest/globals';

// API base URL and performance thresholds from technical specification
const API_BASE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5000';
const PERFORMANCE_THRESHOLDS = {
  TDA_COMPUTATION: 5000, // 5s max for TDA computation
  SIMPLE_QUERY: 200,     // 200ms for simple queries
  COMPLEX_QUERY: 1000,   // 1s for complex queries
  BATCH_PROCESSING: 30000 // 30s for batch processing
};

// Test timeout configuration
jest.setTimeout(30000);

describe('Analytics Service API Integration Tests', () => {
  let apiClient: TestAPIClient;
  let performanceMetrics: Record<string, number[]> = {};

  beforeAll(async () => {
    apiClient = new TestAPIClient(API_BASE_URL, 30000);
    performanceMetrics = {
      tdaComputation: [],
      networkMetrics: [],
      batchProcessing: []
    };
  });

  afterAll(async () => {
    // Generate performance report
    const report = Object.entries(performanceMetrics).map(([metric, times]) => ({
      metric,
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      max: Math.max(...times),
      min: Math.min(...times),
      p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)]
    }));
    console.log('Performance Report:', report);
  });

  describe('TDA Computation', () => {
    test('should compute TDA results within performance thresholds', async () => {
      const params: TDAParameters = {
        epsilon: 0.5,
        minPoints: 15,
        dimension: 2,
        persistenceThreshold: 0.3,
        distanceMetric: DistanceMetric.EUCLIDEAN
      };

      const startTime = Date.now();
      const response = await apiClient.post<APIResponse<unknown>>('/analytics/tda', params);
      const duration = Date.now() - startTime;

      performanceMetrics.tdaComputation.push(duration);

      expect(response.status).toBe(200);
      expect(duration).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.TDA_COMPUTATION);
      expect(response.data).toHaveProperty('persistenceDiagram');
      expect(response.data).toHaveProperty('computationTime');
    });

    test('should handle invalid TDA parameters with proper error responses', async () => {
      const invalidParams: TDAParameters = {
        epsilon: 1.5, // Invalid: > 1.0
        minPoints: 3, // Invalid: < 5
        dimension: 4, // Invalid: not 2 or 3
        persistenceThreshold: 0.95, // Invalid: > 0.9
        distanceMetric: DistanceMetric.EUCLIDEAN
      };

      const response = await apiClient.post('/analytics/tda', invalidParams).catch(err => err);

      expect(response.status).toBe(400);
      expect(response.data.validationErrors).toHaveLength(4);
      expect(response.data.validationErrors).toContainEqual(
        expect.objectContaining({ field: 'epsilon' })
      );
    });
  });

  describe('Network Metrics', () => {
    test('should compute network metrics within performance thresholds', async () => {
      const config: NetworkAnalysisConfig = {
        metrics: ['centrality', 'clustering', 'pathLength'],
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        includeInactive: false,
        maxDepth: 3
      };

      const startTime = Date.now();
      const response = await apiClient.post<APIResponse<unknown>>('/analytics/network-metrics', config);
      const duration = Date.now() - startTime;

      performanceMetrics.networkMetrics.push(duration);

      expect(response.status).toBe(200);
      expect(duration).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.COMPLEX_QUERY);
      expect(response.data).toHaveProperty('centralityScores');
      expect(response.data).toHaveProperty('communityMetrics');
    });
  });

  describe('Batch Processing', () => {
    test('should handle large graphs efficiently with batch processing', async () => {
      const largeGraphData = generateLargeGraphData(1000); // Helper to generate test data
      
      const startTime = Date.now();
      const response = await apiClient.post<APIResponse<unknown>>('/analytics/batch', {
        data: largeGraphData,
        batchSize: 100
      });
      const duration = Date.now() - startTime;

      performanceMetrics.batchProcessing.push(duration);

      expect(response.status).toBe(200);
      expect(duration).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.BATCH_PROCESSING);
      expect(response.data).toHaveProperty('processedBatches');
      expect(response.data).toHaveProperty('totalNodes');
    });

    test('should recover from batch processing errors', async () => {
      const graphData = generateLargeGraphData(500);
      graphData[250].data = null; // Inject error in middle of batch

      const response = await apiClient.post<APIResponse<unknown>>('/analytics/batch', {
        data: graphData,
        batchSize: 50,
        continueOnError: true
      });

      expect(response.status).toBe(200);
      expect(response.data.errors).toHaveLength(1);
      expect(response.data.processedBatches).toBe(9); // One batch failed
    });
  });
});

// Helper function to generate test graph data
function generateLargeGraphData(nodeCount: number) {
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node-${i}`,
      data: {
        connections: Math.floor(Math.random() * 10),
        weight: Math.random()
      }
    });
  }
  return nodes;
}