/**
 * errors.ts
 * Defines comprehensive error codes, messages, and types used throughout the backend system
 * to ensure consistent error handling and reporting across all components.
 * 
 * This implements the following requirements:
 * 1. Standardized Error Handling - system_architecture/component_configuration
 * 2. Error Handling Matrix - appendices.a.2_error_handling_matrix
 */

/**
 * Standard HTTP error codes used across the system
 * These codes align with standard HTTP status codes for consistent API responses
 */
export const ERROR_CODES = {
    NOT_FOUND: '404',
    UNAUTHORIZED: '401',
    FORBIDDEN: '403',
    INTERNAL_SERVER_ERROR: '500',
    BAD_REQUEST: '400',
    CONFLICT: '409',
    SERVICE_UNAVAILABLE: '503',
    GATEWAY_TIMEOUT: '504',
    VALIDATION_ERROR: '422',
    TOO_MANY_REQUESTS: '429'
} as const;

/**
 * Standard error messages corresponding to error codes
 * These provide consistent user-facing error messages across the system
 */
export const ERROR_MESSAGES = {
    NOT_FOUND: 'The requested resource was not found',
    UNAUTHORIZED: 'Authentication is required to access this resource',
    FORBIDDEN: 'You do not have permission to access this resource',
    INTERNAL_SERVER_ERROR: 'An internal server error occurred',
    BAD_REQUEST: 'The request was invalid or malformed',
    CONFLICT: 'The request conflicts with the current state',
    SERVICE_UNAVAILABLE: 'The service is temporarily unavailable',
    GATEWAY_TIMEOUT: 'The upstream service timed out',
    VALIDATION_ERROR: 'The provided data failed validation',
    TOO_MANY_REQUESTS: 'Request limit exceeded, please try again later'
} as const;

/**
 * System-specific error types for internal error handling
 * These types are used to categorize errors and determine appropriate retry strategies
 * Based on the Error Handling Matrix from technical specifications
 */
export const ERROR_TYPES = {
    API_TIMEOUT: 'API_TIMEOUT',
    DB_CONNECTION: 'DB_CONNECTION',
    DATA_VALIDATION: 'DATA_VALIDATION',
    FLOW_EXECUTION: 'FLOW_EXECUTION',
    SCHEMA_MISMATCH: 'SCHEMA_MISMATCH'
} as const;

/**
 * Retry strategies for different error scenarios
 * Configured based on the Error Handling Matrix from technical specifications
 * Each strategy defines the number of attempts and delay/backoff mechanism
 */
export const RETRY_STRATEGIES = {
    API_TIMEOUT: {
        attempts: 3,
        backoff: 'exponential'
    },
    DB_CONNECTION: {
        attempts: 5,
        delay: 1000  // milliseconds
    },
    FLOW_EXECUTION: {
        attempts: 2,
        delay: 500   // milliseconds
    }
} as const;

// Type definitions for better TypeScript support
export type ErrorCode = keyof typeof ERROR_CODES;
export type ErrorMessage = keyof typeof ERROR_MESSAGES;
export type ErrorType = keyof typeof ERROR_TYPES;
export type RetryStrategy = keyof typeof RETRY_STRATEGIES;

// Ensure all error codes have corresponding messages
type ErrorCodesMatchMessages = Record<ErrorCode, string> extends typeof ERROR_MESSAGES ? true : never;
const _errorCodesMatchMessages: ErrorCodesMatchMessages = true;

// Type guard for error types
export const isErrorType = (value: string): value is ErrorType => {
    return Object.values(ERROR_TYPES).includes(value as ErrorType);
};

// Type guard for retry strategies
export const hasRetryStrategy = (errorType: ErrorType): boolean => {
    return errorType in RETRY_STRATEGIES;
};