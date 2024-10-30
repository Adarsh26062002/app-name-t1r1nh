/**
 * error.middleware.ts
 * Implements error handling middleware for the backend API, providing standardized error responses
 * and logging based on the error handling matrix.
 * 
 * This implements the following requirements:
 * 1. Error Handling Middleware - system_architecture/api_integration_layer
 * 2. Error Handling Matrix Implementation - appendices.a.2_error_handling_matrix
 * 
 * @version express: 4.17.1
 */

import { Request, Response, NextFunction } from 'express';
import { logError } from '../../utils/logger';
import { 
    ERROR_CODES, 
    ERROR_TYPES,
    RETRY_STRATEGIES,
    isErrorType 
} from '../../constants/errors';
import { MESSAGES } from '../../constants/messages';

/**
 * Interface for structured error response
 */
interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        type?: string;
        details?: unknown;
    };
}

/**
 * Custom error class for API errors with type information
 */
class APIError extends Error {
    constructor(
        public message: string,
        public statusCode: number = 500,
        public type: string = ERROR_TYPES.API_TIMEOUT,
        public details?: unknown
    ) {
        super(message);
        this.name = 'APIError';
    }
}

/**
 * Maps error types to HTTP status codes
 */
const errorTypeToStatusCode: Record<string, number> = {
    [ERROR_TYPES.API_TIMEOUT]: 504,
    [ERROR_TYPES.DB_CONNECTION]: 503,
    [ERROR_TYPES.DATA_VALIDATION]: 422,
    [ERROR_TYPES.FLOW_EXECUTION]: 500,
    [ERROR_TYPES.SCHEMA_MISMATCH]: 400
};

/**
 * Determines if an error should trigger a retry based on the error handling matrix
 */
const shouldRetry = (errorType: string): boolean => {
    return errorType in RETRY_STRATEGIES;
};

/**
 * Sanitizes error messages for production environment
 */
const sanitizeErrorMessage = (error: Error, isProd: boolean = process.env.NODE_ENV === 'production'): string => {
    if (isProd) {
        // In production, return generic messages for 500 errors
        if (error instanceof APIError && error.statusCode >= 500) {
            return MESSAGES.SERVER_ERROR;
        }
        // For validation errors, keep the specific message
        if (error instanceof APIError && error.type === ERROR_TYPES.DATA_VALIDATION) {
            return error.message;
        }
        return MESSAGES.FAILURE;
    }
    return error.message;
};

/**
 * Express middleware for handling errors according to the error handling matrix
 */
const errorHandler = (
    err: Error | APIError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Default error values
    let statusCode = 500;
    let errorType = ERROR_TYPES.API_TIMEOUT;
    let errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR;
    let errorMessage = err.message || MESSAGES.SERVER_ERROR;

    // Determine error type and status code
    if (err instanceof APIError) {
        statusCode = err.statusCode;
        errorType = err.type;
        errorMessage = err.message;
    } else if (err.name === 'ValidationError') {
        statusCode = 422;
        errorType = ERROR_TYPES.DATA_VALIDATION;
        errorCode = ERROR_CODES.VALIDATION_ERROR;
        errorMessage = MESSAGES.VALIDATION_FAILURE;
    } else if (err.name === 'DatabaseError') {
        statusCode = 503;
        errorType = ERROR_TYPES.DB_CONNECTION;
        errorCode = ERROR_CODES.SERVICE_UNAVAILABLE;
    }

    // Log error with appropriate metadata
    logError(errorMessage, err, {
        errorType,
        statusCode,
        path: req.path,
        method: req.method,
        correlationId: req.headers['x-correlation-id'] as string,
        shouldRetry: shouldRetry(errorType),
        retryStrategy: RETRY_STRATEGIES[errorType as keyof typeof RETRY_STRATEGIES]
    });

    // Prepare error response
    const errorResponse: ErrorResponse = {
        success: false,
        error: {
            code: errorCode,
            message: sanitizeErrorMessage(err),
            type: isErrorType(errorType) ? errorType : undefined
        }
    };

    // Include error details in development
    if (process.env.NODE_ENV !== 'production') {
        errorResponse.error.details = {
            stack: err.stack,
            ...(err instanceof APIError ? { additionalDetails: err.details } : {})
        };
    }

    // Send response
    res.status(statusCode).json(errorResponse);
};

export default errorHandler;