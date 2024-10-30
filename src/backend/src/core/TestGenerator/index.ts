/**
 * TestGenerator/index.ts
 * Main entry point for the Test Generator module that orchestrates the generation
 * of various types of tests including flow, API, and database tests.
 * 
 * Implements requirements:
 * - Test Generation (system_architecture/component_responsibilities)
 * - Test Flow Management (system_architecture/component_dependencies)
 * - Test Data Integration (system_design/database_design/test_data_storage)
 * 
 * @version typescript: 4.9.5
 */

// Import internal dependencies
import { generateFlowTests } from './flowTestGenerator';
import { generateAPITests } from './apiTestGenerator';
import { generateDBTests } from './dbTestGenerator';
import { initializeDataGenerator } from '../DataGenerator';
import { executeTestSuite } from '../TestExecutor';
import { manageTestFlows } from '../TestManager';
import { info as logInfo, error as logError } from '../../utils/logger';
import { TestFlowModel } from '../../types/test.types';

// Global configuration as defined in specification
const TEST_GENERATOR_CONFIG = {
    maxConcurrentFlows: 10,
    defaultTimeout: 30000,
    retryAttempts: 3,
    validateResults: true
};

/**
 * Decorator for validating test flows before generation
 */
function validateTestFlows(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
        const [testFlows] = args;

        if (!Array.isArray(testFlows) || testFlows.length === 0) {
            throw new Error('Invalid or empty test flows array provided');
        }

        // Validate each test flow structure
        testFlows.forEach((flow: TestFlowModel, index: number) => {
            if (!flow.id || !flow.name || !flow.flow_type || !flow.config) {
                throw new Error(`Invalid test flow structure at index ${index}`);
            }

            // Validate flow configuration
            if (!flow.config.steps || !Array.isArray(flow.config.steps) || flow.config.steps.length === 0) {
                throw new Error(`Invalid or empty steps array in test flow at index ${index}`);
            }
        });

        return originalMethod.apply(this, args);
    };

    return descriptor;
}

/**
 * Initializes the Test Generator module by setting up necessary configurations and dependencies
 * Implements requirement: Test Generation - Initialize test generation system
 */
export async function initializeTestGenerator(): Promise<void> {
    try {
        logInfo('Initializing Test Generator module');

        // Step 1: Set up test generator configuration
        const config = {
            ...TEST_GENERATOR_CONFIG,
            environment: process.env.NODE_ENV || 'development'
        };

        // Step 2: Initialize data generator for test data creation
        await initializeDataGenerator();

        // Step 3: Initialize test flow management system
        await manageTestFlows([{
            id: 'system-init',
            name: 'System Initialization Test',
            flow_type: 'system',
            config: {
                steps: [{
                    name: 'Validate System Configuration',
                    type: 'validation',
                    action: 'validate_config'
                }]
            },
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
        }]);

        logInfo('Test Generator initialization completed successfully', { config });

    } catch (error) {
        logError('Test Generator initialization failed', error as Error);
        throw new Error(`Failed to initialize Test Generator: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Orchestrates the generation of various types of tests while managing dependencies and execution order
 * Implements requirements:
 * - Test Generation (system_architecture/component_responsibilities)
 * - Test Flow Management (system_architecture/component_dependencies)
 * - Test Data Integration (system_design/database_design/test_data_storage)
 */
@validateTestFlows
export async function generateTests(testFlows: Array<TestFlowModel>): Promise<void> {
    try {
        logInfo('Starting test generation process', {
            flowCount: testFlows.length
        });

        // Step 1: Initialize data generation
        await initializeDataGenerator();

        // Step 2: Generate flow tests
        const flowTests = await generateFlowTests(testFlows.filter(
            flow => flow.flow_type === 'flow'
        ));

        // Step 3: Generate API tests
        const apiTests = await generateAPITests(
            {
                endpoint: process.env.GRAPHQL_ENDPOINT!,
                headers: { 'Content-Type': 'application/json' }
            },
            {
                baseUrl: process.env.REST_API_BASE_URL!,
                headers: { 'Accept': 'application/json' },
                timeout: TEST_GENERATOR_CONFIG.defaultTimeout
            }
        );

        // Step 4: Generate database tests
        const dbTests = await generateDBTests({
            id: 'test-data-generation',
            name: 'Test Data Generation',
            scope: 'all',
            schema: {
                testSuite: {
                    name: 'Database Test Suite',
                    description: 'Comprehensive database test suite'
                },
                testCases: [],
                testSteps: [],
                dataSets: []
            },
            valid_from: new Date(),
            valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days validity
        });

        // Step 5: Combine all generated tests
        const allTests = [
            ...flowTests,
            ...apiTests,
            ...dbTests
        ];

        // Step 6: Manage test flows and dependencies
        await manageTestFlows(allTests);

        // Step 7: Execute the complete test suite
        await executeTestSuite(allTests, {
            parallel: true,
            maxConcurrent: TEST_GENERATOR_CONFIG.maxConcurrentFlows,
            timeout: TEST_GENERATOR_CONFIG.defaultTimeout,
            retryAttempts: TEST_GENERATOR_CONFIG.retryAttempts,
            validateResponses: TEST_GENERATOR_CONFIG.validateResults
        });

        logInfo('Test generation process completed successfully', {
            totalTests: allTests.length,
            flowTests: flowTests.length,
            apiTests: apiTests.length,
            dbTests: dbTests.length
        });

    } catch (error) {
        logError('Test generation process failed', error as Error, {
            flowCount: testFlows.length
        });
        throw new Error(`Failed to generate tests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Export test generation functionality
export const TestGenerator = {
    initializeTestGenerator,
    generateTests
};