import { generateMockMember } from '../../../utils/mock-data';
import { Member } from '../../../../backend/shared/types/member.types';
import 'cypress';
import '@axe-core/cypress';

// Test member ID from environment variable
const TEST_MEMBER_ID = Cypress.env('TEST_MEMBER_ID');

// Selectors for profile page elements
const PROFILE_SELECTORS = {
  editButton: '[data-cy=edit-profile-button]',
  saveButton: '[data-cy=save-profile-button]',
  nameInput: '[data-cy=profile-name-input]',
  emailInput: '[data-cy=profile-email-input]',
  locationInput: '[data-cy=profile-location-input]',
  socialConnections: '[data-cy=social-connections]',
  securitySettings: '[data-cy=security-settings]',
  accessibilityControls: '[data-cy=accessibility-controls]'
};

/**
 * Sets up authenticated session with security headers and tokens
 */
function setupAuthenticatedSession() {
  // Set secure HTTP-only cookies
  cy.setCookie('session', Cypress.env('SESSION_TOKEN'), {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  });

  // Configure security headers
  cy.intercept('**/*', (req) => {
    req.headers['X-CSRF-Token'] = Cypress.env('CSRF_TOKEN');
    req.headers['Content-Security-Policy'] = "default-src 'self'";
    req.headers['Strict-Transport-Security'] = 'max-age=31536000';
  });
}

describe('Member Profile Tests', () => {
  let mockMember: Member;

  beforeEach(() => {
    // Reset database and cache state
    cy.task('db:reset');
    cy.task('cache:clear');

    // Generate mock member data
    mockMember = generateMockMember({
      id: TEST_MEMBER_ID,
      profile: {
        dataClassification: 'CONFIDENTIAL'
      }
    });

    // Seed test database with encrypted data
    cy.task('db:seed', { member: mockMember });

    // Setup authenticated session
    setupAuthenticatedSession();

    // Configure axe for accessibility testing
    cy.configureAxe({
      rules: [
        { id: 'color-contrast', enabled: true },
        { id: 'aria-required-attr', enabled: true }
      ]
    });

    // Visit profile page with CSRF token
    cy.visit(`/member/profile/${TEST_MEMBER_ID}`, {
      headers: {
        'X-CSRF-Token': Cypress.env('CSRF_TOKEN')
      }
    });
  });

  describe('View Profile', () => {
    it('should display member profile information securely', () => {
      // Verify secure connection
      cy.location('protocol').should('eq', 'https:');
      
      // Check security headers
      cy.request('/member/profile').then((response) => {
        expect(response.headers).to.include({
          'content-security-policy': "default-src 'self'",
          'strict-transport-security': 'max-age=31536000'
        });
      });

      // Verify PII field masking
      cy.get(PROFILE_SELECTORS.emailInput)
        .should('have.attr', 'type', 'email')
        .and('have.class', 'masked-field');

      // Validate data classification
      cy.get('[data-classification]')
        .should('have.attr', 'data-classification', 'CONFIDENTIAL');

      // Check accessibility
      cy.injectAxe();
      cy.checkA11y();

      // Verify social profile status
      cy.get(PROFILE_SELECTORS.socialConnections)
        .find('[data-platform="LINKEDIN"]')
        .should('have.attr', 'data-verified', 'true');
    });
  });

  describe('Edit Profile', () => {
    it('should handle profile updates securely with validation', () => {
      // Start edit mode
      cy.get(PROFILE_SELECTORS.editButton).click();

      // Verify CSRF token
      cy.get('form').should('have.attr', 'data-csrf');

      // Test input validation
      cy.get(PROFILE_SELECTORS.nameInput)
        .clear()
        .type('<script>alert("xss")</script>')
        .should('have.value', 'alert("xss")');

      // Update profile fields
      const newName = 'Updated Name';
      cy.get(PROFILE_SELECTORS.nameInput)
        .clear()
        .type(newName);

      // Save changes with optimistic update
      cy.get(PROFILE_SELECTORS.saveButton).click();

      // Verify update success
      cy.get(PROFILE_SELECTORS.nameInput)
        .should('have.value', newName);

      // Check audit trail
      cy.task('db:getAuditLog').then((log) => {
        expect(log).to.have.length(1);
        expect(log[0]).to.include({
          action: 'PROFILE_UPDATE',
          memberId: TEST_MEMBER_ID
        });
      });

      // Verify accessibility during edit
      cy.checkA11y();
    });
  });

  describe('Social Profile Connections', () => {
    it('should handle social profile integration securely', () => {
      // Test LinkedIn connection
      cy.get('[data-cy=connect-linkedin]').click();

      // Verify OAuth flow security
      cy.location('protocol').should('eq', 'https:');
      cy.location('hostname').should('eq', 'api.linkedin.com');

      // Mock successful connection
      cy.intercept('POST', '/api/social/connect', {
        statusCode: 200,
        body: {
          platform: 'LINKEDIN',
          verified: true
        }
      });

      // Verify connection status update
      cy.get('[data-platform="LINKEDIN"]')
        .should('have.attr', 'data-verified', 'true');

      // Test connection removal
      cy.get('[data-cy=remove-linkedin]').click();
      cy.get('[data-platform="LINKEDIN"]')
        .should('have.attr', 'data-verified', 'false');
    });
  });

  describe('Profile Security', () => {
    it('should enforce security measures for profile data', () => {
      // Verify field-level encryption
      cy.task('db:getMemberEncrypted', TEST_MEMBER_ID).then((encrypted) => {
        expect(encrypted.profile.email).not.to.eq(mockMember.profile.email);
      });

      // Test access control
      cy.request({
        url: `/api/member/${TEST_MEMBER_ID}`,
        failOnStatusCode: false,
        headers: {
          'Authorization': 'invalid'
        }
      }).then((response) => {
        expect(response.status).to.eq(401);
      });

      // Validate secure transmission
      cy.intercept('/api/member/*').as('memberApi');
      cy.wait('@memberApi').then((interception) => {
        expect(interception.request.headers['content-type'])
          .to.eq('application/json');
        expect(interception.response?.headers['content-type'])
          .to.match(/^application\/json/);
      });

      // Check PII handling
      cy.get('[data-pii]').each(($el) => {
        expect($el).to.have.attr('data-masked', 'true');
        expect($el).to.have.class('encrypted-field');
      });
    });
  });
});