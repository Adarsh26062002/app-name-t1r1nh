/**
 * errors.ts
 * Implements comprehensive error handling utilities for the backend system with standardized
 * error handling, retry strategies, logging, and appropriate error responses.
 * 
 * @version axios: 1.3.4 - For HTTP status code types
 */

import { 
    ERROR_CODES, 
    ERROR_MESSAGES, 
    ERROR_TYPES, 
    RETRY_STRATEGIES,
    type ErrorType 
} from '../constants/errors';
import { logError } from '../utils/logger';
import { Response } from 'express';

// Global configuration for error handling
const errorHandlerConfig = {
    logErrors: true,
    sendErrorResponses: true,
    includeStackTrace: process.env.NODE_ENV !== 'production',
    retryEnabled: true
};

/**
 * Interface for error handling options
 */
interface ErrorHandlingOptions {
    skipRetry?: boolean;
    context?: Record<string, any>;
    correlationId?: string;
}

/**
 * Interface for formatted error response
 */
interface ErrorResponse {
    code: string;
    message: string;
    type?: string;
    stack?: string;
    context?: Record<string, any>;
    timestamp: string;
}

/**
 * Maps error types to appropriate HTTP status codes
 * Implements requirement: Standardized Error Handling
 * 
 * @param error - The error object to analyze
 * @returns The appropriate HTTP status code
 */
export const getErrorCode = (error: Error & { type?: string; status?: string }): string => {
    // Check if error has explicit status code
    if (error.status) {
        return error.status;
    }

    // Map error types to status codes based on error handling matrix
    switch (error.type) {
        case ERROR_TYPES.API_TIMEOUT:
            return ERROR_CODES.GATEWAY_TIMEOUT;
        case ERROR_TYPES.DB_CONNECTION:
            return ERROR_CODES.SERVICE_UNAVAILABLE;
        case ERROR_TYPES.DATA_VALIDATION:
            return ERROR_CODES.VALIDATION_ERROR;
        case ERROR_TYPES.SCHEMA_MISMATCH:
            return ERROR_CODES.BAD_REQUEST;
        case ERROR_TYPES.FLOW_EXECUTION:
            return ERROR_CODES.INTERNAL_SERVER_ERROR;
        default:
            return ERROR_CODES.INTERNAL_SERVER_ERROR;
    }
};

/**
 * Formats error response object based on error type and configuration
 * Implements requirement: Error Handling Matrix
 * 
 * @param error - The error object to format
 * @param errorCode - The HTTP status code
 * @returns Formatted error response object
 */
export const formatErrorResponse = (error: Error & { type?: string }, errorCode: string): ErrorResponse => {
    const response: ErrorResponse = {
        code: errorCode,
        message: ERROR_MESSAGES[errorCode as keyof typeof ERROR_MESSAGES] || error.message,
        timestamp: new Date().toISOString()
    };

    // Include error type if available
    if (error.type) {
        response.type = error.type;
    }

    // Include stack trace in non-production environments if enabled
    if (errorHandlerConfig.includeStackTrace && error.stack) {
        response.stack = error.stack;
    }

    return response;
};

/**
 * Implements retry mechanism based on error type and strategy
 * Implements requirement: Error Handling Matrix - Retry Strategy
 * 
 * @param errorType - Type of error to determine retry strategy
 * @param operation - Async operation to retry
 * @returns Promise resolving to operation result or throwing final error
 */
async function retryOperation<T>(
    errorType: ErrorType,
    operation: () => Promise<T>
): Promise<T> {
    const strategy = RETRY_STRATEGIES[errorType];
    if (!strategy) {
        return operation();
    }

    let lastError: Error;
    for (let attempt = 1; attempt <= strategy.attempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;
            if (attempt < strategy.attempts) {
                const delay = strategy.backoff === 'exponential'
                    ? Math.pow(2, attempt) * 1000
                    : strategy.delay;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError!;
}

/**
 * Main error handling function that coordinates logging, retries, and response formatting
 * Implements requirements: Standardized Error Handling, Error Handling Matrix
 * 
 * @param error - The error object to handle
 * @param res - Express response object
 * @param options - Additional error handling options
 */
export const handleError = async (
    error: Error & { type?: string },
    res: Response,
    options: ErrorHandlingOptions = {}
): Promise<void> => {
    const errorType = error.type as ErrorType;
    const { skipRetry = false, context = {}, correlationId } = options;

    try {
        // Attempt retry if enabled and applicable
        if (
            errorHandlerConfig.retryEnabled &&
            !skipRetry &&
            errorType &&
            errorType in RETRY_STRATEGIES
        ) {
            await retryOperation(errorType, async () => {
                throw error; // Re-throw to trigger retry
            });
        }
    } catch (retryError) {
        // If retry fails or is skipped, proceed with error handling
        const errorCode = getErrorCode(error);

        // Log error if enabled
        if (errorHandlerConfig.logErrors) {
            logError('Error occurred during request processing', error, {
                errorCode,
                errorType,
                correlationId,
                context
            });
        }

        // Send error response if enabled
        if (errorHandlerConfig.sendErrorResponses && res && !res.headersSent) {
            const errorResponse = formatErrorResponse(error, errorCode);
            if (context) {
                errorResponse.context = context;
            }
            res.status(parseInt(errorCode)).json(errorResponse);
        }
    }
};