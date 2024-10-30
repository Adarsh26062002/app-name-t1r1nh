/**
 * test.config.ts
 * Configures testing parameters for the backend system, ensuring consistent test execution,
 * reporting, and resource management across all test components.
 * 
 * This implements the following requirements:
 * 1. Test Configuration Management - system_architecture/component_configuration
 * 2. Test Execution Parameters - system_architecture/component_configuration
 */

// Import version: @types/node@16.x
import { 
    API, 
    TEST_EXECUTION, 
    SYSTEM 
} from '../constants/config';
import { logInfo, logError } from '../utils/logger';

/**
 * Interface defining the structure of test configuration parameters
 * Based on component configuration specifications from technical documentation
 */
interface TestConfig {
    // API client configuration
    apiTimeout: number;
    
    // Test execution parameters
    retryAttempts: number;
    waitTimeMs: number;
    maxConcurrency: number;
    timeoutSeconds: number;
    
    // System and reporting configuration
    logLevel: string;
    outputFormat: string;
    retentionDays: number;
}

/**
 * Validates the test configuration parameters against acceptable ranges
 * @param config - The test configuration object to validate
 * @returns boolean indicating if the configuration is valid
 */
const validateTestConfig = (config: TestConfig): boolean => {
    try {
        // Validate API timeout (must be between 1000ms and 30000ms)
        if (config.apiTimeout < 1000 || config.apiTimeout > 30000) {
            throw new Error('API timeout must be between 1000ms and 30000ms');
        }

        // Validate retry attempts (must be between 1 and 10)
        if (config.retryAttempts < 1 || config.retryAttempts > 10) {
            throw new Error('Retry attempts must be between 1 and 10');
        }

        // Validate wait time (must be between 100ms and 10000ms)
        if (config.waitTimeMs < 100 || config.waitTimeMs > 10000) {
            throw new Error('Wait time must be between 100ms and 10000ms');
        }

        // Validate max concurrency (must be between 1 and 50)
        if (config.maxConcurrency < 1 || config.maxConcurrency > 50) {
            throw new Error('Max concurrency must be between 1 and 50');
        }

        // Validate timeout seconds (must be between 60 and 3600)
        if (config.timeoutSeconds < 60 || config.timeoutSeconds > 3600) {
            throw new Error('Timeout seconds must be between 60 and 3600');
        }

        // Validate log level
        const validLogLevels = ['error', 'warn', 'info', 'debug'];
        if (!validLogLevels.includes(config.logLevel)) {
            throw new Error('Invalid log level specified');
        }

        // Validate output format
        const validFormats = ['HTML', 'JSON', 'XML'];
        if (!validFormats.includes(config.outputFormat)) {
            throw new Error('Invalid output format specified');
        }

        // Validate retention days (must be between 1 and 365)
        if (config.retentionDays < 1 || config.retentionDays > 365) {
            throw new Error('Retention days must be between 1 and 365');
        }

        logInfo('Test configuration validation successful', { config });
        return true;
    } catch (error) {
        logError('Test configuration validation failed', error as Error, { config });
        return false;
    }
};

/**
 * Test configuration object with default values from system constants
 * Implements the Test Configuration Management requirement
 */
export const testConfig: TestConfig = {
    // API timeout from API configuration or default to 5000ms
    apiTimeout: API.TIMEOUT || 5000,

    // Test execution parameters from TEST_EXECUTION configuration
    retryAttempts: TEST_EXECUTION.RETRY_ATTEMPTS || 3,
    waitTimeMs: TEST_EXECUTION.WAIT_TIME_MS || 1000,
    maxConcurrency: TEST_EXECUTION.MAX_CONCURRENCY || 10,
    timeoutSeconds: TEST_EXECUTION.TIMEOUT_SECONDS || 300,

    // System and reporting configuration
    logLevel: SYSTEM.LOG_LEVEL || 'info',
    outputFormat: 'HTML',
    retentionDays: 30
};

// Validate the configuration on initialization
if (!validateTestConfig(testConfig)) {
    throw new Error('Invalid test configuration detected');
}

// Freeze the configuration object to prevent runtime modifications
Object.freeze(testConfig);