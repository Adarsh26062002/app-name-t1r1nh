/**
 * config.ts
 * Defines configuration parameters used throughout the backend system to ensure consistency
 * in application settings and behavior.
 * 
 * This implements the following requirements:
 * 1. Centralized Configuration Management - system_architecture/component_configuration
 * 2. REST Client Configuration - system_design.api_design.rest_client_configuration
 */

import { INTERNAL_SERVER_ERROR } from './errors';
import { SERVER_ERROR } from './messages';

/**
 * Global configuration object that defines all system-wide settings
 * These values are aligned with the technical specifications and component requirements
 */
export const CONFIG = {
    /**
     * API client configuration settings
     * Based on REST client configuration from technical specifications
     */
    API: {
        // Maximum time (in milliseconds) to wait for API responses
        TIMEOUT: 5000,
        
        // Number of retry attempts for failed API calls
        RETRY_ATTEMPTS: 3,
        
        // Backoff time (in milliseconds) between retry attempts
        RETRY_BACKOFF: 1000,
        
        // Maximum number of concurrent API requests
        MAX_CONCURRENT_REQUESTS: 10,
        
        // Default validation function for API response status
        validateStatus: (status: number): boolean => status >= 200 && status < 300,
        
        // Error handling configuration
        errors: {
            default: INTERNAL_SERVER_ERROR,
            message: SERVER_ERROR
        }
    },

    /**
     * Database connection configuration
     * Aligned with DatabaseClient configuration from component specifications
     */
    DATABASE: {
        // Maximum number of clients in the connection pool
        POOL_SIZE: 10,
        
        // Time (in milliseconds) that a client can remain idle before being removed
        IDLE_TIMEOUT: 10000,
        
        // Maximum time (in milliseconds) to wait for a connection
        CONNECTION_TIMEOUT: 5000,
        
        // Number of connection retry attempts
        RETRY_ATTEMPTS: 5
    },

    /**
     * Test execution configuration
     * Based on TestOrchestrator and FlowEngine specifications
     */
    TEST_EXECUTION: {
        // Maximum number of concurrent test executions
        MAX_CONCURRENCY: 10,
        
        // Maximum time (in seconds) for test execution
        TIMEOUT_SECONDS: 300,
        
        // Number of retry attempts for failed test executions
        RETRY_ATTEMPTS: 3,
        
        // Wait time (in milliseconds) between retries
        WAIT_TIME_MS: 1000
    },

    /**
     * Report generation configuration
     * Based on ReportGenerator specifications
     */
    REPORTING: {
        // Default output format for generated reports
        OUTPUT_FORMAT: 'HTML' as const,
        
        // Number of days to retain generated reports
        RETENTION_DAYS: 30
    },

    /**
     * System-wide configuration settings
     * General system parameters for consistent behavior
     */
    SYSTEM: {
        // Default logging level for the application
        LOG_LEVEL: 'info' as const,
        
        // Default language for system messages
        DEFAULT_LANGUAGE: 'en' as const,
        
        // Current environment (development/staging/production)
        ENVIRONMENT: 'development' as const
    }
} as const;

// Type definitions for better TypeScript support
export type ApiConfig = typeof CONFIG.API;
export type DatabaseConfig = typeof CONFIG.DATABASE;
export type TestExecutionConfig = typeof CONFIG.TEST_EXECUTION;
export type ReportingConfig = typeof CONFIG.REPORTING;
export type SystemConfig = typeof CONFIG.SYSTEM;

// Type guard to validate environment
export const isValidEnvironment = (env: string): env is SystemConfig['ENVIRONMENT'] => {
    return ['development', 'staging', 'production'].includes(env);
};

// Freeze configuration object to prevent runtime modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.DATABASE);
Object.freeze(CONFIG.TEST_EXECUTION);
Object.freeze(CONFIG.REPORTING);
Object.freeze(CONFIG.SYSTEM);