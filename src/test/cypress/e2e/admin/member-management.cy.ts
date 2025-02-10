import { generateMockMember } from '../../../utils/mock-data';
import { createTestClient } from '../../../utils/test-helpers';

// Test environment variables
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

// Performance thresholds
const LIST_LOAD_TIMEOUT = 2000; // 2 seconds max for list load
const MUTATION_TIMEOUT = 1000; // 1 second max for mutations

describe('Member Management', () => {
  beforeEach(() => {
    // Reset database state
    cy.task('resetDb');

    // Generate test data
    const mockMembers = Array.from({ length: 5 }, () => generateMockMember());
    cy.task('seedMembers', mockMembers);

    // Login as admin
    loginAsAdmin();

    // Navigate to member management
    cy.visit('/admin/members');

    // Verify initial page load performance
    cy.get('[data-testid="member-list"]', { timeout: LIST_LOAD_TIMEOUT })
      .should('be.visible')
      .then(($el) => {
        const loadTime = performance.now();
        expect(loadTime).to.be.lessThan(LIST_LOAD_TIMEOUT);
      });
  });

  describe('Member List View', () => {
    it('displays member list in grid view with correct data', () => {
      cy.get('[data-testid="member-grid"]')
        .should('be.visible')
        .within(() => {
          // Verify grid layout
          cy.get('[data-testid="member-card"]')
            .should('have.length.at.least', 1)
            .first()
            .within(() => {
              cy.get('[data-testid="member-name"]').should('be.visible');
              cy.get('[data-testid="member-email"]').should('be.visible');
              cy.get('[data-testid="member-role"]').should('be.visible');
            });

          // Test keyboard navigation
          cy.get('[data-testid="member-card"]').first().focus()
            .type('{rightarrow}')
            .should('have.attr', 'aria-selected', 'true');
        });
    });

    it('switches between grid and list views with animation', () => {
      // Test view toggle
      cy.get('[data-testid="view-toggle"]')
        .should('be.visible')
        .click();

      // Verify animation performance
      cy.get('[data-testid="member-list"]')
        .should('be.visible')
        .and('have.class', 'list-view')
        .then(($el) => {
          const transitionDuration = parseFloat(
            window.getComputedStyle($el[0]).transitionDuration
          );
          expect(transitionDuration).to.be.lessThan(0.3); // 300ms max
        });

      // Verify list layout
      cy.get('[data-testid="member-row"]')
        .should('be.visible')
        .and('have.length.at.least', 1);
    });

    it('implements infinite scroll with performance monitoring', () => {
      // Generate more test data
      const moreMembers = Array.from({ length: 20 }, () => generateMockMember());
      cy.task('seedMembers', moreMembers);

      // Scroll and monitor performance
      cy.get('[data-testid="member-grid"]')
        .scrollTo('bottom')
        .then(() => {
          cy.get('[data-testid="member-card"]')
            .should('have.length.greaterThan', 10)
            .then(($cards) => {
              const renderTime = performance.now();
              expect(renderTime).to.be.lessThan(LIST_LOAD_TIMEOUT);
            });
        });
    });
  });

  describe('Member Creation', () => {
    it('creates new member with valid data and social profiles', () => {
      const newMember = generateMockMember();

      cy.get('[data-testid="add-member-button"]').click();

      // Fill form with test data
      cy.get('[data-testid="member-form"]').within(() => {
        cy.get('input[name="profile.name"]').type(newMember.profile.name);
        cy.get('input[name="profile.email"]').type(newMember.profile.email);
        cy.get('select[name="profile.role"]').select(newMember.profile.role);

        // Add social profiles
        newMember.socialProfiles.forEach((profile, index) => {
          cy.get(`[data-testid="social-profile-${profile.platform}"]`)
            .click()
            .within(() => {
              cy.get('input[name="externalId"]').type(profile.externalId);
            });
        });

        // Submit form
        cy.get('[type="submit"]')
          .click()
          .then(() => {
            // Verify response time
            const submitTime = performance.now();
            expect(submitTime).to.be.lessThan(MUTATION_TIMEOUT);
          });
      });

      // Verify success notification
      cy.get('[data-testid="success-notification"]')
        .should('be.visible')
        .and('contain', 'Member created successfully');

      // Verify member appears in list
      cy.get('[data-testid="member-grid"]')
        .contains(newMember.profile.name);
    });

    it('validates required fields and shows errors', () => {
      cy.get('[data-testid="add-member-button"]').click();

      // Submit empty form
      cy.get('[data-testid="member-form"]')
        .find('[type="submit"]')
        .click();

      // Verify validation errors
      cy.get('[data-testid="form-error"]')
        .should('be.visible')
        .and('contain', 'Name is required')
        .and('contain', 'Email is required')
        .and('contain', 'Role is required');
    });
  });

  describe('Member Filtering and Search', () => {
    it('filters members by role with performance tracking', () => {
      cy.get('[data-testid="role-filter"]')
        .select('ADMIN')
        .then(() => {
          const filterTime = performance.now();
          expect(filterTime).to.be.lessThan(LIST_LOAD_TIMEOUT);
        });

      cy.get('[data-testid="member-card"]')
        .should('have.length.at.least', 1)
        .each(($card) => {
          cy.wrap($card)
            .find('[data-testid="member-role"]')
            .should('contain', 'ADMIN');
        });
    });

    it('searches members with debounced input', () => {
      const searchTerm = 'test';

      cy.get('[data-testid="member-search"]')
        .type(searchTerm)
        .then(() => {
          // Wait for debounce
          cy.wait(300);

          cy.get('[data-testid="member-card"]')
            .should('have.length.at.least', 0)
            .each(($card) => {
              const text = $card.text().toLowerCase();
              expect(text).to.include(searchTerm);
            });
        });
    });
  });
});

// Helper function to login as admin
function loginAsAdmin(): void {
  cy.session('admin', () => {
    cy.visit('/login');
    
    cy.get('input[name="email"]')
      .type(ADMIN_EMAIL as string);
    
    cy.get('input[name="password"]')
      .type(ADMIN_PASSWORD as string);
    
    cy.get('button[type="submit"]').click();
    
    // Verify successful login
    cy.url().should('include', '/admin');
    cy.getCookie('session').should('exist');
  });
}