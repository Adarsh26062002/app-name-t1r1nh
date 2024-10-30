/**
 * test.types.ts
 * Defines TypeScript types and interfaces for test-related entities within the testing framework.
 * Implements requirements from:
 * - Test Type Definitions (system_architecture/core_components)
 * - Test Data Storage Types (system_design/database_design/test_data_storage)
 * - Test Results Storage Types (system_design/database_design/results_storage)
 */

// Import required types from db.types.ts
import {
    ITestData,
    ITestFlow,
    ITestResult,
    TestFlowStatus,
    TestResultStatus
} from './db.types';

/**
 * Enum defining possible test flow status values
 * Maps to database TestFlowStatus enum
 */
export enum TestFlowStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

/**
 * Enum defining possible test result status values
 * Maps to database TestResultStatus enum
 */
export enum TestResultStatus {
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILURE = 'failure',
    ERROR = 'error',
    SKIPPED = 'skipped',
    TIMEOUT = 'timeout'
}

/**
 * Interface defining the structure of a test data entity
 * Implements test data storage schema requirements
 */
export interface ITestData {
    id: string;
    name: string;
    scope: string;
    schema: Record<string, any>;
    valid_from: Date;
    valid_to: Date;
    created_at: Date;
    updated_at: Date;
}

/**
 * Interface defining the structure of a test flow entity
 * Implements test flow storage schema requirements
 */
export interface ITestFlow {
    id: string;
    name: string;
    description: string;
    flow_type: string;
    config: ITestFlowConfig;
    test_data_id: string;
    status: TestFlowStatus;
    created_at: Date;
    updated_at: Date;
}

/**
 * Interface defining the structure of a test result entity
 * Implements test result storage schema requirements
 */
export interface ITestResult {
    id: string;
    flow_id: string;
    status: TestResultStatus;
    duration_ms: number;
    error: Record<string, any> | null;
    created_at: Date;
    updated_at: Date;
}

/**
 * Interface defining the structure of test flow configuration
 * Implements test flow configuration requirements
 */
export interface ITestFlowConfig {
    // Array of test steps to be executed in sequence
    steps: Array<{
        name: string;           // Step name for identification
        type: string;           // Step type (e.g., 'api', 'db', 'validation')
        action: string;         // Action to perform
        input?: any;           // Optional input data
        expected?: any;        // Optional expected result
        timeout?: number;      // Optional step-specific timeout
    }>;
    
    // Test parameters that can be used across steps
    parameters: {
        [key: string]: any;
    };
    
    // Environment configuration for the test flow
    environment: {
        name: string;                      // Environment name (e.g., 'dev', 'staging')
        variables: { [key: string]: string }; // Environment variables
    };
    
    // Global timeout for the entire flow in milliseconds
    timeout: number;
    
    // Number of retry attempts for failed steps
    retries: number;
}