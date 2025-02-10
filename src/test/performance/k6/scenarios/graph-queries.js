// k6/http v0.45.0 - HTTP client for API requests and metrics
import http from 'k6/http';
// k6 v0.45.0 - Core k6 functions for assertions and timing
import { check, sleep } from 'k6';

// Base configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN;
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${__ENV.API_TOKEN}`
};

// Test configuration and thresholds
export const TEST_OPTIONS = {
  scenarios: {
    simple_queries: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },  // Ramp up
        { duration: '5m', target: 1000 },  // Sustained load
        { duration: '30s', target: 0 }     // Ramp down
      ],
      gracefulRampDown: '30s'
    },
    complex_queries: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },   // Ramp up
        { duration: '5m', target: 100 },   // Sustained load
        { duration: '30s', target: 0 }     // Ramp down
      ],
      gracefulRampDown: '30s'
    }
  },
  thresholds: {
    'simple_query_p95': 'http_req_duration{type:simple} < 200',
    'simple_query_error_rate': 'http_req_failed{type:simple} < 0.01',
    'complex_query_p95': 'http_req_duration{type:complex} < 1000',
    'complex_query_error_rate': 'http_req_failed{type:complex} < 0.01'
  }
};

// Simple graph query test function
export function simpleGraphQuery() {
  const payload = {
    query: {
      type: 'simple',
      pattern: 'MATCH (m:Member)-[:ATTENDED]->(e:Event) WHERE m.location = "San Francisco" RETURN m, e LIMIT 100',
      parameters: {}
    }
  };

  const response = http.post(
    `${BASE_URL}/api/v1/graph/query`,
    JSON.stringify(payload),
    {
      headers: DEFAULT_HEADERS,
      tags: { type: 'simple' }
    }
  );

  check(response, {
    'simple query status is 200': (r) => r.status === 200,
    'simple query response time < 200ms': (r) => r.timings.duration < 200,
    'simple query response has data': (r) => r.json().data !== undefined,
    'simple query response is valid': (r) => {
      const body = r.json();
      return body.data && Array.isArray(body.data) && body.metadata;
    }
  });

  sleep(1);
}

// Complex graph query test function
export function complexGraphQuery() {
  const payload = {
    query: {
      type: 'complex',
      pattern: `
        MATCH (m1:Member)-[:ATTENDED]->(e:Event)<-[:ATTENDED]-(m2:Member)
        WHERE m1.location = "San Francisco"
        AND e.date >= datetime('2023-01-01')
        WITH m1, m2, count(e) as commonEvents
        WHERE commonEvents >= 3
        MATCH (m2)-[:HAS_PROFILE]->(p:SocialProfile)
        RETURN m1, m2, p, commonEvents
        ORDER BY commonEvents DESC
        LIMIT 50
      `,
      parameters: {
        minCommonEvents: 3,
        startDate: '2023-01-01'
      }
    }
  };

  const response = http.post(
    `${BASE_URL}/api/v1/graph/query`,
    JSON.stringify(payload),
    {
      headers: DEFAULT_HEADERS,
      tags: { type: 'complex' }
    }
  );

  check(response, {
    'complex query status is 200': (r) => r.status === 200,
    'complex query response time < 1s': (r) => r.timings.duration < 1000,
    'complex query response has data': (r) => r.json().data !== undefined,
    'complex query response is valid': (r) => {
      const body = r.json();
      return body.data && Array.isArray(body.data) && body.metadata;
    }
  });

  sleep(2);
}

// Test setup function
export function setup() {
  const testContext = {
    startTime: new Date().toISOString(),
    testData: {
      simpleQueries: {
        totalExecutions: 0,
        errors: 0
      },
      complexQueries: {
        totalExecutions: 0,
        errors: 0
      }
    }
  };

  // Verify API accessibility
  const healthCheck = http.get(`${BASE_URL}/health`, { headers: DEFAULT_HEADERS });
  check(healthCheck, {
    'API is accessible': (r) => r.status === 200
  });

  return testContext;
}

// Test teardown function
export function teardown(testData) {
  const endTime = new Date().toISOString();
  console.log('Test execution completed', {
    startTime: testData.startTime,
    endTime: endTime,
    simpleQueryMetrics: testData.testData.simpleQueries,
    complexQueryMetrics: testData.testData.complexQueries
  });
}

// Default export for k6 execution
export default function() {
  const scenario = __ENV.SCENARIO || 'simple_queries';
  
  if (scenario === 'simple_queries') {
    simpleGraphQuery();
  } else if (scenario === 'complex_queries') {
    complexGraphQuery();
  }
}