/**
 * jest.config.js
 * Configures Jest testing framework for the backend system, providing comprehensive test execution settings
 * including timeouts, retries, coverage reporting, and test environment configuration.
 * 
 * This implements the following requirements:
 * 1. Core Testing Components - system_architecture/core_testing_components
 * 
 * @version jest: 27.0.6
 */

// Import test configuration parameters
const { 
    apiTimeout, 
    retryAttempts, 
    logLevel, 
    timeoutSeconds, 
    outputFormat 
} = require('./src/config/test.config');

const { logInfo, logError } = require('./src/utils/logger');

/**
 * Initialize Jest configuration with test parameters and environment settings
 */
const initializeJestConfig = () => {
    try {
        logInfo('Initializing Jest configuration', { 
            timeout: apiTimeout,
            retries: retryAttempts,
            logLevel
        });

        return {
            // Enable verbose output for detailed test information
            verbose: true,

            // Configure test timeout using the API timeout from test config
            testTimeout: apiTimeout,

            // Set maximum retry attempts for failed tests
            maxRetries: retryAttempts,

            // Configure logging level
            logLevel: logLevel,

            // Set Node.js as the test environment
            testEnvironment: 'node',

            // Define test file locations
            roots: ['<rootDir>/src'],

            // Configure test file patterns
            testMatch: [
                '**/__tests__/**/*.ts',
                '**/?(*.)+(spec|test).ts'
            ],

            // Configure TypeScript transformation
            transform: {
                '^.+\\.ts$': 'ts-jest'
            },

            // Enable code coverage collection
            collectCoverage: true,
            coverageDirectory: 'coverage',
            coverageReporters: [
                'json',
                'lcov',
                'text',
                'clover'
            ],

            // Set coverage thresholds
            coverageThreshold: {
                global: {
                    branches: 80,
                    functions: 80,
                    lines: 80,
                    statements: 80
                }
            },

            // Configure file extensions to be processed
            moduleFileExtensions: [
                'ts',
                'js',
                'json',
                'node'
            ],

            // Configure test setup and teardown files
            setupFilesAfterEnv: [
                '<rootDir>/src/test/setup.ts'
            ],
            globalSetup: '<rootDir>/src/test/globalSetup.ts',
            globalTeardown: '<rootDir>/src/test/globalTeardown.ts',

            // Configure test results processor
            testResultsProcessor: '<rootDir>/src/test/resultProcessor.ts'
        };
    } catch (error) {
        logError('Failed to initialize Jest configuration', error);
        throw error;
    }
};

// Initialize and export the Jest configuration
const jestConfig = initializeJestConfig();

// Prevent modifications to the configuration object
Object.freeze(jestConfig);

module.exports = jestConfig;