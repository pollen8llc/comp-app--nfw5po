import { generateTestToken } from '../../../utils/auth-helpers';
import { TestAPIClient } from '../../../utils/api-client';
import { UserRole } from '../../../../web/src/types/auth';
import '@testing-library/cypress/add-commands';

describe('Admin Dashboard', () => {
  let apiClient: TestAPIClient;

  beforeEach(() => {
    // Generate admin token for authentication
    const adminToken = generateTestToken({
      id: 'test-admin-id',
      email: 'admin@test.com',
      role: UserRole.ADMIN
    });

    // Initialize API client with performance tracking
    apiClient = new TestAPIClient('http://localhost:3000/api');
    apiClient.setAuthToken(adminToken);

    // Mock API responses
    apiClient.mockResponse(
      { path: '/api/stats/quick' },
      {
        status: 200,
        data: {
          members: 1245,
          events: 89,
          activeNow: 32
        }
      }
    );

    // Visit dashboard with auth token
    cy.visit('/admin/dashboard');
    cy.wait('@getQuickStats');
  });

  it('should display correct layout elements', () => {
    // Verify header elements
    cy.findByRole('banner').within(() => {
      cy.findByText('Community Platform').should('be.visible');
      cy.findByRole('button', { name: /profile/i }).should('be.visible');
      cy.findByRole('button', { name: /settings/i }).should('be.visible');
    });

    // Verify sidebar navigation
    cy.findByRole('navigation').within(() => {
      cy.findByRole('link', { name: /dashboard/i }).should('have.attr', 'aria-current', 'page');
      cy.findByRole('link', { name: /members/i }).should('be.visible');
      cy.findByRole('link', { name: /profiles/i }).should('be.visible');
      cy.findByRole('link', { name: /events/i }).should('be.visible');
      cy.findByRole('link', { name: /analytics/i }).should('be.visible');
      cy.findByRole('link', { name: /settings/i }).should('be.visible');
    });

    // Verify main content area
    cy.findByRole('main').should('be.visible');
    cy.findByTestId('data-grid').should('be.visible');
    cy.findByTestId('action-panel').should('be.visible');
    cy.findByTestId('detail-view').should('be.visible');

    // Verify responsive layout
    cy.viewport('iphone-6');
    cy.findByRole('navigation').should('not.be.visible');
    cy.findByRole('button', { name: /menu/i }).should('be.visible');
  });

  it('should show accurate quick stats', () => {
    // Verify quick stats section
    cy.findByTestId('quick-stats').within(() => {
      cy.findByText('Members:').next().should('have.text', '1,245');
      cy.findByText('Events:').next().should('have.text', '89');
      cy.findByText('Active Now:').next().should('have.text', '32');
    });

    // Verify real-time updates
    apiClient.mockResponse(
      { path: '/api/stats/quick' },
      {
        status: 200,
        data: {
          members: 1246,
          events: 89,
          activeNow: 33
        }
      }
    );

    cy.wait(30000); // Wait for polling interval
    cy.findByText('Members:').next().should('have.text', '1,246');
    cy.findByText('Active Now:').next().should('have.text', '33');
  });

  it('should render network visualization', () => {
    const testGraphData = {
      nodes: Array.from({ length: 50 }, (_, i) => ({
        id: `node-${i}`,
        label: `Node ${i}`,
        type: i % 2 === 0 ? 'member' : 'event'
      })),
      edges: Array.from({ length: 75 }, (_, i) => ({
        source: `node-${i % 50}`,
        target: `node-${(i + 1) % 50}`,
        type: 'attended'
      }))
    };

    apiClient.mockResponse(
      { path: '/api/graph/visualization' },
      {
        status: 200,
        data: testGraphData
      }
    );

    // Verify graph container and controls
    cy.findByTestId('network-visualization').should('be.visible');
    cy.findByRole('button', { name: /zoom in/i }).should('be.visible');
    cy.findByRole('button', { name: /zoom out/i }).should('be.visible');
    cy.findByRole('button', { name: /pan/i }).should('be.visible');
    cy.findByRole('button', { name: /center/i }).should('be.visible');
    cy.findByRole('button', { name: /fit/i }).should('be.visible');

    // Verify graph rendering
    cy.get('[data-testid="graph-node"]').should('have.length', 50);
    cy.get('[data-testid="graph-edge"]').should('have.length', 75);

    // Test interactions
    cy.findByRole('button', { name: /zoom in/i }).click();
    cy.get('[data-testid="graph-container"]').should('have.attr', 'data-zoom-level', '1.2');

    // Test node selection
    cy.get('[data-testid="graph-node"]').first().click();
    cy.findByTestId('node-details').should('be.visible')
      .and('contain.text', 'Node 0');
  });

  it('should meet performance requirements', () => {
    // Start performance tracking
    const startTime = performance.now();

    // Load dashboard with full data
    cy.visit('/admin/dashboard').then(() => {
      const loadTime = performance.now() - startTime;
      expect(loadTime).to.be.lessThan(2000); // 2 second requirement
    });

    // Track graph query performance
    cy.intercept('/api/graph/query*').as('graphQuery');
    cy.findByRole('button', { name: /refresh graph/i }).click();
    cy.wait('@graphQuery').then((interception) => {
      expect(interception.response?.headers['x-response-time']).to.be.lessThan(2000);
    });

    // Test under throttled conditions
    cy.throttle('slow3g');
    cy.findByRole('button', { name: /refresh graph/i }).click();
    cy.wait('@graphQuery').then((interception) => {
      expect(interception.response?.headers['x-response-time']).to.be.lessThan(5000);
    });
  });

  it('should validate data accuracy', () => {
    // Load test dataset
    const testMembers = Array.from({ length: 100 }, (_, i) => ({
      id: `member-${i}`,
      name: `Test Member ${i}`,
      email: `member${i}@test.com`,
      role: i % 3 === 0 ? 'ADMIN' : 'MEMBER'
    }));

    apiClient.mockResponse(
      { path: '/api/members' },
      {
        status: 200,
        data: testMembers
      }
    );

    // Verify data grid accuracy
    cy.findByTestId('data-grid').within(() => {
      cy.get('tr').should('have.length', 101); // Including header
      cy.get('tr').first().within(() => {
        cy.findByText('Name').should('be.visible');
        cy.findByText('Email').should('be.visible');
        cy.findByText('Role').should('be.visible');
      });
    });

    // Test filtering accuracy
    cy.findByRole('textbox', { name: /search/i }).type('Admin');
    cy.get('tr').should('have.length', 34); // 33 admins + header

    // Verify entity disambiguation
    cy.findByText('Test Member 0').click();
    cy.findByTestId('member-details').within(() => {
      cy.findByText('member0@test.com').should('be.visible');
      cy.findByText('ADMIN').should('be.visible');
    });
  });
});