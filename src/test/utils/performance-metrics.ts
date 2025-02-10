import pino from 'pino'; // v8.x
import { Registry, Histogram, Counter } from 'prom-client'; // v14.x
import { logger } from '../backend/api-gateway/src/utils/logger';
import { ERROR_CODES } from '../backend/shared/utils/error-codes';

// Performance thresholds based on technical specifications
const PERFORMANCE_THRESHOLDS = {
  SIMPLE_GRAPH_QUERY: {
    responseTime: 200, // ms
    qps: 1000,
    errorRate: 0.01
  },
  COMPLEX_GRAPH_QUERY: {
    responseTime: 1000, // ms
    qps: 100,
    errorRate: 0.01
  },
  ENTITY_RESOLUTION: {
    responseTime: 500, // ms
    rps: 50,
    errorRate: 0.01
  },
  TDA_COMPUTATION: {
    responseTime: 5000, // ms
    rps: 10,
    errorRate: 0.01
  },
  EVENT_IMPORT: {
    responseTime: 30000, // ms
    rps: 5,
    errorRate: 0.01
  },
  NETWORK_VISUALIZATION: {
    responseTime: 2000, // ms
    rps: 100,
    errorRate: 0.01
  }
} as const;

// Initialize Prometheus registry
const registry = new Registry();

// Define metric collectors
const responseTimeHistogram = new Histogram({
  name: 'operation_response_time_ms',
  help: 'Response time in milliseconds',
  labelNames: ['operation_type', 'status'],
  buckets: [50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000]
});

const throughputCounter = new Counter({
  name: 'operation_throughput_total',
  help: 'Total number of operations',
  labelNames: ['operation_type', 'status']
});

const errorCounter = new Counter({
  name: 'operation_errors_total',
  help: 'Total number of operation errors',
  labelNames: ['operation_type', 'error_code']
});

// Register metrics
registry.registerMetric(responseTimeHistogram);
registry.registerMetric(throughputCounter);
registry.registerMetric(errorCounter);

interface PerformanceMetric {
  operationType: string;
  responseTime: number;
  success: boolean;
  errorCode?: string;
  resourceUsage?: {
    cpu: number;
    memory: number;
  };
}

interface ValidationResult {
  passed: boolean;
  thresholdExceeded: boolean;
  metrics: {
    responseTime: number;
    throughput: number;
    errorRate: number;
  };
  recommendations?: string[];
}

interface MetricsSummary {
  operationType: string;
  duration: number;
  samples: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errorRate: number;
}

/**
 * Measures response time for a given operation with high-precision timing
 */
export async function measureResponseTime(
  operationType: string,
  operation: Promise<any>
): Promise<PerformanceMetric> {
  const startTime = process.hrtime.bigint();
  let success = true;
  let errorCode: string | undefined;

  try {
    await operation;
    throughputCounter.inc({ operation_type: operationType, status: 'success' });
  } catch (error) {
    success = false;
    errorCode = error.code || ERROR_CODES.INTERNAL_SERVER_ERROR;
    errorCounter.inc({ operation_type: operationType, error_code: errorCode });
    throughputCounter.inc({ operation_type: operationType, status: 'error' });
    throw error;
  } finally {
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

    responseTimeHistogram.observe(
      { operation_type: operationType, status: success ? 'success' : 'error' },
      responseTime
    );

    logger.info('Performance metric recorded', {
      operationType,
      responseTime,
      success,
      errorCode
    });

    return {
      operationType,
      responseTime,
      success,
      errorCode,
      resourceUsage: {
        cpu: process.cpuUsage().user / 1000,
        memory: process.memoryUsage().heapUsed / 1024 / 1024
      }
    };
  }
}

/**
 * Validates performance metrics against defined thresholds
 */
export function validatePerformance(
  operationType: string,
  metrics: PerformanceMetric
): ValidationResult {
  const threshold = PERFORMANCE_THRESHOLDS[operationType];
  if (!threshold) {
    throw new Error(`No threshold defined for operation type: ${operationType}`);
  }

  const result: ValidationResult = {
    passed: true,
    thresholdExceeded: false,
    metrics: {
      responseTime: metrics.responseTime,
      throughput: 0,
      errorRate: 0
    },
    recommendations: []
  };

  // Check response time threshold
  if (metrics.responseTime > threshold.responseTime) {
    result.passed = false;
    result.thresholdExceeded = true;
    result.recommendations?.push(
      `Response time (${metrics.responseTime}ms) exceeds threshold (${threshold.responseTime}ms)`
    );
  }

  // Calculate and validate throughput
  const throughputMetric = throughputCounter.get();
  const currentThroughput = throughputMetric.values[0].value;
  result.metrics.throughput = currentThroughput;

  // Calculate and validate error rate
  const errorMetric = errorCounter.get();
  const totalErrors = errorMetric.values[0].value;
  result.metrics.errorRate = totalErrors / currentThroughput;

  if (result.metrics.errorRate > threshold.errorRate) {
    result.passed = false;
    result.recommendations?.push(
      `Error rate (${result.metrics.errorRate}) exceeds threshold (${threshold.errorRate})`
    );
  }

  return result;
}

/**
 * Collects performance metrics over a specified time window
 */
export async function collectMetrics(
  operationType: string,
  durationMs: number
): Promise<MetricsSummary> {
  const startTime = Date.now();
  const metrics: number[] = [];

  while (Date.now() - startTime < durationMs) {
    const histogram = await responseTimeHistogram.get();
    metrics.push(...histogram.values.map(v => v.value));
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Calculate percentiles
  metrics.sort((a, b) => a - b);
  const p50 = metrics[Math.floor(metrics.length * 0.5)];
  const p90 = metrics[Math.floor(metrics.length * 0.9)];
  const p95 = metrics[Math.floor(metrics.length * 0.95)];
  const p99 = metrics[Math.floor(metrics.length * 0.99)];

  // Calculate throughput and error rate
  const throughputMetric = await throughputCounter.get();
  const errorMetric = await errorCounter.get();
  const throughput = throughputMetric.values[0].value / (durationMs / 1000);
  const errorRate = errorMetric.values[0].value / throughputMetric.values[0].value;

  return {
    operationType,
    duration: durationMs,
    samples: metrics.length,
    percentiles: { p50, p90, p95, p99 },
    throughput,
    errorRate
  };
}

/**
 * Exports collected metrics to Prometheus monitoring system
 */
export async function exportMetrics(metrics: MetricsSummary): Promise<void> {
  try {
    const metricsData = await registry.getMetricsAsJSON();
    logger.info('Metrics exported successfully', { metrics: metricsData });
  } catch (error) {
    logger.error('Failed to export metrics', error);
    throw error;
  }
}

// Export performance thresholds for external use
export { PERFORMANCE_THRESHOLDS };