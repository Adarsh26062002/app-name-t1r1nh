/**
 * formatters.ts
 * Provides utility functions for formatting data, messages, and responses consistently
 * across the backend system, ensuring standardized communication in logs, API responses,
 * and internal messaging.
 * 
 * This implements the following requirements:
 * 1. Data Formatting - system_architecture/component_responsibilities
 * 2. API Response Standards - system_design.api_design.api_endpoints
 */

import { 
    SUCCESS,
    FAILURE,
    TEST_FLOW_STARTED,
    TEST_FLOW_COMPLETED 
} from '../constants/messages';

import {
    INTERNAL_SERVER_ERROR,
    BAD_REQUEST,
    NOT_FOUND
} from '../constants/errors';

// Types for response objects
interface SuccessResponse {
    status: 'success';
    message: string;
    data?: unknown;
    timestamp: string;
}

interface ErrorResponse {
    status: 'error';
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
}

interface TestFlowMessage {
    flowId: string;
    status: string;
    message: string;
    timestamp: string;
    executionDetails?: unknown;
}

/**
 * Formats a success message with a standard structure for consistent API responses and logging.
 * Implements requirement: API Response Standards
 * 
 * @param message - Custom success message to be included in the response
 * @param data - Optional data payload to be included in the response
 * @returns Formatted success response object with message and data
 */
export const formatSuccessMessage = (
    message: string,
    data?: unknown
): SuccessResponse => {
    // Input validation
    if (!message || typeof message !== 'string') {
        throw new Error('Message is required and must be a string');
    }

    // Create standardized success response
    const response: SuccessResponse = {
        status: 'success',
        message: `${SUCCESS}: ${message}`,
        timestamp: new Date().toISOString()
    };

    // Add optional data if provided
    if (data !== undefined) {
        response.data = data;
    }

    return response;
};

/**
 * Formats an error message with a standard structure for consistent error handling across the system.
 * Implements requirement: API Response Standards
 * 
 * @param message - Error message describing what went wrong
 * @param errorCode - Standard error code from ERROR_CODES constant
 * @param details - Optional additional error details or context
 * @returns Formatted error response object with error code, message and details
 */
export const formatErrorMessage = (
    message: string,
    errorCode: string = INTERNAL_SERVER_ERROR,
    details?: unknown
): ErrorResponse => {
    // Input validation
    if (!message || typeof message !== 'string') {
        throw new Error('Message is required and must be a string');
    }

    if (!errorCode || typeof errorCode !== 'string') {
        throw new Error('Error code is required and must be a string');
    }

    // Create standardized error response
    const response: ErrorResponse = {
        status: 'error',
        code: errorCode,
        message: `${FAILURE}: ${message}`,
        timestamp: new Date().toISOString()
    };

    // Add optional error details if provided
    if (details !== undefined) {
        response.details = details;
    }

    return response;
};

/**
 * Formats test flow related messages with execution details and timestamps.
 * Implements requirement: Data Formatting
 * 
 * @param flowId - Unique identifier for the test flow
 * @param status - Current status of the test flow
 * @param executionDetails - Optional details about the test flow execution
 * @returns Formatted test flow message with execution details
 */
export const formatTestFlowMessage = (
    flowId: string,
    status: 'started' | 'completed',
    executionDetails?: unknown
): TestFlowMessage => {
    // Input validation
    if (!flowId || typeof flowId !== 'string') {
        throw new Error('Flow ID is required and must be a string');
    }

    if (!status || !['started', 'completed'].includes(status)) {
        throw new Error('Status must be either "started" or "completed"');
    }

    // Determine appropriate message based on status
    const statusMessage = status === 'started' 
        ? TEST_FLOW_STARTED 
        : TEST_FLOW_COMPLETED;

    // Create standardized flow message
    const flowMessage: TestFlowMessage = {
        flowId,
        status,
        message: statusMessage,
        timestamp: new Date().toISOString()
    };

    // Add optional execution details if provided
    if (executionDetails !== undefined) {
        flowMessage.executionDetails = executionDetails;
    }

    return flowMessage;
};