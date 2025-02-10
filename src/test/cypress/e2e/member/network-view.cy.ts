import '@testing-library/cypress/add-commands'; // v8.0.0
import { NodeType } from '../../../web/src/types/graph';

// Test selectors for DOM elements
const TEST_SELECTORS = {
  GRAPH_CONTAINER: '[data-cy=graph-container]',
  GRAPH_NODE: '[data-cy=graph-node]',
  GRAPH_EDGE: '[data-cy=graph-edge]',
  ZOOM_IN: '[data-cy=zoom-in]',
  ZOOM_OUT: '[data-cy=zoom-out]',
  FIT_VIEW: '[data-cy=fit-view]',
  REFRESH: '[data-cy=refresh-layout]',
  NODE_DETAILS: '[data-cy=node-details]',
  CLOSE_DETAILS: '[data-cy=close-details]',
  CONNECTION_FILTER: '[data-cy=connection-filter]',
  TIME_FILTER: '[data-cy=time-filter]',
  SEARCH_INPUT: '[data-cy=search-input]'
};

// API routes for network data
const API_ROUTES = {
  GRAPH_DATA: '/api/v1/graph/member-network',
  NODE_DETAILS: '/api/v1/graph/node/*'
};

// Viewport sizes for responsive testing
const VIEWPORT_SIZES = {
  MOBILE: { width: 320, height: 568 },
  TABLET: { width: 768, height: 1024 },
  DESKTOP: { width: 1024, height: 768 }
};

// Performance thresholds in milliseconds
const PERFORMANCE_THRESHOLDS = {
  GRAPH_LOAD: 3000,
  NODE_INTERACTION: 300,
  FILTER_UPDATE: 1000
};

