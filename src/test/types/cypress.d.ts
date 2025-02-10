/// <reference types="cypress" />

// Import types from test utilities
import { TestContext } from './test-utils';
import { Member } from '../../backend/shared/types/member.types';
import { Event, EventPlatform } from '../../backend/shared/types/event.types';

/**
 * Type definitions extending Cypress namespace with custom commands for testing
 * the Community Management Platform.
 * @packageVersion cypress@^12.0.0
 */
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login with email/password credentials
       * @param credentials Login credentials object
       * @example
       * cy.login({ email: 'user@example.com', password: 'password123' })
       */
      login(credentials: { email: string; password: string }): Chainable<void>;

      /**
       * Custom command to perform social login via supported providers
       * @param provider Social login provider
       * @example
       * cy.socialLogin('linkedin')
       */
      socialLogin(provider: 'linkedin' | 'gmail'): Chainable<void>;

      /**
       * Custom command to set up a test user with optional custom data
       * @param userData Optional partial member data to override defaults
       * @returns Chainable containing created Member object
       * @example
       * cy.setupTestUser({ profile: { name: 'Test User' } })
       */
      setupTestUser(userData?: Partial<Member>): Chainable<Member>;

      /**
       * Custom command to visit and verify access to protected routes
       * @param route Protected route path
       * @example
       * cy.visitProtectedRoute('/admin/dashboard')
       */
      visitProtectedRoute(route: string): Chainable<void>;

      /**
       * Custom command to verify network graph visualization state
       * @param expectedData Expected graph metrics
       * @example
       * cy.checkNetworkGraph({ nodes: 10, edges: 15 })
       */
      checkNetworkGraph(expectedData: { 
        nodes: number; 
        edges: number 
      }): Chainable<void>;

      /**
       * Custom command to test event import functionality
       * @param eventData Event import configuration
       * @example
       * cy.importEvent({ platform: 'LUMA', apiKey: 'key123' })
       */
      importEvent(eventData: { 
        platform: string; 
        file?: string; 
        apiKey?: string 
      }): Chainable<void>;

      /**
       * Custom command to verify performance metrics against thresholds
       * @param thresholds Performance threshold values
       * @example
       * cy.checkPerformance({ responseTime: 2000, successRate: 0.99 })
       */
      checkPerformance(thresholds: { 
        responseTime: number; 
        successRate: number 
      }): Chainable<void>;

      /**
       * Custom command to validate visualization component state
       * @param selector CSS selector for visualization component
       * @param expectedState Expected visualization state
       * @example
       * cy.validateVisualization('#network-graph', { visible: true, interactive: true })
       */
      validateVisualization(
        selector: string, 
        expectedState: { 
          visible: boolean; 
          interactive: boolean 
        }
      ): Chainable<void>;

      /**
       * Custom command to mock graph database query responses
       * @param query Graph query string
       * @param response Mock response data
       * @example
       * cy.mockGraphQuery('MATCH (n:Member) RETURN n', { nodes: [] })
       */
      mockGraphQuery(
        query: string, 
        response: any
      ): Chainable<void>;
    }
  }
}

// Export empty object to make file a module
export {};