import { generateTestToken, createTestSession } from '../utils/auth-helpers';
import { TestAPIClient } from '../utils/api-client';
import '@testing-library/cypress/add-commands';
import '@clerk/cypress';

// Version comments for third-party packages
// cypress ^12.0.0
// @testing-library/cypress ^9.0.0
// @clerk/cypress ^4.0.0

declare global {
  namespace Cypress {
    interface Chainable {
      login(credentials: { email: string; role: string }, provider?: string): Chainable<void>;
      checkNetworkGraph(options: NetworkGraphOptions): Chainable<void>;
      mockAnalytics(endpoint: string, options: AnalyticsMockOptions): Chainable<void>;
    }
  }
}

interface NetworkGraphOptions {
  nodeCount?: number;
  edgeCount?: number;
  timeout?: number;
  validateLayout?: boolean;
  checkInteractions?: boolean;
  performanceThreshold?: number;
}

interface AnalyticsMockOptions {
  responseData?: unknown;
  delay?: number;
  error?: boolean;
  status?: number;
}

// Initialize test API client
const apiClient = new TestAPIClient('http://localhost:3000');

/**
 * Custom command to handle authentication flows
 * Supports both standard and social authentication methods
 */
Cypress.Commands.add('login', (credentials, provider = 'standard') => {
  cy.log(`Attempting login with provider: ${provider}`);

  // Generate test JWT token
  const token = generateTestToken({
    id: 'test-user-id',
    email: credentials.email,
    role: credentials.role
  });

  // Create test session
  const session = createTestSession({
    id: 'test-user-id',
    email: credentials.email,
    role: credentials.role,
    firstName: 'Test',
    lastName: 'User',
    profileImageUrl: 'https://example.com/avatar.jpg'
  });

  // Set up authentication state
  cy.window().then((window) => {
    window.localStorage.setItem('auth_token', token);
    window.localStorage.setItem('auth_session', JSON.stringify(session));
  });

  // Handle provider-specific flows
  if (provider === 'linkedin') {
    cy.intercept('GET', '**/linkedin/oauth/callback*', {
      statusCode: 200,
      body: { success: true }
    });
  } else if (provider === 'gmail') {
    cy.intercept('GET', '**/gmail/oauth/callback*', {
      statusCode: 200,
      body: { success: true }
    });
  }

  // Visit protected route and verify auth state
  cy.visit('/dashboard');
  cy.get('[data-testid="user-profile"]', { timeout: 10000 })
    .should('exist')
    .and('contain', credentials.email);
});

/**
 * Custom command to validate network graph visualization
 * Includes comprehensive checks for graph structure and interactions
 */
Cypress.Commands.add('checkNetworkGraph', (options = {}) => {
  const {
    nodeCount = 10,
    edgeCount = 20,
    timeout = 10000,
    validateLayout = true,
    checkInteractions = true,
    performanceThreshold = 1000
  } = options;

  // Wait for graph container
  cy.get('[data-testid="network-graph"]', { timeout })
    .should('exist')
    .and('be.visible');

  // Verify graph elements
  cy.get('[data-testid="graph-node"]')
    .should('have.length.at.least', nodeCount);
  
  cy.get('[data-testid="graph-edge"]')
    .should('have.length.at.least', edgeCount);

  if (validateLayout) {
    // Verify graph layout algorithm results
    cy.get('[data-testid="graph-container"]')
      .should('have.attr', 'data-layout-complete', 'true');
  }

  if (checkInteractions) {
    // Test zoom interactions
    cy.get('[data-testid="zoom-controls"]')
      .should('exist')
      .within(() => {
        cy.get('[data-testid="zoom-in"]').click();
        cy.get('[data-testid="zoom-out"]').click();
      });

    // Test node selection
    cy.get('[data-testid="graph-node"]')
      .first()
      .click()
      .should('have.class', 'selected');

    // Test pan interaction
    cy.get('[data-testid="network-graph"]')
      .trigger('mousedown', { button: 0 })
      .trigger('mousemove', { clientX: 100, clientY: 100 })
      .trigger('mouseup');
  }

  // Performance validation
  cy.window().its('performance').then((p) => {
    const navigationEntry = p.getEntriesByType('navigation')[0];
    expect(navigationEntry.duration).to.be.lessThan(performanceThreshold);
  });
});

/**
 * Custom command to mock analytics service responses
 * Supports various response scenarios and error cases
 */
Cypress.Commands.add('mockAnalytics', (endpoint, options = {}) => {
  const {
    responseData = {},
    delay = 0,
    error = false,
    status = 200
  } = options;

  // Set up analytics service mock
  if (error) {
    cy.intercept('POST', `**/api/analytics/${endpoint}`, {
      statusCode: 500,
      delay,
      body: {
        error: 'Analytics computation failed',
        code: 'COMPUTATION_ERROR'
      }
    });
  } else {
    cy.intercept('POST', `**/api/analytics/${endpoint}`, {
      statusCode: status,
      delay,
      body: {
        data: responseData,
        computationTime: new Date().toISOString(),
        status: 'success'
      }
    });
  }

  // Mock WebSocket events for real-time updates
  cy.window().then((window) => {
    window.postMessage({
      type: 'ANALYTICS_UPDATE',
      data: {
        endpoint,
        status: error ? 'error' : 'complete',
        timestamp: new Date().toISOString()
      }
    }, '*');
  });
});

// Additional utility functions for test setup
function setupTestEnvironment() {
  // Clear previous test data
  cy.window().then((window) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  // Reset API client state
  apiClient.clearMocks();

  // Set up common interceptors
  cy.intercept('GET', '**/api/health', { statusCode: 200 });
  cy.intercept('GET', '**/api/version', { 
    statusCode: 200,
    body: { version: '1.0.0' }
  });
}

// Initialize test environment before each test
beforeEach(() => {
  setupTestEnvironment();
});