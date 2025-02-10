import http from 'k6/http';
import { check } from 'k6';
import { sleep } from 'k6';

// Base configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Authorization': 'Bearer ${__ENV.API_TOKEN}'
};
const IMPORT_ENDPOINT = `${BASE_URL}/api/v1/events/import`;

// Sample import configurations
const SAMPLE_LUMA_IMPORT = {
  platform: 'luma',
  startDate: '2023-01-01',
  endDate: '2023-12-31',
  options: {
    batchSize: 100,
    retryAttempts: 3
  }
};

const SAMPLE_EVENTBRITE_IMPORT = {
  platform: 'eventbrite',
  startDate: '2023-01-01',
  endDate: '2023-12-31',
  options: {
    batchSize: 100,
    retryAttempts: 3
  }
};

const SAMPLE_PARTIFUL_IMPORT = {
  platform: 'partiful',
  startDate: '2023-01-01',
  endDate: '2023-12-31',
  options: {
    batchSize: 100,
    retryAttempts: 3
  }
};

// Test configuration
export const options = {
  scenarios: {
    event_import: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },  // Ramp up to target RPS
        { duration: '1m', target: 5 },   // Maintain target RPS
        { duration: '30s', target: 0 }   // Ramp down
      ]
    }
  },
  thresholds: {
    'http_req_duration{type:import}': ['p(95) < 30000'],  // 30s SLA
    'http_req_failed{type:import}': ['rate < 0.01'],      // 1% error rate
    'successful_imports': ['rate > 0.99'],                 // 99% success rate
    'iteration_duration': ['p(95) < 35000']               // Total operation time
  }
};

// Test setup function
export function setup() {
  const testContext = {
    platforms: {
      luma: {
        config: SAMPLE_LUMA_IMPORT,
        successCount: 0,
        failureCount: 0
      },
      eventbrite: {
        config: SAMPLE_EVENTBRITE_IMPORT,
        successCount: 0,
        failureCount: 0
      },
      partiful: {
        config: SAMPLE_PARTIFUL_IMPORT,
        successCount: 0,
        failureCount: 0
      }
    },
    totalRequests: 0,
    startTime: new Date().getTime()
  };

  // Validate API accessibility
  const healthCheck = http.get(`${BASE_URL}/health`);
  check(healthCheck, {
    'API is accessible': (r) => r.status === 200
  });

  return testContext;
}

// Handle individual import request
function handleImport(importConfig) {
  const payload = JSON.stringify(importConfig);
  const params = {
    headers: DEFAULT_HEADERS,
    tags: { type: 'import' }
  };

  const response = http.post(IMPORT_ENDPOINT, payload, params);

  // Comprehensive response validation
  const checks = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has importId': (r) => r.json('importId') !== undefined,
    'response includes status': (r) => r.json('status') !== undefined,
    'response time within SLA': (r) => r.timings.duration < 30000
  });

  // Platform-specific validation
  const platformChecks = check(response, {
    [`${importConfig.platform} specific validation passed`]: (r) => {
      switch (importConfig.platform) {
        case 'luma':
          return r.json('platform') === 'luma' && r.json('batchSize') <= 100;
        case 'eventbrite':
          return r.json('platform') === 'eventbrite' && r.json('batchSize') <= 100;
        case 'partiful':
          return r.json('platform') === 'partiful' && r.json('batchSize') <= 100;
        default:
          return false;
      }
    }
  });

  return {
    success: checks && platformChecks,
    response: response
  };
}

// Main test scenario
export default function() {
  // Select random platform for this iteration
  const platforms = ['luma', 'eventbrite', 'partiful'];
  const selectedPlatform = platforms[Math.floor(Math.random() * platforms.length)];
  
  let importConfig;
  switch (selectedPlatform) {
    case 'luma':
      importConfig = SAMPLE_LUMA_IMPORT;
      break;
    case 'eventbrite':
      importConfig = SAMPLE_EVENTBRITE_IMPORT;
      break;
    case 'partiful':
      importConfig = SAMPLE_PARTIFUL_IMPORT;
      break;
  }

  // Execute import with comprehensive error handling
  try {
    const result = handleImport(importConfig);
    
    if (result.success) {
      // Track successful import
      let successRate = new Rate('successful_imports');
      successRate.add(1);
    } else {
      // Track failed import
      let failureRate = new Rate('failed_imports');
      failureRate.add(1);
    }

    // Detailed metric tracking
    let importDuration = new Trend('import_duration');
    importDuration.add(result.response.timings.duration);

    // Platform-specific metrics
    let platformDuration = new Trend(`${selectedPlatform}_import_duration`);
    platformDuration.add(result.response.timings.duration);

  } catch (error) {
    console.error(`Import failed for ${selectedPlatform}:`, error);
    let errorRate = new Rate('error_rate');
    errorRate.add(1);
  }

  // Rate limiting sleep to maintain target RPS
  sleep(1);
}