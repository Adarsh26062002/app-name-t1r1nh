/**
 * validators.ts
 * Provides comprehensive validation utilities for test-related data structures.
 * Implements validation rules based on database schema design and system requirements.
 * 
 * Implements requirements:
 * 1. Data Validation (system_architecture/component_configuration)
 * 2. Test Data Storage Validation (system_design/database_design/test_data_storage)
 */

import { 
    BAD_REQUEST, 
    VALIDATION_ERROR 
} from '../constants/errors';
import { 
    ITestData, 
    ITestFlow, 
    ITestResult,
    TestFlowStatus,
    TestResultStatus 
} from '../types/test.types';

// Validation error class for specific validation failures
class ValidationError extends Error {
    constructor(message: string, public code: string = VALIDATION_ERROR) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * UUID validation regex pattern
 * Validates UUID v4 format
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Name validation regex pattern
 * Allows alphanumeric characters, spaces, hyphens, and underscores
 * Length: 3-100 characters
 */
const NAME_PATTERN = /^[a-zA-Z0-9\s\-_]{3,100}$/;

/**
 * Validates if a string is a valid UUID
 */
const isValidUUID = (uuid: string): boolean => {
    return UUID_PATTERN.test(uuid);
};

/**
 * Validates if a string is a valid name
 */
const isValidName = (name: string): boolean => {
    return NAME_PATTERN.test(name);
};

/**
 * Validates if a timestamp is valid and not in the past
 */
const isValidTimestamp = (timestamp: Date): boolean => {
    const now = new Date();
    return timestamp instanceof Date && !isNaN(timestamp.getTime()) && timestamp >= now;
};

/**
 * Validates if an object is valid JSON
 */
const isValidJSON = (obj: any): boolean => {
    try {
        JSON.stringify(obj);
        return true;
    } catch {
        return false;
    }
};

/**
 * Validates the structure and content of test data entities
 * Implements validation rules from system_design/database_design/test_data_storage
 */
export const validateTestData = (testData: ITestData): boolean => {
    // Validate required fields presence
    if (!testData.id || !testData.name || !testData.scope || !testData.schema) {
        throw new ValidationError(
            'Missing required fields in test data',
            BAD_REQUEST
        );
    }

    // Validate UUID format
    if (!isValidUUID(testData.id)) {
        throw new ValidationError(
            'Invalid UUID format for test data id',
            BAD_REQUEST
        );
    }

    // Validate name format
    if (!isValidName(testData.name)) {
        throw new ValidationError(
            'Invalid test data name format. Name must be 3-100 characters and contain only alphanumeric characters, spaces, hyphens, and underscores',
            BAD_REQUEST
        );
    }

    // Validate scope
    const validScopes = ['unit', 'integration', 'e2e', 'performance'];
    if (!validScopes.includes(testData.scope)) {
        throw new ValidationError(
            `Invalid test data scope. Must be one of: ${validScopes.join(', ')}`,
            BAD_REQUEST
        );
    }

    // Validate schema
    if (!isValidJSON(testData.schema)) {
        throw new ValidationError(
            'Invalid JSON schema format',
            BAD_REQUEST
        );
    }

    // Validate timestamps
    if (!testData.valid_from || !testData.valid_to) {
        throw new ValidationError(
            'Missing validity timestamps',
            BAD_REQUEST
        );
    }

    if (testData.valid_to <= testData.valid_from) {
        throw new ValidationError(
            'valid_to must be after valid_from',
            BAD_REQUEST
        );
    }

    return true;
};

/**
 * Validates the structure and configuration of test flow entities
 * Implements validation rules for test flow configuration and status
 */
export const validateTestFlow = (testFlow: ITestFlow): boolean => {
    // Validate required fields presence
    if (!testFlow.id || !testFlow.name || !testFlow.flow_type || 
        !testFlow.config || !testFlow.test_data_id || !testFlow.status) {
        throw new ValidationError(
            'Missing required fields in test flow',
            BAD_REQUEST
        );
    }

    // Validate UUIDs
    if (!isValidUUID(testFlow.id) || !isValidUUID(testFlow.test_data_id)) {
        throw new ValidationError(
            'Invalid UUID format for test flow id or test_data_id',
            BAD_REQUEST
        );
    }

    // Validate name format
    if (!isValidName(testFlow.name)) {
        throw new ValidationError(
            'Invalid test flow name format',
            BAD_REQUEST
        );
    }

    // Validate flow type
    const validFlowTypes = ['api', 'database', 'integration', 'performance'];
    if (!validFlowTypes.includes(testFlow.flow_type)) {
        throw new ValidationError(
            `Invalid flow type. Must be one of: ${validFlowTypes.join(', ')}`,
            BAD_REQUEST
        );
    }

    // Validate config structure
    if (!testFlow.config.steps || !Array.isArray(testFlow.config.steps) || 
        !testFlow.config.parameters || !testFlow.config.environment) {
        throw new ValidationError(
            'Invalid test flow configuration structure',
            BAD_REQUEST
        );
    }

    // Validate status
    if (!Object.values(TestFlowStatus).includes(testFlow.status)) {
        throw new ValidationError(
            `Invalid test flow status. Must be one of: ${Object.values(TestFlowStatus).join(', ')}`,
            BAD_REQUEST
        );
    }

    // Validate config steps
    testFlow.config.steps.forEach((step, index) => {
        if (!step.name || !step.type || !step.action) {
            throw new ValidationError(
                `Invalid step configuration at index ${index}`,
                BAD_REQUEST
            );
        }
    });

    return true;
};

/**
 * Validates the structure and content of test result entities
 * Implements validation rules for test results and their status
 */
export const validateTestResult = (testResult: ITestResult): boolean => {
    // Validate required fields presence
    if (!testResult.id || !testResult.flow_id || 
        !testResult.status || testResult.duration_ms === undefined) {
        throw new ValidationError(
            'Missing required fields in test result',
            BAD_REQUEST
        );
    }

    // Validate UUIDs
    if (!isValidUUID(testResult.id) || !isValidUUID(testResult.flow_id)) {
        throw new ValidationError(
            'Invalid UUID format for test result id or flow_id',
            BAD_REQUEST
        );
    }

    // Validate status
    if (!Object.values(TestResultStatus).includes(testResult.status)) {
        throw new ValidationError(
            `Invalid test result status. Must be one of: ${Object.values(TestResultStatus).join(', ')}`,
            BAD_REQUEST
        );
    }

    // Validate duration
    if (typeof testResult.duration_ms !== 'number' || testResult.duration_ms < 0) {
        throw new ValidationError(
            'Duration must be a positive number',
            BAD_REQUEST
        );
    }

    // Validate error field if present
    if (testResult.error !== null && !isValidJSON(testResult.error)) {
        throw new ValidationError(
            'Invalid error field format. Must be valid JSON or null',
            BAD_REQUEST
        );
    }

    return true;
};