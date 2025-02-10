import http from 'k6/http';
import { check, sleep } from 'k6';

// Base configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TDA_ENDPOINT = `${BASE_URL}/api/v1/analytics/tda`;
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${__ENV.API_TOKEN}`
};

// Test configuration
export const options = {
  scenarios: {
    tda_computation: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 5 },  // Ramp up to 5 VUs
        { duration: '3m', target: 10 }, // Hold at 10 VUs (target RPS)
        { duration: '1m', target: 0 }   // Ramp down
      ],
      gracefulRampDown: '30s'
    }
  },
  thresholds: {
    'http_req_duration{type:tda}': ['p(95) < 5000'], // 5s max response time
    'http_req_failed{type:tda}': ['rate < 0.01']     // 1% max error rate
  }
};

/**
 * Generates test network data for TDA computation
 * @returns {Object} Test payload with network data and TDA parameters
 */
function generateTestData() {
  return {
    network: {
      nodes: [
        { id: 1, attributes: { x: 0.1, y: 0.2 } },
        { id: 2, attributes: { x: 0.3, y: 0.4 } },
        { id: 3, attributes: { x: 0.5, y: 0.6 } },
        { id: 4, attributes: { x: 0.7, y: 0.8 } },
        { id: 5, attributes: { x: 0.9, y: 1.0 } }
      ],
      edges: [
        { source: 1, target: 2, weight: 0.5 },
        { source: 2, target: 3, weight: 0.6 },
        { source: 3, target: 4, weight: 0.7 },
        { source: 4, target: 5, weight: 0.8 },
        { source: 5, target: 1, weight: 0.9 }
      ]
    },
    parameters: {
      epsilon: 0.5,
      minPoints: 15,
      dimension: 2,
      metric: 'euclidean'
    }
  };
}

/**
 * Validates TDA computation response
 * @param {Object} response - HTTP response from TDA endpoint
 * @returns {boolean} Validation result
 */
function validateTDAResponse(response) {
  const validationChecks = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has persistence diagram': (r) => r.json('persistenceDiagram') !== undefined,
    'response has topological features': (r) => r.json('features') !== undefined,
    'response time within limits': (r) => r.timings.duration < 5000
  });

  if (response.status === 200) {
    const body = response.json();
    return check(body, {
      'persistence diagram has valid structure': (b) => 
        Array.isArray(b.persistenceDiagram) && 
        b.persistenceDiagram.length > 0,
      'features contain valid metrics': (b) => 
        Array.isArray(b.features) && 
        b.features.every(f => 
          typeof f.dimension === 'number' && 
          typeof f.persistence === 'number'
        )
    });
  }
  return validationChecks;
}

/**
 * Main test function for TDA computation performance testing
 */
export default function() {
  const payload = generateTestData();
  
  const response = http.post(TDA_ENDPOINT, JSON.stringify(payload), {
    headers: DEFAULT_HEADERS,
    tags: { type: 'tda' }
  });

  validateTDAResponse(response);

  // Add sleep interval to control request rate
  sleep(1);
}