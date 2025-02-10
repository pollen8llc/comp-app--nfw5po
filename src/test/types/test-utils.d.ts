import { Member } from '../../backend/shared/types/member.types';
import { Event, EventPlatform } from '../../backend/shared/types/event.types';
import { TDAParameters, DistanceMetric } from '../../backend/shared/types/analytics.types';
import { Config as JestConfig } from '@jest/types'; // v29.0.0
import { SuperTest, Test } from 'supertest'; // v6.3.0

/**
 * Configuration interface for test database setup
 */
export interface TestDatabaseConfig {
  url: string;
  username: string;
  password: string;
  databaseName: string;
  ssl?: boolean;
}

/**
 * Interface defining test database instance
 */
export interface TestDatabaseInstance {
  connection: any;
  isInitialized: boolean;
  metrics: TestMetrics;
}

/**
 * Interface defining performance thresholds for different operations
 * Maps to system performance requirements
 */
export interface PerformanceThresholds {
  graphQuery: number; // 2000ms threshold
  entityResolution: number; // 500ms threshold
  tdaComputation: number; // 5000ms threshold
  eventImport: number; // 30000ms threshold
  networkVisualization: number; // 2000ms threshold
}

/**
 * Interface defining test metrics for validation
 */
export interface TestMetrics {
  accuracy: number; // For 95% entity disambiguation requirement
  latency: number; // For sub-2 second response requirement
  successRate: number; // For 99% event import success requirement
  errorRate: number;
  timestamp: Date;
}

/**
 * Type definition for operation types in performance monitoring
 */
export type OperationType = 
  | 'GRAPH_QUERY'
  | 'ENTITY_RESOLUTION'
  | 'TDA_COMPUTATION'
  | 'EVENT_IMPORT'
  | 'NETWORK_VISUALIZATION';

/**
 * Interface for performance measurement data
 */
export interface PerformanceMeasurement {
  operationType: OperationType;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for performance report options
 */
export interface PerformanceReportOptions {
  startDate?: Date;
  endDate?: Date;
  operationTypes?: OperationType[];
  format?: 'detailed' | 'summary';
}

/**
 * Interface for performance report output
 */
export interface PerformanceReport {
  measurements: Record<OperationType, PerformanceMeasurement[]>;
  summary: {
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    thresholdViolations: number;
  };
  timestamp: Date;
}

/**
 * Interface extending Jest's expect for custom assertions
 */
declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchPerformanceThreshold(threshold: number): R;
      toMeetAccuracyTarget(target: number): R;
      toHaveSuccessRate(rate: number): R;
    }
  }
}

/**
 * Type definition for test database setup function
 */
export declare function setupTestDatabase(
  config: TestDatabaseConfig,
  options?: {
    clean?: boolean;
    timeout?: number;
    logging?: boolean;
  }
): Promise<TestDatabaseInstance>;

/**
 * Type definition for test database teardown function
 */
export declare function teardownTestDatabase(
  instance: TestDatabaseInstance,
  options?: {
    preserveData?: boolean;
    timeout?: number;
  }
): Promise<void>;

/**
 * Type definition for performance monitoring class
 */
export declare class TestPerformanceMonitor {
  private measurements: Map<OperationType, PerformanceMeasurement[]>;
  private thresholds: PerformanceThresholds;
  private aggregator: MetricsAggregator;

  constructor(thresholds: PerformanceThresholds, options?: {
    aggregationInterval?: number;
    retentionPeriod?: number;
  });

  recordMeasurement(operationType: OperationType, measurement: PerformanceMeasurement): void;
  generateReport(options?: PerformanceReportOptions): PerformanceReport;
  validateThresholds(): boolean;
  clearMeasurements(): void;
}

/**
 * Namespace containing mock data generator functions
 */
export declare namespace MockDataGenerators {
  function generateMockMember(overrides?: Partial<Member>): Member;
  function generateMockEvent(overrides?: Partial<Event>): Event;
  function generateMockTDAParameters(overrides?: Partial<TDAParameters>): TDAParameters;
  function generateMockGraphData(nodeCount: number, edgeDensity: number): {
    nodes: Array<{ id: string; data: Record<string, unknown> }>;
    edges: Array<{ source: string; target: string; data: Record<string, unknown> }>;
  };
  function generateMockMetrics(overrides?: Partial<TestMetrics>): TestMetrics;
}

/**
 * Type definition for HTTP request testing utility
 */
export declare function createTestClient(): SuperTest<Test>;

/**
 * Type definition for test assertion helpers
 */
export declare namespace TestAssertions {
  function assertPerformanceThreshold(actual: number, threshold: number): void;
  function assertAccuracyTarget(actual: number, target: number): void;
  function assertSuccessRate(actual: number, expected: number): void;
  function assertValidGraphStructure(data: any): void;
}