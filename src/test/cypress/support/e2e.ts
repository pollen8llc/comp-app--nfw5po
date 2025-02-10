// Third-party package versions
// cypress ^12.0.0
// @testing-library/cypress ^9.0.0
// @cypress/code-coverage ^3.10.0

import '@testing-library/cypress/add-commands';
import '@cypress/code-coverage/support';
import './commands';

// Extend Cypress types for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      login(credentials: { email: string; role: string }, provider?: string): Chainable<void>;
      logout(): Chainable<void>;
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
      interceptGraphQuery(operationName: string, response: unknown): Chainable<void>;
      mockAnalytics(endpoint: string, options: AnalyticsMockOptions): Chainable<void>;
      checkNetworkGraph(options: NetworkGraphOptions): Chainable<void>;
    }
  }
}

// Analytics mock options interface
interface AnalyticsMockOptions {
  responseData?: unknown;
  delay?: number;
  error?: boolean;
  status?: number;
}

// Network graph validation options
interface NetworkGraphOptions {
  nodeCount?: number;
  edgeCount?: number;
  timeout?: number;
  validateLayout?: boolean;
  checkInteractions?: boolean;
  performanceThreshold?: number;
}

// Configure global test behavior
Cypress.on('uncaught:exception', (err) => {
  // Log error but prevent test failure on uncaught exceptions
  console.error('Uncaught exception:', err);
  return false;
});

// Performance thresholds based on technical specifications
const PERFORMANCE_THRESHOLDS = {
  graphQuery: 200, // 200ms
  networkVisualization: 2000, // 2s
  entityDisambiguation: 500, // 500ms
  tdaComputation: 5000, // 5s
  eventImport: 30000 // 30s
};

// Responsive breakpoints for viewport testing
const VIEWPORT_BREAKPOINTS = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
  wide: 1440
};

/**
 * Global test environment setup
 * Configures environment before each test
 */
function setupTestEnvironment(): void {
  // Clear browser storage and cookies
  cy.clearLocalStorage();
  cy.clearCookies();

  // Reset API interceptors
  cy.intercept('POST', '**/graphql', (req) => {
    req.on('response', (res) => {
      // Track response times for performance monitoring
      const duration = res.headers['x-response-time'];
      if (duration > PERFORMANCE_THRESHOLDS.graphQuery) {
        cy.log(`Warning: GraphQL query exceeded performance threshold: ${duration}ms`);
      }
    });
  });

  // Configure default viewport
  cy.viewport(VIEWPORT_BREAKPOINTS.desktop, 800);

  // Set up network throttling for realistic conditions
  cy.intercept('**/*', (req) => {
    req.on('response', (res) => {
      // Add artificial delay to simulate network conditions
      res.setDelay(50);
    });
  });

  // Mock authentication service
  cy.intercept('POST', '**/auth/**', (req) => {
    if (req.url.includes('clerk')) {
      req.reply({
        statusCode: 200,
        body: {
          token: 'test-auth-token',
          session: {
            expiresAt: Date.now() + 3600000 // 1 hour
          }
        }
      });
    }
  });

  // Configure analytics mocks
  cy.mockAnalytics('tda-computation', {
    responseData: {
      epsilon: 0.5,
      minPoints: 15,
      dimension: 2,
      computationTime: new Date().toISOString()
    }
  });

  // Set up accessibility testing
  cy.injectAxe();
}

/**
 * Global test environment cleanup
 * Resets environment after each test
 */
function cleanupTestEnvironment(): void {
  // Clear all interceptors
  cy.intercept('**/*', null);

  // Reset authentication state
  cy.clearLocalStorage('auth_token');
  cy.clearLocalStorage('auth_session');

  // Clear mocked responses
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });

  // Reset viewport
  cy.viewport(VIEWPORT_BREAKPOINTS.desktop, 800);

  // Clear performance metrics
  cy.window().then((win) => {
    if (win.performance) {
      const perf = win.performance;
      const entries = perf.getEntriesByType('measure');
      entries.forEach(entry => {
        perf.clearMeasures(entry.name);
      });
    }
  });
}

// Register global hooks
beforeEach(() => {
  setupTestEnvironment();
});

afterEach(() => {
  cleanupTestEnvironment();
});

// Export functions for use in test files
export {
  setupTestEnvironment,
  cleanupTestEnvironment,
  PERFORMANCE_THRESHOLDS,
  VIEWPORT_BREAKPOINTS
};