/**
 * index.ts
 * Centralized entry point for all constants used throughout the backend system.
 * This file implements the following requirements:
 * 1. Centralized Constants Management - system_architecture/component_configuration
 * 2. Standardized Error Handling - appendices.a.2_error_handling_matrix
 */

// Import all constants from their respective modules
import {
    ERROR_CODES,
    ERROR_MESSAGES,
    ERROR_TYPES,
    RETRY_STRATEGIES,
    type ErrorCode,
    type ErrorMessage,
    type ErrorType,
    type RetryStrategy,
    isErrorType,
    hasRetryStrategy
} from './errors';

import {
    MESSAGES,
    type MessageKey,
    isValidMessageKey,
    getMessage
} from './messages';

import {
    CONFIG,
    type ApiConfig,
    type DatabaseConfig,
    type TestExecutionConfig,
    type ReportingConfig,
    type SystemConfig,
    isValidEnvironment
} from './config';

// Re-export all constants and types for centralized access
export {
    // Error-related exports
    ERROR_CODES,
    ERROR_MESSAGES,
    ERROR_TYPES,
    RETRY_STRATEGIES,
    type ErrorCode,
    type ErrorMessage,
    type ErrorType,
    type RetryStrategy,
    isErrorType,
    hasRetryStrategy,

    // Message-related exports
    MESSAGES,
    type MessageKey,
    isValidMessageKey,
    getMessage,

    // Configuration-related exports
    CONFIG,
    type ApiConfig,
    type DatabaseConfig,
    type TestExecutionConfig,
    type ReportingConfig,
    type SystemConfig,
    isValidEnvironment
};

// Type validation to ensure all required error codes are exported
type ValidateErrorCodes = keyof typeof ERROR_CODES extends
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'INTERNAL_SERVER_ERROR'
    | 'BAD_REQUEST'
    | 'CONFLICT'
    | 'SERVICE_UNAVAILABLE'
    | 'GATEWAY_TIMEOUT'
    | 'VALIDATION_ERROR'
    | 'TOO_MANY_REQUESTS'
    ? true
    : never;
const _validateErrorCodes: ValidateErrorCodes = true;

// Type validation to ensure all required error messages are exported
type ValidateErrorMessages = keyof typeof ERROR_MESSAGES extends
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'INTERNAL_SERVER_ERROR'
    | 'BAD_REQUEST'
    | 'CONFLICT'
    | 'SERVICE_UNAVAILABLE'
    ? true
    : never;
const _validateErrorMessages: ValidateErrorMessages = true;

// Type validation to ensure all required error types are exported
type ValidateErrorTypes = keyof typeof ERROR_TYPES extends
    | 'API_TIMEOUT'
    | 'DB_CONNECTION'
    | 'DATA_VALIDATION'
    | 'FLOW_EXECUTION'
    | 'SCHEMA_MISMATCH'
    ? true
    : never;
const _validateErrorTypes: ValidateErrorTypes = true;

// Type validation to ensure all required retry strategies are exported
type ValidateRetryStrategies = keyof typeof RETRY_STRATEGIES extends
    | 'API_TIMEOUT'
    | 'DB_CONNECTION'
    | 'FLOW_EXECUTION'
    ? true
    : never;
const _validateRetryStrategies: ValidateRetryStrategies = true;

// Type validation to ensure all required messages are exported
type ValidateMessages = keyof typeof MESSAGES extends
    | 'SUCCESS'
    | 'FAILURE'
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'SERVER_ERROR'
    | 'TEST_FLOW_STARTED'
    | 'TEST_FLOW_COMPLETED'
    | 'TEST_FLOW_FAILED'
    ? true
    : never;
const _validateMessages: ValidateMessages = true;

// Type validation to ensure all required configuration parameters are exported
type ValidateConfig = typeof CONFIG extends {
    API: { TIMEOUT: number; RETRY_ATTEMPTS: number; LOG_LEVEL: string; };
    SYSTEM: { DEFAULT_LANGUAGE: string; };
} ? true : never;
const _validateConfig: ValidateConfig = true;

// Freeze all exported objects to prevent runtime modifications
Object.freeze(ERROR_CODES);
Object.freeze(ERROR_MESSAGES);
Object.freeze(ERROR_TYPES);
Object.freeze(RETRY_STRATEGIES);
Object.freeze(MESSAGES);
Object.freeze(CONFIG);