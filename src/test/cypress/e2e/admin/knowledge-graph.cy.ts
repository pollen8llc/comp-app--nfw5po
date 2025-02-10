import { mockGraphData, generateMockGraphData } from '../../utils/mock-data';
import { loginAsAdmin } from '../../utils/auth-helpers';

// Constants for test configuration
const GRAPH_API_ENDPOINT = '/api/v1/graph';
const QUERY_API_ENDPOINT = '/api/v1/graph/query';
const GRAPH_PAGE_URL = '/admin/knowledge-graph';

describe('Admin Knowledge Graph', () => {
  beforeEach(() => {
    // Login as admin before each test
    loginAsAdmin();

    // Mock graph data API responses
    cy.intercept('GET', GRAPH_API_ENDPOINT, {
      statusCode: 200,
      body: generateMockGraphData(50, 0.3)
    }).as('getGraphData');

    // Visit knowledge graph page
    cy.visit(GRAPH_PAGE_URL);
    cy.wait('@getGraphData');
  });

  describe('Query Builder', () => {
    it('should display all query builder components correctly', () => {
      cy.get('[data-testid="query-builder"]').should('be.visible');
      cy.get('[data-testid="node-type-select"]').should('be.visible');
      cy.get('[data-testid="relationship-select"]').should('be.visible');
      cy.get('[data-testid="property-filter"]').should('be.visible');
      cy.get('[data-testid="execute-query"]').should('be.visible');
    });

    it('should allow selecting and configuring node types', () => {
      cy.get('[data-testid="node-type-select"]').click();
      cy.get('[data-testid="node-type-option-member"]').click();
      cy.get('[data-testid="node-type-select"]').should('contain', 'Member');
      
      cy.get('[data-testid="relationship-select"]').click();
      cy.get('[data-testid="relationship-option-attended"]').click();
      cy.get('[data-testid="relationship-select"]').should('contain', 'ATTENDED');
    });

    it('should validate query complexity and enforce limits', () => {
      // Build a complex query that exceeds limits
      for (let i = 0; i < 6; i++) {
        cy.get('[data-testid="add-node-button"]').click();
      }
      
      cy.get('[data-testid="query-complexity-error"]')
        .should('be.visible')
        .and('contain', 'Query complexity limit exceeded');
      
      cy.get('[data-testid="execute-query"]').should('be.disabled');
    });

    it('should execute valid queries and display results', () => {
      // Mock query response
      cy.intercept('POST', QUERY_API_ENDPOINT, {
        statusCode: 200,
        body: mockGraphData
      }).as('executeQuery');

      // Build and execute valid query
      cy.get('[data-testid="node-type-select"]').click();
      cy.get('[data-testid="node-type-option-member"]').click();
      cy.get('[data-testid="relationship-select"]').click();
      cy.get('[data-testid="relationship-option-knows"]').click();
      cy.get('[data-testid="execute-query"]').click();

      cy.wait('@executeQuery');
      cy.get('[data-testid="graph-container"]').should('be.visible');
      cy.get('[data-testid="graph-node"]').should('have.length.gt', 0);
    });
  });

  describe('Graph Visualization', () => {
    it('should render graph container with correct dimensions', () => {
      cy.get('[data-testid="graph-container"]')
        .should('be.visible')
        .and('have.css', 'width', '100%')
        .and('have.css', 'height')
        .and('match', /^[5-9]\d\dvh$/); // Height should be between 500-999vh
    });

    it('should support zoom operations', () => {
      const container = cy.get('[data-testid="graph-container"]');
      
      // Test zoom controls
      cy.get('[data-testid="zoom-in"]').click();
      cy.get('[data-testid="graph-transform"]')
        .invoke('attr', 'transform')
        .should('include', 'scale(1.5)');

      cy.get('[data-testid="zoom-out"]').click();
      cy.get('[data-testid="graph-transform"]')
        .invoke('attr', 'transform')
        .should('include', 'scale(1)');

      // Test mouse wheel zoom
      container.trigger('wheel', { deltaY: -100, ctrlKey: true });
      cy.get('[data-testid="graph-transform"]')
        .invoke('attr', 'transform')
        .should('include', 'scale(1.25)');
    });

    it('should handle node selection and details display', () => {
      cy.get('[data-testid="graph-node"]').first().click();
      cy.get('[data-testid="node-details-panel"]')
        .should('be.visible')
        .and('contain', mockGraphData.nodes[0].metadata.label);
    });

    it('should maintain force layout stability', () => {
      // Record initial node positions
      const initialPositions: Array<{ x: number; y: number }> = [];
      cy.get('[data-testid="graph-node"]').each(($node) => {
        initialPositions.push({
          x: parseFloat($node.attr('cx') || '0'),
          y: parseFloat($node.attr('cy') || '0')
        });
      });

      // Wait for force simulation to stabilize
      cy.wait(2000);

      // Verify positions haven't changed significantly
      cy.get('[data-testid="graph-node"]').each(($node, index) => {
        const currentX = parseFloat($node.attr('cx') || '0');
        const currentY = parseFloat($node.attr('cy') || '0');
        expect(Math.abs(currentX - initialPositions[index].x)).to.be.lessThan(1);
        expect(Math.abs(currentY - initialPositions[index].y)).to.be.lessThan(1);
      });
    });
  });

  describe('Interactive Features', () => {
    it('should highlight connected nodes on hover', () => {
      cy.get('[data-testid="graph-node"]').first().trigger('mouseover');
      
      cy.get('[data-testid="graph-edge"].highlighted').should('exist');
      cy.get('[data-testid="graph-node"].connected').should('exist');
      
      cy.get('[data-testid="graph-node"]').first().trigger('mouseout');
      cy.get('[data-testid="graph-edge"].highlighted').should('not.exist');
    });

    it('should support node dragging with position memory', () => {
      const node = cy.get('[data-testid="graph-node"]').first();
      const initialPosition = { x: 0, y: 0 };

      // Record initial position
      node.then($node => {
        initialPosition.x = parseFloat($node.attr('cx') || '0');
        initialPosition.y = parseFloat($node.attr('cy') || '0');
      });

      // Perform drag operation
      node.trigger('mousedown')
        .trigger('mousemove', { clientX: 100, clientY: 100 })
        .trigger('mouseup');

      // Verify new position
      node.then($node => {
        const newX = parseFloat($node.attr('cx') || '0');
        const newY = parseFloat($node.attr('cy') || '0');
        expect(newX).to.not.equal(initialPosition.x);
        expect(newY).to.not.equal(initialPosition.y);
      });

      // Verify position persistence after page reload
      cy.reload();
      cy.wait('@getGraphData');

      node.then($node => {
        const persistedX = parseFloat($node.attr('cx') || '0');
        const persistedY = parseFloat($node.attr('cy') || '0');
        expect(persistedX).to.not.equal(initialPosition.x);
        expect(persistedY).to.not.equal(initialPosition.y);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      cy.intercept('GET', GRAPH_API_ENDPOINT, {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('getGraphDataError');

      cy.reload();
      cy.wait('@getGraphDataError');

      cy.get('[data-testid="error-message"]')
        .should('be.visible')
        .and('contain', 'Failed to load graph data');
      
      cy.get('[data-testid="retry-button"]').should('be.visible').click();
      cy.get('[data-testid="loading-indicator"]').should('be.visible');
    });

    it('should maintain UI stability during errors', () => {
      // Simulate query execution error
      cy.intercept('POST', QUERY_API_ENDPOINT, {
        statusCode: 400,
        body: { error: 'Invalid query syntax' }
      }).as('queryError');

      cy.get('[data-testid="execute-query"]').click();
      cy.wait('@queryError');

      // Verify error display
      cy.get('[data-testid="query-error"]')
        .should('be.visible')
        .and('contain', 'Invalid query syntax');

      // Verify UI remains functional
      cy.get('[data-testid="node-type-select"]').should('be.enabled');
      cy.get('[data-testid="execute-query"]').should('be.enabled');
      cy.get('[data-testid="graph-container"]').should('be.visible');
    });
  });
});