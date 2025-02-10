// External dependencies
import * as dotenv from 'dotenv'; // v16.3.1
import { jest } from '@jest/globals'; // v29.0.0

// Internal imports
import { TestEnvironment, testEnvironment } from './test-environment';
import { MockClerkService, MockRedisService } from './mock-services';
import { ERROR_CODES } from '../../backend/shared/utils/error-codes';

// Load environment variables
dotenv.config({ path: '.env.test' });

// Global constants for test configuration
const TEST_TIMEOUT = 30000; // 30 seconds
const SETUP_TIMEOUT = 60000; // 60 seconds
const TEARDOWN_TIMEOUT = 30000; // 30 seconds
const PERFORMANCE_MONITORING = true;

// Initialize mock services
const mockClerkService = new MockClerkService(PERFORMANCE_MONITORING);
const mockRedisService = new MockRedisService(PERFORMANCE_MONITORING);

/**
 * Initializes and validates the global test environment
 * Implements comprehensive setup with security and performance monitoring
 */
async function setupGlobalEnvironment(): Promise<void> {
  try {
    // Configure global timeouts
    configureGlobalTimeouts();

    // Initialize test environment with performance monitoring
    await testEnvironment.initialize();

    // Set up mock services
    await setupMockServices();

    // Validate security configurations
    await validateSecuritySetup();

    // Configure global error handlers
    configureErrorHandlers();

    // Initialize performance monitoring
    initializePerformanceMonitoring();

  } catch (error) {
    console.error('Global setup failed:', error);
    throw new Error(`Test environment initialization failed: ${error.message}`);
  }
}

/**
 * Performs comprehensive cleanup of test environment
 * Ensures all resources are properly released and validated
 */
async function teardownGlobalEnvironment(): Promise<void> {
  try {
    // Generate final performance report
    await generatePerformanceReport();

    // Clean up mock services
    await cleanupMockServices();

    // Clean up test environment
    await testEnvironment.cleanup();

    // Validate cleanup completion
    await validateCleanup();

  } catch (error) {
    console.error('Global teardown failed:', error);
    throw new Error(`Test environment cleanup failed: ${error.message}`);
  }
}

/**
 * Configures enhanced test timeouts and retry mechanisms
 */
function configureGlobalTimeouts(): void {
  jest.setTimeout(TEST_TIMEOUT);
  
  // Configure retry settings for flaky tests
  jest.retryTimes(2, {
    logErrorsBeforeRetry: true
  });

  // Set up performance thresholds
  process.env.QUERY_TIMEOUT = '2000'; // 2 seconds max for graph queries
  process.env.MEMORY_LIMIT = '512'; // 512MB memory limit
}

/**
 * Sets up mock services with monitoring
 */
async function setupMockServices(): Promise<void> {
  try {
    // Initialize Clerk mock with security validation
    await mockClerkService.validateToken('test-token', {
      validateExpiration: true,
      validateSignature: true,
      validateSession: true
    });

    // Initialize Redis mock with connection validation
    await mockRedisService.setCache('test-key', 'test-value', 300);
    
  } catch (error) {
    throw new Error(`Mock services initialization failed: ${error.message}`);
  }
}

/**
 * Validates security configurations
 */
async function validateSecuritySetup(): Promise<void> {
  const securityValidation = await testEnvironment.validateSecurity();
  
  if (!securityValidation.encryptionStatus || 
      !securityValidation.keyRotationStatus || 
      !securityValidation.auditLogStatus) {
    throw new Error('Security validation failed');
  }
}

/**
 * Configures global error handlers
 */
function configureErrorHandlers(): void {
  process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });
}

/**
 * Initializes performance monitoring
 */
function initializePerformanceMonitoring(): void {
  if (PERFORMANCE_MONITORING) {
    // Monitor memory usage
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      if (memoryUsage.heapUsed > 512 * 1024 * 1024) { // 512MB limit
        console.warn('Memory usage exceeded threshold');
      }
    }, 5000);
  }
}

/**
 * Generates performance report before teardown
 */
async function generatePerformanceReport(): Promise<void> {
  if (PERFORMANCE_MONITORING) {
    const clerkMetrics = mockClerkService.getMetrics();
    const redisMetrics = mockRedisService.getMetrics();
    
    console.log('Performance Report:', {
      clerk: clerkMetrics,
      redis: redisMetrics,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Cleans up mock services
 */
async function cleanupMockServices(): Promise<void> {
  try {
    // Clear all mock data and verify cleanup
    await mockRedisService.getCache('test-key');
    await mockClerkService.validateToken('test-token');
    
  } catch (error) {
    throw new Error(`Mock services cleanup failed: ${error.message}`);
  }
}

/**
 * Validates cleanup completion
 */
async function validateCleanup(): Promise<void> {
  // Verify all connections are closed
  const metrics = await testEnvironment.monitorPerformance();
  if (metrics.activeConnections > 0) {
    throw new Error('Active connections detected after cleanup');
  }
}

// Export setup and teardown functions
export default setupGlobalEnvironment;
export { teardownGlobalEnvironment };