describe('Member Network View', () => {
  beforeEach(() => {
    // Mock authentication
    cy.intercept('GET', '/api/auth/session', {
      statusCode: 200,
      body: { role: 'MEMBER' }
    });

    // Mock graph data response
    cy.intercept('GET', API_ROUTES.GRAPH_DATA, {
      fixture: 'member-network-graph.json'
    }).as('getGraphData');

    // Mock node details response
    cy.intercept('GET', API_ROUTES.NODE_DETAILS, {
      fixture: 'node-details.json'
    }).as('getNodeDetails');

    // Visit network view page
    cy.visit('/member/network');
    cy.wait('@getGraphData');

    // Basic accessibility check
    cy.injectAxe();
    cy.checkA11y();
  });

  describe('Graph Visualization', () => {
    it('should render the graph container with correct dimensions', () => {
      cy.get(TEST_SELECTORS.GRAPH_CONTAINER)
        .should('be.visible')
        .and('have.attr', 'width')
        .and('have.attr', 'height');
    });

    it('should render correct number of nodes and edges', () => {
      cy.get(TEST_SELECTORS.GRAPH_NODE).should('have.length.gt', 0);
      cy.get(TEST_SELECTORS.GRAPH_EDGE).should('have.length.gt', 0);
    });

    it('should show node tooltips on hover', () => {
      cy.get(TEST_SELECTORS.GRAPH_NODE).first()
        .trigger('mouseover')
        .get('[role="tooltip"]')
        .should('be.visible')
        .and('contain.text');
    });

    it('should handle node selection', () => {
      cy.get(TEST_SELECTORS.GRAPH_NODE).first().click();
      cy.get(TEST_SELECTORS.NODE_DETAILS).should('be.visible');
      cy.wait('@getNodeDetails');
    });

    it('should maintain performance with large datasets', () => {
      cy.window().its('performance').then((performance) => {
        const start = performance.now();
        cy.get(TEST_SELECTORS.GRAPH_NODE).should('be.visible');
        const end = performance.now();
        expect(end - start).to.be.lessThan(PERFORMANCE_THRESHOLDS.GRAPH_LOAD);
      });
    });
  });

  describe('Graph Controls', () => {
    it('should handle zoom controls', () => {
      cy.get(TEST_SELECTORS.ZOOM_IN).click();
      cy.get(TEST_SELECTORS.GRAPH_CONTAINER)
        .should('have.attr', 'transform-scale')
        .and('not.equal', '1');

      cy.get(TEST_SELECTORS.ZOOM_OUT).click();
      cy.get(TEST_SELECTORS.FIT_VIEW).click();
    });

    it('should refresh graph layout', () => {
      const getNodePositions = () => {
        return cy.get(TEST_SELECTORS.GRAPH_NODE)
          .then($nodes => {
            return $nodes.toArray().map(node => ({
              x: node.getAttribute('cx'),
              y: node.getAttribute('cy')
            }));
          });
      };

      getNodePositions().then(initialPositions => {
        cy.get(TEST_SELECTORS.REFRESH).click();
        getNodePositions().should(newPositions => {
          expect(newPositions).to.not.deep.equal(initialPositions);
        });
      });
    });

    it('should support keyboard navigation', () => {
      cy.get(TEST_SELECTORS.GRAPH_CONTAINER).focus();
      cy.realPress('Tab');
      cy.focused().should('have.attr', 'data-cy', 'zoom-in');
      cy.realPress('Space');
      cy.get(TEST_SELECTORS.GRAPH_CONTAINER)
        .should('have.attr', 'transform-scale')
        .and('not.equal', '1');
    });
  });

  describe('Node Details', () => {
    beforeEach(() => {
      cy.get(TEST_SELECTORS.GRAPH_NODE).first().click();
    });

    it('should display correct node information', () => {
      cy.get(TEST_SELECTORS.NODE_DETAILS)
        .should('be.visible')
        .within(() => {
          cy.findByText(/Name:/i).should('be.visible');
          cy.findByText(/Events in Common:/i).should('be.visible');
          cy.findByText(/Connection Strength:/i).should('be.visible');
        });
    });

    it('should handle details panel close', () => {
      cy.get(TEST_SELECTORS.CLOSE_DETAILS).click();
      cy.get(TEST_SELECTORS.NODE_DETAILS).should('not.exist');
    });

    it('should handle API errors gracefully', () => {
      cy.intercept('GET', API_ROUTES.NODE_DETAILS, {
        statusCode: 500,
        body: { error: 'Internal server error' }
      });

      cy.get(TEST_SELECTORS.GRAPH_NODE).last().click();
      cy.findByText(/Error loading node details/i).should('be.visible');
    });
  });

  describe('Filters', () => {
    it('should filter by connection type', () => {
      cy.get(TEST_SELECTORS.CONNECTION_FILTER)
        .click()
        .findByText('Direct Connections')
        .click();

      cy.get(TEST_SELECTORS.GRAPH_NODE)
        .its('length')
        .should('be.lessThan', Cypress.$$(TEST_SELECTORS.GRAPH_NODE).length);
    });

    it('should filter by time period', () => {
      cy.get(TEST_SELECTORS.TIME_FILTER)
        .click()
        .findByText('Last 30 Days')
        .click();

      cy.get('@getGraphData').its('response.body').should('exist');
    });

    it('should handle search functionality', () => {
      cy.get(TEST_SELECTORS.SEARCH_INPUT)
        .type('John{enter}');

      cy.get(TEST_SELECTORS.GRAPH_NODE)
        .should('have.length.gt', 0)
        .and('have.length.lessThan', Cypress.$$(TEST_SELECTORS.GRAPH_NODE).length);
    });
  });

  describe('Responsiveness', () => {
    Object.entries(VIEWPORT_SIZES).forEach(([size, dimensions]) => {
      it(`should adapt layout to ${size} viewport`, () => {
        cy.viewport(dimensions.width, dimensions.height);
        
        // Verify container responsiveness
        cy.get(TEST_SELECTORS.GRAPH_CONTAINER)
          .should('be.visible')
          .and($container => {
            const { width } = $container[0].getBoundingClientRect();
            expect(width).to.be.lessThan(dimensions.width);
          });

        // Verify controls visibility and positioning
        cy.get(TEST_SELECTORS.ZOOM_IN).should('be.visible');
        cy.get(TEST_SELECTORS.ZOOM_OUT).should('be.visible');

        // Test touch interactions on mobile
        if (size === 'MOBILE') {
          cy.get(TEST_SELECTORS.GRAPH_CONTAINER)
            .trigger('touchstart')
            .trigger('touchmove')
            .trigger('touchend');
        }
      });
    });
  });
});