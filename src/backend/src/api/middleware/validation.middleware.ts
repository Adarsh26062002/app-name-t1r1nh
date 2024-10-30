/**
 * validation.middleware.ts
 * Implements middleware for validating API requests, ensuring that incoming data
 * adheres to expected formats and types before processing.
 * 
 * @version express: ^4.18.2 - For Express middleware types
 * 
 * Implements requirements:
 * 1. Request Validation Middleware (system_design.api_design.api_endpoints)
 * 2. Data Validation (system_architecture.component_configuration)
 */

import { Request, Response, NextFunction } from 'express';
import {
    validateTestData,
    validateTestFlow,
    validateTestResult
} from '../../utils/validators';
import { handleError } from '../../utils/errors';
import {
    BAD_REQUEST,
    VALIDATION_ERROR
} from '../../constants/errors';

/**
 * Extracts the endpoint type from the request path
 * Used to determine which validation function to apply
 * 
 * @param path - Request path
 * @returns Endpoint type or null if not recognized
 */
const getEndpointType = (path: string): string | null => {
    const pathSegments = path.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    switch (lastSegment) {
        case 'flows':
            return 'flow';
        case 'data':
            return 'data';
        case 'validate':
            return 'result';
        default:
            return null;
    }
};

/**
 * Express middleware function that validates incoming API requests based on
 * their endpoint and request type. Ensures data integrity and adherence to
 * expected formats before allowing request processing to continue.
 * 
 * Implements validation for:
 * - /api/v1/flows (POST) - Test flow configuration
 * - /api/v1/data (POST) - Test data generation
 * - /api/v1/validate (POST) - Test result validation
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const validateRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Only validate POST requests
        if (req.method !== 'POST') {
            next();
            return;
        }

        // Extract endpoint type from request path
        const endpointType = getEndpointType(req.path);
        if (!endpointType) {
            next();
            return;
        }

        // Ensure request body exists
        if (!req.body) {
            throw new Error('Request body is missing');
        }

        // Select and apply appropriate validation based on endpoint type
        switch (endpointType) {
            case 'flow':
                // Validate test flow configuration
                validateTestFlow(req.body);
                break;

            case 'data':
                // Validate test data structure
                validateTestData(req.body);
                break;

            case 'result':
                // Validate test result data
                validateTestResult(req.body);
                break;

            default:
                // No validation required for unrecognized endpoints
                break;
        }

        // If validation passes, proceed to route handler
        next();
    } catch (error) {
        // Handle validation errors with proper error responses
        await handleError(
            error as Error,
            res,
            {
                context: {
                    path: req.path,
                    method: req.method,
                    body: req.body
                },
                skipRetry: true // Validation errors should not be retried
            }
        );
    }
};