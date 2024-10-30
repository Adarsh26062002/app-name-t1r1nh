/**
 * responseValidator.ts
 * Implements comprehensive response validation logic for test executions,
 * ensuring that both GraphQL and REST API responses meet the expected criteria.
 * 
 * Implements requirements:
 * 1. Response Validation (system_architecture/component_responsibilities)
 * 2. API Response Validation (system_design/api_design/api_endpoints)
 */

import { validateTestFlow } from '../../utils/validators';
import { logInfo, logError, logDebug } from '../../utils/logger';
import { ERROR_CODES } from '../../constants/errors';
import { ITestFlow, IApiResponse } from '../../types/test.types';
import Ajv from 'ajv'; // version: 8.12.0

// Initialize Ajv with strict mode and all errors collection
const validator = new Ajv({ 
    allErrors: true,
    strict: true,
    validateFormats: true
});

// Store validation logs for debugging and reporting
const responseValidatorLog: Array<{
    timestamp: Date;
    response: IApiResponse;
    result: boolean;
    errors?: any[];
}> = [];

/**
 * Validates an API response against expected criteria and schema
 * Implements API Response Validation requirement
 */
export async function validateApiResponse(
    response: IApiResponse,
    expectedCriteria: object,
    testFlow: ITestFlow
): Promise<boolean> {
    try {
        logInfo('Starting API response validation', {
            flowId: testFlow.id,
            responseType: response.type
        });

        // Validate test flow structure first
        validateTestFlow(testFlow);

        // Determine API type and validate accordingly
        const isGraphQL = testFlow.config.steps.some(step => 
            step.type === 'graphql'
        );

        let isValid = false;
        if (isGraphQL) {
            isValid = await validateGraphQLResponse(response, expectedCriteria);
        } else {
            isValid = await validateRESTResponse(response, expectedCriteria);
        }

        // Log validation result
        responseValidatorLog.push({
            timestamp: new Date(),
            response,
            result: isValid,
            errors: validator.errors || undefined
        });

        logDebug('Response validation completed', {
            flowId: testFlow.id,
            isValid,
            errors: validator.errors
        });

        return isValid;
    } catch (error) {
        logError('Error during response validation', error as Error, {
            flowId: testFlow.id,
            errorCode: ERROR_CODES.VALIDATION_ERROR
        });
        throw error;
    }
}

/**
 * Validates GraphQL-specific response structure and data
 * Implements GraphQL Response Validation requirement
 */
export function validateGraphQLResponse(
    response: object,
    expectedSchema: object
): boolean {
    try {
        // Validate basic GraphQL response structure
        const hasValidStructure = validator.validate({
            type: 'object',
            required: ['data'],
            properties: {
                data: { type: 'object' },
                errors: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['message'],
                        properties: {
                            message: { type: 'string' },
                            locations: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    required: ['line', 'column'],
                                    properties: {
                                        line: { type: 'number' },
                                        column: { type: 'number' }
                                    }
                                }
                            },
                            path: {
                                type: 'array',
                                items: { type: 'string' }
                            }
                        }
                    }
                }
            }
        }, response);

        if (!hasValidStructure) {
            logError('Invalid GraphQL response structure', new Error('Schema validation failed'), {
                errors: validator.errors
            });
            return false;
        }

        // Validate response data against expected schema
        const isValidData = validator.validate(expectedSchema, (response as any).data);
        
        if (!isValidData) {
            logError('GraphQL response data validation failed', new Error('Data validation failed'), {
                errors: validator.errors
            });
            return false;
        }

        // Check for GraphQL errors
        if ((response as any).errors && (response as any).errors.length > 0) {
            logWarning('GraphQL response contains errors', {
                errors: (response as any).errors
            });
            return false;
        }

        return true;
    } catch (error) {
        logError('Error during GraphQL response validation', error as Error, {
            errorCode: ERROR_CODES.VALIDATION_ERROR
        });
        return false;
    }
}

/**
 * Validates REST-specific response structure and data
 * Implements REST Response Validation requirement
 */
export function validateRESTResponse(
    response: object,
    expectedCriteria: object
): boolean {
    try {
        // Validate basic REST response structure
        const hasValidStructure = validator.validate({
            type: 'object',
            required: ['status', 'headers', 'body'],
            properties: {
                status: { type: 'number' },
                headers: { type: 'object' },
                body: { type: 'object' }
            }
        }, response);

        if (!hasValidStructure) {
            logError('Invalid REST response structure', new Error('Schema validation failed'), {
                errors: validator.errors
            });
            return false;
        }

        // Validate status code
        const expectedStatus = (expectedCriteria as any).status;
        if (expectedStatus && (response as any).status !== expectedStatus) {
            logError('Unexpected REST response status', new Error('Status code mismatch'), {
                expected: expectedStatus,
                received: (response as any).status
            });
            return false;
        }

        // Validate headers
        const expectedHeaders = (expectedCriteria as any).headers;
        if (expectedHeaders) {
            for (const [key, value] of Object.entries(expectedHeaders)) {
                if ((response as any).headers[key] !== value) {
                    logError('Header validation failed', new Error('Header mismatch'), {
                        header: key,
                        expected: value,
                        received: (response as any).headers[key]
                    });
                    return false;
                }
            }
        }

        // Validate response body against expected schema
        const bodySchema = (expectedCriteria as any).bodySchema;
        if (bodySchema) {
            const isValidBody = validator.validate(bodySchema, (response as any).body);
            if (!isValidBody) {
                logError('REST response body validation failed', new Error('Body validation failed'), {
                    errors: validator.errors
                });
                return false;
            }
        }

        return true;
    } catch (error) {
        logError('Error during REST response validation', error as Error, {
            errorCode: ERROR_CODES.VALIDATION_ERROR
        });
        return false;
    }
}

// Helper function for logging warnings
function logWarning(message: string, metadata: object): void {
    logDebug(`WARNING: ${message}`, metadata);
}