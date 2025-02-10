import { DistanceMetric } from '../../../../web/src/types/analytics';
import { EventPlatform } from '../../../../web/src/types/events';

// Third-party package versions
// cypress ^12.0.0
// @testing-library/cypress ^9.0.0
// @clerk/cypress ^4.0.0

// Test constants
const TEST_CSV_FILE = 'cypress/fixtures/test-events.csv';
const VALID_API_KEYS = {
  [EventPlatform.LUMA]: 'luma_test_key_123',
  [EventPlatform.EVENTBRITE]: 'eventbrite_test_key_456',
  [EventPlatform.PARTIFUL]: 'partiful_test_key_789'
};

const MOCK_RESPONSES = {
  connection: { status: 'success', message: 'Connected successfully' },
  progress: { status: 'processing', percentage: 75 },
  error: { status: 'error', message: 'API rate limit exceeded' }
};

describe('Admin Import Tools', () => {
  beforeEach(() => {
    // Login as admin and visit import tools page
    cy.login({ email: 'admin@example.com', role: 'ADMIN' });
    cy.visit('/admin/import-tools');
    cy.getByTestId('import-tools-panel').should('be.visible');

    // Clear previous test data
    cy.window().then((win) => {
      win.localStorage.clear();
      win.sessionStorage.clear();
    });

    // Set up API interceptors
    cy.intercept('POST', '**/api/events/import/**', (req) => {
      const platform = req.url.split('/').pop();
      if (req.headers['x-api-key'] === VALID_API_KEYS[platform as EventPlatform]) {
        req.reply(MOCK_RESPONSES.connection);
      } else {
        req.reply(401, { error: 'Invalid API key' });
      }
    }).as('platformConnection');

    // Mock analytics tracking
    cy.mockAnalytics('import-progress', {
      responseData: MOCK_RESPONSES.progress,
      delay: 1000
    });
  });

  describe('Platform Connection Tests', () => {
    Object.values(EventPlatform).forEach((platform) => {
      it(`should connect to ${platform} platform successfully`, () => {
        // Test platform connection flow
        cy.getByTestId(`${platform.toLowerCase()}-connect-btn`).click();
        cy.getByTestId('api-key-input').type(VALID_API_KEYS[platform]);
        cy.getByTestId('connect-submit-btn').click();

        // Verify connection success
        cy.wait('@platformConnection')
          .its('response.body')
          .should('deep.equal', MOCK_RESPONSES.connection);

        cy.getByTestId(`${platform.toLowerCase()}-status`)
          .should('have.text', 'Connected')
          .and('have.class', 'text-green-500');
      });

      it(`should handle ${platform} connection errors`, () => {
        // Test invalid API key scenario
        cy.getByTestId(`${platform.toLowerCase()}-connect-btn`).click();
        cy.getByTestId('api-key-input').type('invalid_key');
        cy.getByTestId('connect-submit-btn').click();

        // Verify error handling
        cy.getByTestId('connection-error')
          .should('be.visible')
          .and('contain', 'Invalid API key');
      });
    });
  });

  describe('CSV Import Tests', () => {
    it('should handle valid CSV file upload', () => {
      // Test file upload
      cy.fixture(TEST_CSV_FILE).then((fileContent) => {
        cy.getByTestId('csv-upload-input')
          .attachFile({
            fileContent,
            fileName: 'events.csv',
            mimeType: 'text/csv'
          });
      });

      // Verify upload success
      cy.getByTestId('file-name-display')
        .should('contain', 'events.csv');
      cy.getByTestId('start-import-btn')
        .should('be.enabled')
        .click();

      // Verify import progress
      cy.getByTestId('import-progress-bar')
        .should('exist')
        .and('have.attr', 'aria-valuenow', '75');
      cy.getByTestId('progress-status')
        .should('contain', 'Processing');
    });

    it('should validate CSV file format', () => {
      // Test invalid file format
      cy.fixture('invalid.txt').then((fileContent) => {
        cy.getByTestId('csv-upload-input')
          .attachFile({
            fileContent,
            fileName: 'invalid.txt',
            mimeType: 'text/plain'
          });
      });

      // Verify validation error
      cy.getByTestId('file-error')
        .should('be.visible')
        .and('contain', 'Invalid file format. Please upload a CSV file.');
    });
  });

  describe('Import Progress Tracking', () => {
    it('should track import progress accurately', () => {
      // Start import process
      cy.fixture(TEST_CSV_FILE).then((fileContent) => {
        cy.getByTestId('csv-upload-input').attachFile({
          fileContent,
          fileName: 'events.csv',
          mimeType: 'text/csv'
        });
      });
      cy.getByTestId('start-import-btn').click();

      // Verify progress updates
      cy.getByTestId('import-progress-bar')
        .should('have.attr', 'aria-valuenow', '75');
      cy.getByTestId('progress-percentage')
        .should('contain', '75%');
      cy.getByTestId('cancel-import-btn')
        .should('be.enabled');
    });

    it('should handle import cancellation', () => {
      // Start and cancel import
      cy.fixture(TEST_CSV_FILE).then((fileContent) => {
        cy.getByTestId('csv-upload-input').attachFile({
          fileContent,
          fileName: 'events.csv',
          mimeType: 'text/csv'
        });
      });
      cy.getByTestId('start-import-btn').click();
      cy.getByTestId('cancel-import-btn').click();

      // Verify cancellation
      cy.getByTestId('import-status')
        .should('contain', 'Import cancelled');
      cy.getByTestId('start-import-btn')
        .should('be.enabled');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', () => {
      // Mock network failure
      cy.intercept('POST', '**/api/events/import/**', {
        forceNetworkError: true
      }).as('networkError');

      // Attempt import
      cy.getByTestId(`${EventPlatform.LUMA.toLowerCase()}-connect-btn`).click();
      cy.getByTestId('api-key-input').type(VALID_API_KEYS[EventPlatform.LUMA]);
      cy.getByTestId('connect-submit-btn').click();

      // Verify error handling
      cy.getByTestId('network-error')
        .should('be.visible')
        .and('contain', 'Network error occurred');
    });

    it('should handle rate limiting', () => {
      // Mock rate limit response
      cy.intercept('POST', '**/api/events/import/**', {
        statusCode: 429,
        body: MOCK_RESPONSES.error
      }).as('rateLimitError');

      // Attempt import
      cy.getByTestId(`${EventPlatform.LUMA.toLowerCase()}-connect-btn`).click();
      cy.getByTestId('api-key-input').type(VALID_API_KEYS[EventPlatform.LUMA]);
      cy.getByTestId('connect-submit-btn').click();

      // Verify rate limit handling
      cy.getByTestId('rate-limit-error')
        .should('be.visible')
        .and('contain', 'API rate limit exceeded');
    });
  });
});