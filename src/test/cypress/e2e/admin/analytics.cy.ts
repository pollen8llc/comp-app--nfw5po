import { mockGraphData } from '../../../utils/mock-data';
import { mockTDAResults } from '../../fixtures/tda-results.json';
import { DistanceMetric } from '../../../../backend/shared/types/analytics.types';

describe('Admin Analytics Page', () => {
  beforeEach(() => {
    // Visit admin analytics page and set up API intercepts
    cy.visit('/admin/analytics');
    cy.intercept('GET', '/api/v1/graph/data', mockGraphData(50, 0.3)).as('graphData');
    cy.intercept('POST', '/api/v1/analytics/tda', mockTDAResults).as('tdaComputation');
    
    // Wait for initial page load and animations
    cy.get('[data-testid="analytics-container"]').should('be.visible');
    cy.get('[data-testid="loading-indicator"]').should('not.exist');
    
    // Verify base accessibility
    cy.injectAxe();
    cy.checkA11y();
  });

  describe('TDA Parameter Controls', () => {
    it('should display default parameter values correctly', () => {
      cy.get('[data-testid="epsilon-slider"]').should('have.value', '0.5');
      cy.get('[data-testid="min-points-slider"]').should('have.value', '15');
      cy.get('[data-testid="dimension-2d"]').should('be.checked');
      cy.get('[data-testid="distance-metric"]').should('have.value', 'euclidean');
    });

    it('should validate epsilon range constraints', () => {
      cy.get('[data-testid="epsilon-slider"]')
        .invoke('val', 0.05)
        .trigger('change')
        .get('[data-testid="validation-error"]')
        .should('contain', 'Epsilon must be between 0.1 and 1.0');

      cy.get('[data-testid="epsilon-slider"]')
        .invoke('val', 0.5)
        .trigger('change')
        .get('[data-testid="validation-error"]')
        .should('not.exist');
    });

    it('should handle dimension switching with animation', () => {
      cy.get('[data-testid="dimension-3d"]').click();
      cy.get('[data-testid="graph-container"]')
        .should('have.attr', 'data-dimension', '3');
      cy.get('[data-testid="transition-animation"]')
        .should('exist');
    });

    it('should reset parameters to defaults', () => {
      // Modify parameters
      cy.get('[data-testid="epsilon-slider"]').invoke('val', 0.7).trigger('change');
      cy.get('[data-testid="min-points-slider"]').invoke('val', 25).trigger('change');
      cy.get('[data-testid="dimension-3d"]').click();
      
      // Reset and verify
      cy.get('[data-testid="reset-parameters"]').click();
      cy.get('[data-testid="epsilon-slider"]').should('have.value', '0.5');
      cy.get('[data-testid="min-points-slider"]').should('have.value', '15');
      cy.get('[data-testid="dimension-2d"]').should('be.checked');
    });
  });

  describe('Network Graph Visualization', () => {
    it('should render initial graph with correct node count', () => {
      cy.get('[data-testid="graph-node"]').should('have.length', 50);
      cy.get('[data-testid="graph-edge"]').should('exist');
    });

    it('should support zoom interactions', () => {
      const zoom = cy.get('[data-testid="zoom-controls"]');
      zoom.find('[data-testid="zoom-in"]').click();
      cy.get('[data-testid="graph-container"]')
        .should('have.attr', 'data-scale')
        .and('be.gt', 1);
    });

    it('should handle node selection and highlight', () => {
      cy.get('[data-testid="graph-node"]').first().click();
      cy.get('[data-testid="node-details"]').should('be.visible');
      cy.get('[data-testid="graph-node"].highlighted').should('exist');
    });

    it('should maintain performance under load', () => {
      cy.window().its('performance').then((p) => {
        const start = p.now();
        cy.get('[data-testid="graph-container"]')
          .trigger('mousemove', { clientX: 100, clientY: 100 })
          .then(() => {
            const end = p.now();
            expect(end - start).to.be.lessThan(16); // 60fps threshold
          });
      });
    });
  });

  describe('Persistence Diagram', () => {
    it('should render persistence diagram with correct points', () => {
      cy.get('[data-testid="persistence-diagram"]')
        .find('[data-testid="diagram-point"]')
        .should('have.length', mockTDAResults.persistence_diagram.points.length);
    });

    it('should display point details on hover', () => {
      cy.get('[data-testid="diagram-point"]').first()
        .trigger('mouseover')
        .get('[data-testid="point-tooltip"]')
        .should('be.visible')
        .and('contain', 'Birth: 0.1')
        .and('contain', 'Death: 0.3');
    });

    it('should support keyboard navigation', () => {
      cy.get('[data-testid="persistence-diagram"]').focus();
      cy.realPress('Tab');
      cy.get('[data-testid="diagram-point"]').first()
        .should('have.focus');
      cy.realPress('ArrowRight');
      cy.get('[data-testid="diagram-point"]').eq(1)
        .should('have.focus');
    });
  });

  describe('Computation Flow', () => {
    it('should handle TDA computation with loading states', () => {
      // Modify parameters and trigger computation
      cy.get('[data-testid="epsilon-slider"]').invoke('val', 0.7).trigger('change');
      cy.get('[data-testid="compute-tda"]').click();

      // Verify loading state
      cy.get('[data-testid="computation-progress"]').should('be.visible');
      
      // Wait for computation and verify results
      cy.wait('@tdaComputation');
      cy.get('[data-testid="computation-progress"]').should('not.exist');
      cy.get('[data-testid="persistence-diagram"]').should('be.visible');
    });

    it('should handle computation errors gracefully', () => {
      cy.intercept('POST', '/api/v1/analytics/tda', {
        statusCode: 500,
        body: { error: 'Computation failed' }
      }).as('failedComputation');

      cy.get('[data-testid="compute-tda"]').click();
      cy.wait('@failedComputation');
      cy.get('[data-testid="error-message"]')
        .should('be.visible')
        .and('contain', 'Computation failed');
    });

    it('should enforce computation time limits', () => {
      cy.window().its('performance').then((p) => {
        const start = p.now();
        cy.get('[data-testid="compute-tda"]').click();
        cy.wait('@tdaComputation').then(() => {
          const end = p.now();
          expect(end - start).to.be.lessThan(2000); // 2-second requirement
        });
      });
    });
  });
});