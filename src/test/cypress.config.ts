// External dependencies
import { defineConfig } from 'cypress'; // cypress@12.0.0

// Internal imports
import { setupTestEnvironment, teardownTestEnvironment } from './setup/test-environment';

// Global constants
const CYPRESS_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const PERFORMANCE_THRESHOLDS = {
  requestDuration: 2000, // 2 seconds max response time
  renderingTime: 1000,  // 1 second max render time
  loadingTime: 3000     // 3 seconds max page load
};

// Browser configurations with security settings
const BROWSER_CONFIGS = {
  chrome: {
    name: 'chrome',
    family: 'chromium',
    channel: 'stable',
    displayName: 'Chrome',
    version: '90.0.0',
    preferences: {
      'security.enterprise_roots.enabled': true
    }
  },
  firefox: {
    name: 'firefox',
    family: 'firefox',
    channel: 'stable',
    displayName: 'Firefox',
    version: '88.0.0',
    preferences: {
      'security.tls.version.min': 3
    }
  },
  edge: {
    name: 'edge',
    family: 'chromium',
    channel: 'stable',
    displayName: 'Edge',
    version: '90.0.0',
    preferences: {
      'security.enterprise_roots.enabled': true
    }
  }
};

export default defineConfig({
  e2e: {
    baseUrl: CYPRESS_BASE_URL,
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    video: false,
    screenshotOnRunFailure: true,
    trashAssetsBeforeRuns: true,
    retries: {
      runMode: 2,
      openMode: 0
    },
    env: {
      apiUrl: 'http://localhost:4000',
      coverage: false,
      codeCoverage: {
        url: 'http://localhost:4000/__coverage__'
      },
      performanceThreshold: PERFORMANCE_THRESHOLDS,
      securityValidation: {
        enabled: true,
        sslVerification: true,
        contentSecurityPolicy: true
      }
    },
    browsers: [
      BROWSER_CONFIGS.chrome,
      BROWSER_CONFIGS.firefox,
      BROWSER_CONFIGS.edge
    ],
    async setupNodeEvents(on, config) {
      // Initialize test environment with security validation
      await setupTestEnvironment();

      // Register performance monitoring commands
      on('task', {
        async validatePerformance({ name, duration }) {
          const threshold = PERFORMANCE_THRESHOLDS[name];
          if (duration > threshold) {
            throw new Error(`Performance threshold exceeded for ${name}: ${duration}ms (threshold: ${threshold}ms)`);
          }
          return null;
        }
      });

      // Register security validation commands
      on('task', {
        async validateSecurity({ url, options }) {
          // Validate SSL certificates
          if (options.sslVerification) {
            // SSL verification logic would go here
          }

          // Validate Content Security Policy
          if (options.contentSecurityPolicy) {
            // CSP validation logic would go here
          }

          return null;
        }
      });

      // Register browser compatibility checks
      on('before:browser:launch', (browser, launchOptions) => {
        const browserConfig = BROWSER_CONFIGS[browser.name];
        if (browserConfig) {
          // Apply security preferences
          launchOptions.preferences = {
            ...launchOptions.preferences,
            ...browserConfig.preferences
          };
        }
        return launchOptions;
      });

      // Register cleanup hooks
      on('after:run', async () => {
        await teardownTestEnvironment();
      });

      // Return enhanced configuration
      return {
        ...config,
        baseUrl: CYPRESS_BASE_URL,
        env: {
          ...config.env,
          performanceThreshold: PERFORMANCE_THRESHOLDS
        }
      };
    }
  }
});