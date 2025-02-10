import { login, logout } from '../../support/commands';
import { MockClerkService } from '../../../setup/mock-services';
import { SocialProvider, UserRole } from '../../../../web/src/types/auth';
import { ERROR_CODES } from '../../../../backend/shared/utils/error-codes';

// Version comments for third-party packages
// cypress ^12.0.0
// @clerk/types ^3.0.0

describe('Social Login Integration Tests', () => {
  let mockClerkService: MockClerkService;

  beforeEach(() => {
    // Initialize mock services
    mockClerkService = new MockClerkService(true);

    // Clear cookies and local storage
    cy.clearCookies();
    cy.clearLocalStorage();

    // Visit home page
    cy.visit('/');

    // Intercept Clerk API calls
    cy.intercept('POST', '**/clerk/oauth/**', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          token: 'mock-token',
          sessionId: 'mock-session-id'
        }
      });
    }).as('oauthRequest');

    // Intercept profile data requests
    cy.intercept('GET', '**/api/user/profile', {
      statusCode: 200,
      body: {
        id: 'test-user-id',
        email: 'test@example.com',
        role: UserRole.MEMBER
      }
    }).as('profileRequest');
  });

  describe('LinkedIn Login', () => {
    it('should successfully authenticate with LinkedIn', () => {
      // Click LinkedIn login button
      cy.get('[data-testid="linkedin-login-btn"]').click();

      // Mock LinkedIn OAuth popup
      cy.window().then((win) => {
        const mockOAuthResponse = {
          code: 'mock-linkedin-code',
          state: 'mock-state'
        };
        win.postMessage({ type: 'LINKEDIN_OAUTH_CALLBACK', data: mockOAuthResponse }, '*');
      });

      // Verify OAuth request
      cy.wait('@oauthRequest').its('request.body').should('include', {
        provider: SocialProvider.LINKEDIN
      });

      // Verify successful login
      cy.url().should('include', '/dashboard');
      cy.get('[data-testid="user-profile"]').should('exist');
      cy.get('[data-testid="user-email"]').should('contain', 'test@example.com');
    });

    it('should handle LinkedIn authentication errors', () => {
      // Mock failed OAuth response
      cy.intercept('POST', '**/clerk/oauth/**', {
        statusCode: 401,
        body: {
          error: ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'LinkedIn authentication failed'
        }
      }).as('failedOauth');

      // Attempt login
      cy.get('[data-testid="linkedin-login-btn"]').click();

      // Mock error in OAuth popup
      cy.window().then((win) => {
        win.postMessage({ type: 'LINKEDIN_OAUTH_ERROR', error: 'access_denied' }, '*');
      });

      // Verify error handling
      cy.get('[data-testid="auth-error"]')
        .should('exist')
        .and('contain', 'LinkedIn authentication failed');
      
      cy.url().should('not.include', '/dashboard');
    });

    it('should handle LinkedIn rate limiting', () => {
      // Mock rate limit response
      cy.intercept('POST', '**/clerk/oauth/**', {
        statusCode: 429,
        body: {
          error: ERROR_CODES.RATE_LIMIT_ERROR,
          message: 'Too many requests'
        }
      }).as('rateLimitedRequest');

      // Attempt multiple logins
      for (let i = 0; i < 3; i++) {
        cy.get('[data-testid="linkedin-login-btn"]').click();
        cy.wait(100);
      }

      // Verify rate limit error
      cy.get('[data-testid="auth-error"]')
        .should('exist')
        .and('contain', 'Too many requests');
    });
  });

  describe('Gmail Login', () => {
    it('should successfully authenticate with Gmail', () => {
      // Click Gmail login button
      cy.get('[data-testid="gmail-login-btn"]').click();

      // Mock Gmail OAuth popup
      cy.window().then((win) => {
        const mockOAuthResponse = {
          code: 'mock-gmail-code',
          state: 'mock-state'
        };
        win.postMessage({ type: 'GMAIL_OAUTH_CALLBACK', data: mockOAuthResponse }, '*');
      });

      // Verify OAuth request
      cy.wait('@oauthRequest').its('request.body').should('include', {
        provider: SocialProvider.GMAIL
      });

      // Verify successful login
      cy.url().should('include', '/dashboard');
      cy.get('[data-testid="user-profile"]').should('exist');
    });

    it('should handle Gmail authentication errors', () => {
      // Mock failed OAuth response
      cy.intercept('POST', '**/clerk/oauth/**', {
        statusCode: 401,
        body: {
          error: ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Gmail authentication failed'
        }
      }).as('failedOauth');

      // Attempt login
      cy.get('[data-testid="gmail-login-btn"]').click();

      // Mock error in OAuth popup
      cy.window().then((win) => {
        win.postMessage({ type: 'GMAIL_OAUTH_ERROR', error: 'access_denied' }, '*');
      });

      // Verify error handling
      cy.get('[data-testid="auth-error"]')
        .should('exist')
        .and('contain', 'Gmail authentication failed');
    });

    it('should verify email after Gmail login', () => {
      // Mock successful OAuth but unverified email
      cy.intercept('GET', '**/api/user/profile', {
        statusCode: 200,
        body: {
          id: 'test-user-id',
          email: 'test@example.com',
          emailVerified: false
        }
      }).as('unverifiedProfile');

      // Attempt login
      cy.get('[data-testid="gmail-login-btn"]').click();

      // Verify email verification prompt
      cy.get('[data-testid="email-verification"]').should('exist');
      cy.get('[data-testid="verify-email-btn"]').should('exist');
    });
  });

  describe('Session Management', () => {
    it('should maintain session across page reloads', () => {
      // Login with social provider
      cy.get('[data-testid="linkedin-login-btn"]').click();
      cy.wait('@oauthRequest');

      // Reload page
      cy.reload();

      // Verify session persistence
      cy.url().should('include', '/dashboard');
      cy.get('[data-testid="user-profile"]').should('exist');
    });

    it('should handle token refresh', () => {
      // Mock expired token scenario
      cy.intercept('GET', '**/api/user/profile', (req) => {
        if (req.headers.authorization === 'Bearer mock-token') {
          req.reply({
            statusCode: 401,
            body: {
              error: ERROR_CODES.AUTHENTICATION_ERROR,
              message: 'Token expired'
            }
          });
        }
      }).as('expiredToken');

      // Mock token refresh
      cy.intercept('POST', '**/clerk/token/refresh', {
        statusCode: 200,
        body: {
          token: 'new-mock-token'
        }
      }).as('tokenRefresh');

      // Verify automatic token refresh
      cy.get('[data-testid="linkedin-login-btn"]').click();
      cy.wait('@oauthRequest');
      cy.wait('@expiredToken');
      cy.wait('@tokenRefresh');

      // Verify session maintained
      cy.get('[data-testid="user-profile"]').should('exist');
    });

    it('should handle logout properly', () => {
      // Login first
      cy.get('[data-testid="linkedin-login-btn"]').click();
      cy.wait('@oauthRequest');

      // Perform logout
      cy.get('[data-testid="logout-btn"]').click();

      // Verify cleanup
      cy.url().should('not.include', '/dashboard');
      cy.getAllLocalStorage().should('be.empty');
      cy.getAllSessionStorage().should('be.empty');
    });
  });
});