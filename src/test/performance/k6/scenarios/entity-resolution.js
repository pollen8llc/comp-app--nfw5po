import http from 'k6/http'; // v0.45.0
import { check, sleep } from 'k6'; // v0.45.0

// Environment configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN;
const RESOLUTION_ENDPOINT = '/api/v1/members/resolve';
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${__ENV.API_TOKEN}`
};

// Test configuration
export const options = {
  scenarios: {
    entity_resolution: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 50 } // Ramp up to target 50 RPS
      ]
    }
  },
  thresholds: {
    'http_req_duration{type:resolution}': ['p(95) < 500'], // 500ms SLA
    'resolution_accuracy': ['value >= 0.95'] // 95% accuracy requirement
  }
};

// Test data generation and setup
export function setup() {
  const testData = {
    exactMatches: [
      {
        member1: { id: 'em1a', name: 'John Smith', email: 'john.smith@example.com' },
        member2: { id: 'em1b', name: 'John Smith', email: 'john.smith@example.com' },
        expectedMatch: true,
        confidence: 1.0
      }
    ],
    nearMatches: [
      {
        member1: { id: 'nm1a', name: 'John Smith', email: 'john.smith@example.com' },
        member2: { id: 'nm1b', name: 'John A. Smith', email: 'johnsmith@example.com' },
        expectedMatch: true,
        confidence: 0.9
      }
    ],
    partialMatches: [
      {
        member1: { id: 'pm1a', name: 'John Smith', email: 'john.smith@company.com' },
        member2: { id: 'pm1b', name: 'J. Smith', email: 'smith.j@othercompany.com' },
        expectedMatch: true,
        confidence: 0.7
      }
    ],
    nonMatches: [
      {
        member1: { id: 'nm1a', name: 'John Smith', email: 'john.smith@example.com' },
        member2: { id: 'nm1b', name: 'Jane Doe', email: 'jane.doe@example.com' },
        expectedMatch: false,
        confidence: 0.1
      }
    ],
    edgeCases: [
      {
        member1: { id: 'ec1a', name: 'José García', email: 'jose.garcia@example.com' },
        member2: { id: 'ec1b', name: 'Jose Garcia', email: 'jgarcia@example.com' },
        expectedMatch: true,
        confidence: 0.85
      },
      {
        member1: { id: 'ec2a', name: 'O\'Connor', email: 'oconnor@example.com' },
        member2: { id: 'ec2b', name: 'O'Connor', email: 'o.connor@example.com' },
        expectedMatch: true,
        confidence: 0.8
      }
    ],
    incompleteData: [
      {
        member1: { id: 'id1a', name: 'John Smith', email: null },
        member2: { id: 'id1b', name: 'John Smith', email: 'john.smith@example.com' },
        expectedMatch: true,
        confidence: 0.6
      }
    ]
  };

  return {
    testData,
    metrics: {
      totalTests: 0,
      accurateResolutions: 0
    }
  };
}

// Main test function
export default function(testContext) {
  const { testData, metrics } = testContext;
  
  // Select random test case from stratified data
  const testCategories = Object.keys(testData);
  const selectedCategory = testCategories[Math.floor(Math.random() * testCategories.length)];
  const testCases = testData[selectedCategory];
  const testCase = testCases[Math.floor(Math.random() * testCases.length)];

  // Handle resolution request and track metrics
  const result = handleResolutionRequest(testCase);
  
  // Update accuracy metrics
  metrics.totalTests++;
  if (result.accurate) {
    metrics.accurateResolutions++;
  }

  // Calculate and track accuracy rate
  const accuracyRate = metrics.accurateResolutions / metrics.totalTests;
  
  // Report metrics
  check(result, {
    'response time within SLA': (r) => r.timing < 500,
    'resolution accuracy meets threshold': () => accuracyRate >= 0.95
  });

  // Dynamic sleep to maintain target RPS
  sleep(1 / options.scenarios.entity_resolution.stages[0].target);
}

// Resolution request handler
export function handleResolutionRequest(memberPair) {
  const payload = {
    members: [memberPair.member1, memberPair.member2],
    options: {
      confidenceThreshold: 0.5,
      includeMetadata: true
    },
    requestId: `test-${Date.now()}-${Math.random()}`
  };

  const response = http.post(
    `${BASE_URL}${RESOLUTION_ENDPOINT}`,
    JSON.stringify(payload),
    {
      headers: DEFAULT_HEADERS,
      tags: { type: 'resolution' }
    }
  );

  // Validate response
  const validResponse = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has valid format': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hasOwnProperty('isMatch') && 
               body.hasOwnProperty('confidence') &&
               body.hasOwnProperty('metadata');
      } catch (e) {
        return false;
      }
    }
  });

  if (!validResponse) {
    console.error(`Invalid response: ${response.status} - ${response.body}`);
    return {
      timing: response.timings.duration,
      accurate: false,
      error: true
    };
  }

  const result = JSON.parse(response.body);
  
  // Compare result with expected outcome
  const accurate = (
    result.isMatch === memberPair.expectedMatch &&
    Math.abs(result.confidence - memberPair.confidence) <= 0.1
  );

  return {
    timing: response.timings.duration,
    accurate,
    error: false,
    result
  };
}