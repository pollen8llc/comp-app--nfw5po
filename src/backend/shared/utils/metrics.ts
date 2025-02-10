import newrelic from 'newrelic'; // v9.x
import { Registry, Histogram, Gauge, Counter, Summary } from 'prom-client'; // v14.x
import { ERROR_CODES } from '../utils/error-codes';
import { NetworkMetrics } from '../types/analytics.types';

// Global metric registry
const registry = new Registry();

// Constants
const METRIC_PREFIX = 'community_platform';
const DEFAULT_BUCKETS = [0.1, 0.5, 1, 2, 5, 10];
const METRIC_RETENTION_DAYS = 30;

// Metric validation thresholds
const THRESHOLDS = {
  queryDurationMax: 2000, // 2 seconds max for graph queries
  batchSize: 1000,
  errorRateThreshold: 0.05
};

// Interfaces
interface MetricConfig {
  serviceName: string;
  customBuckets?: number[];
  labels?: string[];
  retentionDays?: number;
}

interface MetricBuffer {
  metrics: any[];
  lastFlush: Date;
}

interface MetricBatch {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: Date;
}

/**
 * Enhanced metric collection and management system
 */
export class MetricCollector {
  private readonly queryDurationHistogram: Histogram;
  private readonly resourceUsageGauge: Gauge;
  private readonly operationLatencySummary: Summary;
  private readonly errorCounter: Counter;
  private readonly metricBuffers: Map<string, MetricBuffer>;
  private readonly serviceName: string;

  constructor(serviceName: string, config: MetricConfig) {
    this.serviceName = serviceName;
    this.metricBuffers = new Map();

    // Initialize Prometheus collectors
    this.queryDurationHistogram = new Histogram({
      name: `${METRIC_PREFIX}_query_duration_seconds`,
      help: 'Graph query execution duration in seconds',
      labelNames: ['query_type', 'complexity'],
      buckets: config.customBuckets || DEFAULT_BUCKETS
    });

    this.resourceUsageGauge = new Gauge({
      name: `${METRIC_PREFIX}_resource_usage`,
      help: 'Resource utilization metrics',
      labelNames: ['resource_type']
    });

    this.operationLatencySummary = new Summary({
      name: `${METRIC_PREFIX}_operation_latency`,
      help: 'Operation latency summary',
      labelNames: ['operation_type'],
      maxAgeSeconds: config.retentionDays || METRIC_RETENTION_DAYS * 86400
    });

    this.errorCounter = new Counter({
      name: `${METRIC_PREFIX}_errors_total`,
      help: 'Total error count by type',
      labelNames: ['error_type']
    });

    // Register collectors
    registry.registerMetric(this.queryDurationHistogram);
    registry.registerMetric(this.resourceUsageGauge);
    registry.registerMetric(this.operationLatencySummary);
    registry.registerMetric(this.errorCounter);
  }

  /**
   * Records multiple metrics efficiently in a single batch
   */
  public async recordMetricBatch(metrics: MetricBatch[]): Promise<void> {
    try {
      // Validate batch size
      if (metrics.length > THRESHOLDS.batchSize) {
        throw new Error(`Batch size exceeds limit of ${THRESHOLDS.batchSize}`);
      }

      // Process metrics
      for (const metric of metrics) {
        const { name, value, labels = {}, timestamp = new Date() } = metric;

        // Buffer metrics
        const buffer = this.getOrCreateBuffer(name);
        buffer.metrics.push({ value, labels, timestamp });

        // Send to New Relic
        newrelic.recordMetric(`Custom/${name}`, value);
      }

      // Flush buffers if needed
      await this.flushBuffersIfNeeded();
    } catch (error) {
      this.errorCounter.inc({ error_type: 'batch_processing_error' });
      throw error;
    }
  }

  /**
   * Returns current metric snapshot
   */
  public async getMetricSnapshot(): Promise<Record<string, unknown>> {
    return await registry.getMetricsAsJSON();
  }

  private getOrCreateBuffer(metricName: string): MetricBuffer {
    if (!this.metricBuffers.has(metricName)) {
      this.metricBuffers.set(metricName, {
        metrics: [],
        lastFlush: new Date()
      });
    }
    return this.metricBuffers.get(metricName)!;
  }

  private async flushBuffersIfNeeded(): Promise<void> {
    const now = new Date();
    for (const [name, buffer] of this.metricBuffers.entries()) {
      if (buffer.metrics.length > 0 && 
          (buffer.metrics.length >= THRESHOLDS.batchSize || 
           now.getTime() - buffer.lastFlush.getTime() > 60000)) {
        await this.flushBuffer(name, buffer);
      }
    }
  }

  private async flushBuffer(name: string, buffer: MetricBuffer): Promise<void> {
    try {
      // Process buffered metrics
      const metrics = buffer.metrics;
      buffer.metrics = [];
      buffer.lastFlush = new Date();

      // Update Prometheus metrics
      for (const metric of metrics) {
        this.updatePrometheusMetric(name, metric);
      }
    } catch (error) {
      this.errorCounter.inc({ error_type: 'buffer_flush_error' });
      throw error;
    }
  }

  private updatePrometheusMetric(name: string, metric: any): void {
    const { value, labels } = metric;
    
    if (name.includes('duration') || name.includes('latency')) {
      this.queryDurationHistogram.observe(labels, value);
    } else if (name.includes('usage')) {
      this.resourceUsageGauge.set(labels, value);
    } else if (name.includes('operation')) {
      this.operationLatencySummary.observe(labels, value);
    }
  }
}

/**
 * Initializes and configures metric collection for the service
 */
export async function initializeMetrics(
  serviceName: string,
  config: MetricConfig
): Promise<void> {
  try {
    // Initialize New Relic
    newrelic.addCustomAttribute('service_name', serviceName);
    
    // Configure default metrics
    registry.setDefaultLabels({
      service: serviceName,
      environment: process.env.NODE_ENV || 'development'
    });

    // Enable metric collection
    await registry.setMetricsTTL(
      config.retentionDays || METRIC_RETENTION_DAYS
    );

  } catch (error) {
    console.error('Failed to initialize metrics:', error);
    throw error;
  }
}

/**
 * Records the execution time of graph queries with detailed performance data
 */
export async function recordGraphQueryTime(
  queryType: string,
  durationMs: number,
  queryMetadata: Record<string, unknown>
): Promise<void> {
  try {
    // Validate duration
    if (durationMs > THRESHOLDS.queryDurationMax) {
      const error = new Error(`Query duration exceeded threshold: ${durationMs}ms`);
      newrelic.noticeError(error, {
        query_type: queryType,
        duration_ms: durationMs
      });
    }

    // Record metrics
    const durationSeconds = durationMs / 1000;
    const labels = {
      query_type: queryType,
      complexity: queryMetadata.complexity as string || 'unknown'
    };

    // Update Prometheus metrics
    registry.getSingleMetric(`${METRIC_PREFIX}_query_duration_seconds`)
      ?.observe(labels, durationSeconds);

    // Send to New Relic
    newrelic.recordMetric(`Custom/GraphQuery/${queryType}`, durationSeconds);

    // Track error rates
    if (queryMetadata.error) {
      registry.getSingleMetric(`${METRIC_PREFIX}_errors_total`)
        ?.inc({ error_type: ERROR_CODES.GRAPH_QUERY_ERROR });
    }

  } catch (error) {
    console.error('Failed to record query metrics:', error);
    throw error;
  }
}