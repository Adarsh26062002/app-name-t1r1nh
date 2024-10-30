/**
 * schemaValidator.ts
 * Implements comprehensive schema validation for test data entities.
 * 
 * Implements requirements from:
 * - Schema Validation (system_architecture/component_configuration)
 * - Test Data Storage Schema (system_design/database_design/test_data_storage)
 */

// Third-party imports
import Ajv from 'ajv';  // version 8.12.0
import addFormats from 'ajv-formats';  // version 2.1.1

// Internal imports
import { ITestData } from '../../types/test.types';
import { validateTestData } from '../../utils/validators';
import { ERROR_CODES } from '../../constants/errors';

// Initialize JSON Schema validator
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

/**
 * ERD schema specification based on system_design/database_design/test_data_storage
 * Defines the required relationships between TestSuite, TestCase, TestStep, and DataSet
 */
const erdSchema = {
    type: 'object',
    required: ['testSuite', 'testCases', 'testSteps', 'dataSets'],
    properties: {
        testSuite: {
            type: 'object',
            required: ['name', 'description'],
            properties: {
                name: { type: 'string', minLength: 1 },
                description: { type: 'string' }
            }
        },
        testCases: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                required: ['name', 'flowType', 'config'],
                properties: {
                    name: { type: 'string', minLength: 1 },
                    flowType: { 
                        type: 'string',
                        enum: ['api', 'database', 'integration', 'performance']
                    },
                    config: { type: 'object' }
                }
            }
        },
        testSteps: {
            type: 'array',
            items: {
                type: 'object',
                required: ['operation', 'request', 'expected', 'sequence'],
                properties: {
                    operation: { type: 'string' },
                    request: { type: 'object' },
                    expected: { type: 'object' },
                    sequence: { type: 'integer', minimum: 0 }
                }
            }
        },
        dataSets: {
            type: 'array',
            items: {
                type: 'object',
                required: ['values', 'status'],
                properties: {
                    values: { type: 'object' },
                    status: { 
                        type: 'string',
                        enum: ['active', 'inactive', 'archived']
                    }
                }
            }
        }
    }
};

// Compile schema for better performance
const validateERDSchema = ajv.compile(erdSchema);

/**
 * Validates the schema of the provided test data to ensure it meets
 * the required structure and constraints defined in the database ERD specification.
 * 
 * @param testData - The test data object to validate
 * @returns Promise<boolean> - Resolves to true if valid, throws ValidationError if invalid
 */
export const validateSchema = async (testData: ITestData): Promise<boolean> => {
    try {
        // Step 1: Verify that the testData object contains all required fields
        // This uses the validateTestData utility which checks basic structure
        await validateTestData(testData);

        // Step 2: Validate that the schema field contains valid JSON structure
        if (typeof testData.schema !== 'object') {
            throw new Error('Schema must be a valid JSON object');
        }

        // Step 3: Check that the schema defines all required relationships
        const isValidERD = validateERDSchema(testData.schema);
        if (!isValidERD) {
            const errors = validateERDSchema.errors?.map(err => 
                `${err.instancePath} ${err.message}`
            ).join('; ');
            throw new Error(`Schema validation failed: ${errors}`);
        }

        // Step 4: Validate that the scope field matches allowed values
        const validScopes = ['unit', 'integration', 'e2e', 'performance'];
        if (!validScopes.includes(testData.scope)) {
            throw new Error(`Invalid scope. Must be one of: ${validScopes.join(', ')}`);
        }

        // Step 5: Ensure valid_from and valid_to timestamps are valid
        const now = new Date();
        const validFrom = new Date(testData.valid_from);
        const validTo = new Date(testData.valid_to);

        if (isNaN(validFrom.getTime()) || isNaN(validTo.getTime())) {
            throw new Error('Invalid timestamp format for valid_from or valid_to');
        }

        if (validTo <= validFrom) {
            throw new Error('valid_to must be after valid_from');
        }

        // Step 6: Validate relationships between components in the schema
        validateSchemaRelationships(testData.schema);

        // Step 7: Validate test case configurations
        validateTestCaseConfigs(testData.schema.testCases);

        return true;
    } catch (error) {
        throw {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: error instanceof Error ? error.message : 'Schema validation failed',
            details: error
        };
    }
};

