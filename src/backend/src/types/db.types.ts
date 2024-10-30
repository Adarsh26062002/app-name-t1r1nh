/**
 * db.types.ts
 * Defines TypeScript types and interfaces for database entities used within the testing framework.
 * Implements requirements from:
 * - Database Integration Layer (system_architecture/database_integration_layer)
 * - Test Data Storage (system_design/database_design/test_data_storage)
 */

// Import only the required id property from models as specified in the JSON specification
import { id as TestDataId } from '../db/models/testData.model';
import { id as TestFlowId } from '../db/models/testFlow.model';
import { id as TestResultId } from '../db/models/testResult.model';

/**
 * Enum defining possible test flow status values
 * Implements test flow state management requirements
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
 * Implements test result state tracking requirements
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
 * Implements the test data storage schema requirements
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
 * Implements the test flow storage schema requirements
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
 * Implements the test result storage schema requirements
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
 * Implements the test flow configuration schema requirements
 */
export interface ITestFlowConfig {
    steps: Array<{
        name: string;
        type: string;
        action: string;
        input?: any;
        expected?: any;
        timeout?: number;
    }>;
    parameters: {
        [key: string]: any;
    };
    environment: {
        name: string;
        variables: { [key: string]: string };
    };
    timeout: number;
    retries: number;
}