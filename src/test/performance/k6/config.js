// k6/http v0.45.0 - HTTP client for API requests and metrics
import http from 'k6/http';
// k6 v0.45.0 - Core k6 functions for assertions and timing
import { check, sleep } from 'k6';

// Import test scenarios
import graphQueries from './scenarios/graph-queries';
import entityResolution from './scenarios/entity-resolution';
import tdaComputation from './scenarios/tda-computation';
import eventImport from './scenarios/event-import';

// Global environment configuration
export const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
export const API_TOKEN = process.env.API_TOKEN;
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${__ENV.API_TOKEN}`
};

// Global test configuration and options
export const options = {
  scenarios: {
    // Graph query performance scenarios
    graph_queries_simple: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },  // Ramp up
        { duration: '5m', target: 1000 },  // Sustained load at 1000 qps
        { duration: '30s', target: 0 }     // Ramp down
      ],
      gracefulRampDown: '30s'
    },
    graph_queries_complex: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },   // Ramp up
        { duration: '5m', target: 100 },   // Sustained load at 100 qps
        { duration: '30s', target: 0 }     // Ramp down
      ],
      gracefulRampDown: '30s'
    },
    // Entity resolution performance scenario
    entity_resolution: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 50 }     // Ramp up to 50 rps
      ]
    },
    // TDA computation performance scenario
    tda_computation: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 5 },     // Ramp up to 5 rps
        { duration: '3m', target: 10 },    // Sustained load at 10 rps
        { duration: '1m', target: 0 }      // Ramp down
      ],
      gracefulRampDown: '30s'
    },
    // Event import performance scenario
    event_import: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },    // Ramp up to 5 rps
        { duration: '1m', target: 5 },     // Sustained load
        { duration: '30s', target: 0 }     // Ramp down
      ]
    }
  },
  // Global performance thresholds
  thresholds: {
    // Graph query thresholds
    'http_req_duration{type:simple}': ['p(95) < 200'],    // Simple queries < 200ms
    'http_req_failed{type:simple}': ['rate < 0.01'],      // Error rate < 1%
    'http_req_duration{type:complex}': ['p(95) < 1000'],  // Complex queries < 1s
    'http_req_failed{type:complex}': ['rate < 0.01'],     // Error rate < 1%
    
    // Entity resolution thresholds
    'http_req_duration{type:resolution}': ['p(95) < 500'], // Resolution < 500ms
    'resolution_accuracy': ['value >= 0.95'],              // 95% accuracy
    
    // TDA computation thresholds
    'http_req_duration{type:tda}': ['p(95) < 5000'],      // TDA compute < 5s
    'http_req_failed{type:tda}': ['rate < 0.01'],         // Error rate < 1%
    
    // Event import thresholds
    'http_req_duration{type:import}': ['p(95) < 30000'],  // Import < 30s
    'successful_imports': ['rate > 0.99']                  // 99% success rate
  }
};

// Global test context setup
export function setupGlobalContext() {
  const testContext = {
    startTime: new Date().toISOString(),
    baseUrl: BASE_URL,
    headers: DEFAULT_HEADERS,
    metrics: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0
    },
    endpoints: {
      graphQuery: `${BASE_URL}/api/v1/graph/query`,
      entityResolution: `${BASE_URL}/api/v1/members/resolve`,
      tdaComputation: `${BASE_URL}/api/v1/analytics/tda`,
      eventImport: `${BASE_URL}/api/v1/events/import`
    }
  };

  // Verify API accessibility
  const healthCheck = http.get(`${BASE_URL}/health`, { headers: DEFAULT_HEADERS });
  check(healthCheck, {
    'API is accessible': (r) => r.status === 200
  });

  return testContext;
}

// Default export for k6 execution
export default function() {
  const scenario = __ENV.SCENARIO || 'graph_queries_simple';
  
  switch(scenario) {
    case 'graph_queries_simple':
    case 'graph_queries_complex':
      graphQueries.default();
      break;
    case 'entity_resolution':
      entityResolution.default();
      break;
    case 'tda_computation':
      tdaComputation.default();
      break;
    case 'event_import':
      eventImport.default();
      break;
    default:
      console.error(`Unknown scenario: ${scenario}`);
  }
}