/**
 * Validates relationships between different components in the schema
 * Ensures proper references and cardinality as per ERD specification
 */
function validateSchemaRelationships(schema: Record<string, any>): void {
    // Validate TestSuite to TestCase relationship
    if (!schema.testCases?.length) {
        throw new Error('TestSuite must contain at least one TestCase');
    }

    // Validate TestCase to TestStep relationship
    schema.testCases.forEach((testCase: any, index: number) => {
        const testSteps = schema.testSteps.filter((step: any) => 
            step.testCaseId === testCase.id
        );
        
        if (!testSteps.length) {
            throw new Error(`TestCase at index ${index} must have at least one TestStep`);
        }

        // Validate step sequences
        const sequences = testSteps.map((step: any) => step.sequence);
        const uniqueSequences = new Set(sequences);
        if (sequences.length !== uniqueSequences.size) {
            throw new Error(`Duplicate step sequences found in TestCase at index ${index}`);
        }
    });

    // Validate TestCase to DataSet relationship
    schema.testCases.forEach((testCase: any, index: number) => {
        if (testCase.dataSets?.length) {
            testCase.dataSets.forEach((dataSetId: string) => {
                const dataSet = schema.dataSets.find((ds: any) => ds.id === dataSetId);
                if (!dataSet) {
                    throw new Error(`Invalid DataSet reference in TestCase at index ${index}`);
                }
            });
        }
    });
}

/**
 * Validates test case configurations based on their flow type
 * Ensures that each test case has the required configuration properties
 */
function validateTestCaseConfigs(testCases: Array<any>): void {
    testCases.forEach((testCase: any, index: number) => {
        const { flowType, config } = testCase;

        // Common validation for all flow types
        if (!config.timeout || typeof config.timeout !== 'number') {
            throw new Error(`TestCase at index ${index} must have a valid timeout configuration`);
        }

        // Flow-specific validation
        switch (flowType) {
            case 'api':
                validateApiTestConfig(config, index);
                break;
            case 'database':
                validateDatabaseTestConfig(config, index);
                break;
            case 'integration':
                validateIntegrationTestConfig(config, index);
                break;
            case 'performance':
                validatePerformanceTestConfig(config, index);
                break;
        }
    });
}

/**
 * Validates API test case configuration
 */
function validateApiTestConfig(config: any, testCaseIndex: number): void {
    const requiredFields = ['endpoint', 'method', 'headers'];
    requiredFields.forEach(field => {
        if (!config[field]) {
            throw new Error(`API TestCase at index ${testCaseIndex} missing required field: ${field}`);
        }
    });
}

/**
 * Validates database test case configuration
 */
function validateDatabaseTestConfig(config: any, testCaseIndex: number): void {
    const requiredFields = ['query', 'parameters'];
    requiredFields.forEach(field => {
        if (!config[field]) {
            throw new Error(`Database TestCase at index ${testCaseIndex} missing required field: ${field}`);
        }
    });
}

/**
 * Validates integration test case configuration
 */
function validateIntegrationTestConfig(config: any, testCaseIndex: number): void {
    const requiredFields = ['steps', 'dependencies'];
    requiredFields.forEach(field => {
        if (!config[field]) {
            throw new Error(`Integration TestCase at index ${testCaseIndex} missing required field: ${field}`);
        }
    });
}

/**
 * Validates performance test case configuration
 */
function validatePerformanceTestConfig(config: any, testCaseIndex: number): void {
    const requiredFields = ['concurrency', 'duration', 'rampUp'];
    requiredFields.forEach(field => {
        if (!config[field]) {
            throw new Error(`Performance TestCase at index ${testCaseIndex} missing required field: ${field}`);
        }
    });
}