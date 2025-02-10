/**
 * Jest configuration for Community Management Platform
 * Implements comprehensive test environment settings with security and performance monitoring
 * @version 1.0.0
 */

// External dependencies
// jest@29.0.0 - Testing framework configuration
// ts-jest@29.0.0 - TypeScript support for Jest

import type { Config } from '@jest/types';

/**
 * Creates comprehensive Jest configuration with security and performance optimizations
 */
const createJestConfig = (): Config.InitialOptions => ({
  // TypeScript configuration
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Root directories for test discovery
  roots: ['<rootDir>'],
  modulePaths: ['<rootDir>'],

  // Module resolution paths with security boundaries
  moduleNameMapper: {
    // Test utilities and helpers
    '@test/(.*)': '<rootDir>/utils/$1',
    // Test fixtures with data classification
    '@fixtures/(.*)': '<rootDir>/cypress/fixtures/$1',
    // Performance test configurations
    '@performance/(.*)': '<rootDir>/performance/$1',
    // Security test configurations
    '@security/(.*)': '<rootDir>/security/$1',
    // Mock services and data
    '@mocks/(.*)': '<rootDir>/mocks/$1',
    // Integration test configurations
    '@integration/(.*)': '<rootDir>/integration/$1'
  },

  // Test pattern matching with security and performance tests
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec|security|perf))\\.[jt]sx?$',

  // TypeScript transformation with strict type checking
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true,
      diagnostics: {
        warnOnly: false
      }
    }]
  },

  // Coverage collection with security-aware patterns
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.d.ts',
    '!**/vendor/**',
    '!**/__mocks__/**'
  ],

  // Coverage reporting configuration
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'clover',
    'cobertura'
  ],

  // Global test setup and teardown
  setupFilesAfterEnv: [
    '<rootDir>/setup/global-setup.ts',
    '<rootDir>/setup/security-setup.ts'
  ],
  globalSetup: '<rootDir>/setup/global-setup.ts',
  globalTeardown: '<rootDir>/setup/global-teardown.ts',

  // Performance monitoring settings
  testTimeout: 30000, // 30 seconds max per test
  maxWorkers: '50%', // Optimize CPU usage

  // Verbose output for detailed test results
  verbose: true,

  // Security-aware test path ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/cypress/',
    '/vendor/',
    '/.git/'
  ],

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Test environment options with performance settings
  testEnvironmentOptions: {
    url: 'http://localhost',
    testTimeout: 30000,
    maxWorkers: '50%'
  },

  // Watch plugins for development
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Test reporters with JUnit output
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'reports/junit',
      outputName: 'jest-junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
});

// Export configuration
export default createJestConfig();