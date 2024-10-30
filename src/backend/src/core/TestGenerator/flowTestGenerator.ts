/**
 * flowTestGenerator.ts
 * Responsible for generating and validating flow tests within the testing framework.
 * Implements requirements from:
 * - Flow Test Generation (system_architecture/component_responsibilities)
 * - Test Flow Configuration (system_architecture/component_configuration)
 * - Test Flow Validation (system_design/api_design/api_endpoints)
 * 
 * @version lodash: 4.17.21
 */

import { get, has, isArray, isEmpty } from 'lodash';
import { 
    ITestFlow, 
    ITestFlowConfig, 
    TestFlowStatus 
} from '../../types/test.types';
import { logInfo, logError } from '../../utils/logger';

// Global configuration for flow test generation and validation
const flowTestConfig = {
    defaultTimeout: 5000,
    retryAttempts: 3,
    maxSteps: 50,
    validFlowTypes: ['api', 'database', 'integration'],
    allowedEnvironments: ['development', 'staging', 'production']
};

/**
 * Validates the test flow configuration against defined schemas and constraints
 * Implements requirement: Test Flow Configuration Validation
 * 
 * @param config - The test flow configuration to validate
 * @returns Promise<boolean> - Returns true if configuration is valid, throws error if invalid
 */
export const validateFlowConfig = async (config: ITestFlowConfig): Promise<boolean> => {
    try {
        // Validate basic structure
        if (!config || typeof config !== 'object') {
            throw new Error('Invalid flow configuration structure');
        }

        // Validate steps array
        if (!has(config, 'steps') || !isArray(config.steps)) {
            throw new Error('Flow configuration must contain steps array');
        }

        // Validate step count
        if (config.steps.length === 0 || config.steps.length > flowTestConfig.maxSteps) {
            throw new Error(`Steps count must be between 1 and ${flowTestConfig.maxSteps}`);
        }

        // Validate each step structure
        for (const [index, step] of config.steps.entries()) {
            if (!step.name || !step.type || !step.action) {
                throw new Error(`Invalid step structure at index ${index}`);
            }

            // Validate step type
            if (!flowTestConfig.validFlowTypes.includes(step.type)) {
                throw new Error(`Invalid step type at index ${index}: ${step.type}`);
            }

            // Validate step timeout if specified
            if (step.timeout && (typeof step.timeout !== 'number' || step.timeout <= 0)) {
                throw new Error(`Invalid timeout value at step ${index}`);
            }
        }

        // Validate parameters
        if (!has(config, 'parameters') || typeof config.parameters !== 'object') {
            throw new Error('Flow configuration must contain parameters object');
        }

        // Validate environment configuration
        if (!has(config, 'environment') || typeof config.environment !== 'object') {
            throw new Error('Flow configuration must contain environment configuration');
        }

        if (!flowTestConfig.allowedEnvironments.includes(config.environment.name)) {
            throw new Error(`Invalid environment: ${config.environment.name}`);
        }

        // Validate environment variables
        if (!config.environment.variables || typeof config.environment.variables !== 'object') {
            throw new Error('Environment must contain variables object');
        }

        logInfo('Flow configuration validation successful', { config: JSON.stringify(config) });
        return true;

    } catch (error) {
        logError('Flow configuration validation failed', error as Error, { config: JSON.stringify(config) });
        throw error;
    }
};

/**
 * Generates flow tests based on the provided configurations and schemas
 * Implements requirement: Flow Test Generation
 * 
 * @param testFlows - Array of test flows to generate
 * @returns Promise<Array<ITestFlow>> - Returns array of generated test flows with updated status
 */
export const generateFlowTests = async (testFlows: Array<ITestFlow>): Promise<Array<ITestFlow>> => {
    try {
        // Validate input array
        if (!isArray(testFlows) || isEmpty(testFlows)) {
            throw new Error('Invalid or empty test flows array');
        }

        logInfo('Starting flow test generation', { flowCount: testFlows.length });

        // Process each test flow
        const generatedFlows = await Promise.all(testFlows.map(async (flow) => {
            try {
                // Validate flow structure
                if (!flow.id || !flow.name || !flow.flow_type || !flow.config) {
                    throw new Error(`Invalid flow structure for flow ID: ${flow.id}`);
                }

                // Validate flow configuration
                await validateFlowConfig(flow.config);

                // Set initial status
                const updatedFlow: ITestFlow = {
                    ...flow,
                    status: TestFlowStatus.PENDING,
                    updated_at: new Date()
                };

                // Generate test steps based on flow configuration
                updatedFlow.config.steps = updatedFlow.config.steps.map(step => ({
                    ...step,
                    timeout: step.timeout || flowTestConfig.defaultTimeout
                }));

                // Add retry configuration if not present
                if (!has(updatedFlow.config, 'retries')) {
                    updatedFlow.config = {
                        ...updatedFlow.config,
                        retries: flowTestConfig.retryAttempts
                    };
                }

                logInfo('Flow test generated successfully', { 
                    flowId: flow.id,
                    flowName: flow.name,
                    stepCount: flow.config.steps.length
                });

                return updatedFlow;

            } catch (error) {
                logError(`Failed to generate flow test for ID: ${flow.id}`, error as Error, {
                    flowId: flow.id,
                    flowName: flow.name
                });

                // Return flow with failed status if generation fails
                return {
                    ...flow,
                    status: TestFlowStatus.FAILED,
                    updated_at: new Date()
                };
            }
        }));

        logInfo('Completed flow test generation', { 
            totalFlows: testFlows.length,
            generatedFlows: generatedFlows.length
        });

        return generatedFlows;

    } catch (error) {
        logError('Flow test generation failed', error as Error);
        throw error;
    }
};