import { UserRole, SocialProvider } from '../../../../web/src/types/auth';
import { HttpStatus, ErrorCode } from '../../../../web/src/types/api';

// Third-party package versions:
// cypress ^12.0.0
// @testing-library/cypress ^9.0.0

describe('Authentication Flow', () => {
  const testSelectors = {
    emailInput: '[data-testid="email-input"]',
    passwordInput: '[data-testid="password-input"]',
    loginButton: '[data-testid="login-button"]',
    errorMessage: '[data-testid="error-message"]',
    linkedinButton: '[data-testid="linkedin-login"]',
    gmailButton: '[data-testid="gmail-login"]',
    logoutButton: '[data-testid="logout-button"]'
  };

  const validCredentials = {
    email: 'test@example.com',
    password: 'testPassword123',
    role: UserRole.MEMBER
  };

  const securityHeaders = {
    'Content-Security-Policy': "default-src 'self'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000'
  };

  beforeEach(() => {
    // Reset authentication state
    cy.window().then((win) => {
      win.localStorage.clear();
      win.sessionStorage.clear();
    });

    // Visit login page and verify security headers
    cy.visit('/login');
    Object.entries(securityHeaders).forEach(([header, value]) => {
      cy.request('/login').its('headers').should('include', { [header]: value });
    });
  });

  it('should successfully login with valid credentials', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: HttpStatus.OK,
      body: {
        token: 'valid-jwt-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: Date.now() + 3600000 // 1 hour from now
      }
    }).as('loginRequest');

    cy.get(testSelectors.emailInput).type(validCredentials.email);
    cy.get(testSelectors.passwordInput).type(validCredentials.password);
    cy.get(testSelectors.loginButton).click();

    cy.wait('@loginRequest').then((interception) => {
      expect(interception.request.body).to.deep.equal({
        email: validCredentials.email,
        password: validCredentials.password
      });
    });

    // Verify successful redirect and auth state
    cy.url().should('include', '/dashboard');
    cy.window().its('localStorage.auth_token').should('exist');
    cy.window().its('localStorage.auth_session').should('exist');
  });

  it('should validate token expiration and refresh', () => {
    const now = Date.now();
    
    // Login with soon-to-expire token
    cy.login({
      email: validCredentials.email,
      role: validCredentials.role
    });

    // Mock token refresh endpoint
    cy.intercept('POST', '/api/auth/refresh', {
      statusCode: HttpStatus.OK,
      body: {
        token: 'new-jwt-token',
        refreshToken: 'new-refresh-token',
        expiresAt: now + 7200000 // 2 hours from now
      }
    }).as('refreshRequest');

    // Advance time to near token expiration
    cy.clock(now + 3500000); // 58 minutes later
    cy.tick(60000); // Advance 1 minute

    // Verify automatic token refresh
    cy.wait('@refreshRequest').then((interception) => {
      expect(interception.request.headers).to.have.property('Authorization');
    });

    // Verify new token is stored
    cy.window().its('localStorage.auth_token')
      .should('equal', 'new-jwt-token');
  });

  it('should handle social authentication via LinkedIn', () => {
    cy.intercept('GET', '**/linkedin/oauth/callback*', {
      statusCode: HttpStatus.OK,
      body: {
        token: 'linkedin-jwt-token',
        refreshToken: 'linkedin-refresh-token',
        expiresAt: Date.now() + 3600000
      }
    }).as('linkedinCallback');

    cy.get(testSelectors.linkedinButton).click();

    // Verify OAuth flow
    cy.url().should('include', 'linkedin.com');
    cy.origin('https://linkedin.com', () => {
      cy.get('[data-testid="oauth-authorize"]').click();
    });

    cy.wait('@linkedinCallback');
    cy.url().should('include', '/dashboard');
  });

  it('should enforce rate limiting on login attempts', () => {
    const attempts = Array(6).fill(null);
    
    cy.intercept('POST', '/api/auth/login').as('loginAttempt');

    // Attempt multiple rapid logins
    attempts.forEach(() => {
      cy.get(testSelectors.emailInput).type('test@example.com');
      cy.get(testSelectors.passwordInput).type('wrongpass');
      cy.get(testSelectors.loginButton).click();
      cy.get(testSelectors.emailInput).clear();
      cy.get(testSelectors.passwordInput).clear();
    });

    // Verify rate limit error
    cy.wait('@loginAttempt').then((interception) => {
      expect(interception.response?.statusCode).to.equal(HttpStatus.TOO_MANY_REQUESTS);
      expect(interception.response?.body.code).to.equal(ErrorCode.RATE_LIMIT_EXCEEDED);
    });

    cy.get(testSelectors.errorMessage)
      .should('contain', 'Too many login attempts');
  });

  it('should validate role-based access control', () => {
    // Test different role access levels
    const roles = [UserRole.ADMIN, UserRole.MEMBER, UserRole.ANALYST, UserRole.GUEST];
    
    roles.forEach((role) => {
      cy.login({
        email: `${role.toLowerCase()}@example.com`,
        role: role
      });

      // Verify role-specific access
      if (role === UserRole.ADMIN) {
        cy.visit('/admin/settings');
        cy.url().should('include', '/admin/settings');
      } else {
        cy.visit('/admin/settings');
        cy.url().should('include', '/unauthorized');
      }

      cy.get(testSelectors.logoutButton).click();
    });
  });

  it('should handle session timeout correctly', () => {
    const sessionTimeout = 1800000; // 30 minutes
    const now = Date.now();

    cy.login({
      email: validCredentials.email,
      role: validCredentials.role
    });

    // Advance time beyond session timeout
    cy.clock(now + sessionTimeout + 60000);
    cy.tick(60000);

    // Verify session timeout handling
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
    cy.get(testSelectors.errorMessage)
      .should('contain', 'Session expired');
  });

  it('should implement security headers and CSP', () => {
    // Verify all security headers
    cy.request('/login').then((response) => {
      Object.entries(securityHeaders).forEach(([header, value]) => {
        expect(response.headers[header.toLowerCase()]).to.equal(value);
      });
    });

    // Verify CSP blocks unauthorized sources
    cy.intercept('GET', 'https://malicious-site.com/*').as('blockedRequest');
    
    cy.window().then((win) => {
      const script = win.document.createElement('script');
      script.src = 'https://malicious-site.com/script.js';
      win.document.body.appendChild(script);
    });

    cy.get('@blockedRequest').should('not.exist');
  });
});