/**
 * TestManager/index.ts
 * Core orchestration module for test management, coordinating resource allocation,
 * state management, task scheduling, and test execution.
 * 
 * Implements requirements:
 * - Test Management (system_architecture/component_responsibilities)
 * - Component Integration (system_architecture/component_dependencies)
 * 
 * @version typescript: 4.x
 * @version async: 3.2.0
 */

import { allocateResources, deallocateResources } from './resourceManager';
import { initializeState, updateState, getState, trackExecution } from './stateManager';
import { scheduleTask } from './taskScheduler';
import { executeTestFlow } from '../TestExecutor';
import { initializeReporting } from '../TestReporter';
import { initializeDataGeneration } from '../DataGenerator';
import { logInfo, logError } from '../../utils/logger';
import { ITestFlow, TestFlowStatus } from '../../types/test.types';

// Global constants as defined in specification
const testManagerLog: Array<{
    flowId: string;
    timestamp: number;
    action: string;
    details: object;
}> = [];

const MAX_CONCURRENT_FLOWS = 5;
const FLOW_TIMEOUT_MS = 3600000; // 1 hour

/**
 * Decorator for error handling in test management functions
 */
function tryCatch(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        try {
            return await originalMethod.apply(this, args);
        } catch (error) {
            logError('Error in test management', error as Error, {
                method: propertyKey,
                args
            });
            throw error;
        }
    };
    return descriptor;
}

/**
 * Initializes the TestManager module with proper configurations and dependencies
 * Implements requirement: Test Management - Initialize test management system
 */
@tryCatch
export async function initializeTestManager(): Promise<void> {
    logInfo('Initializing TestManager module');

    try {
        // Step 1: Initialize state management system
        await initializeState({
            id: 'system',
            name: 'TestManager',
            config: {
                maxConcurrentFlows: MAX_CONCURRENT_FLOWS,
                flowTimeout: FLOW_TIMEOUT_MS
            }
        });

        // Step 2: Set up resource management
        await allocateResources({
            id: 'system',
            name: 'TestManager',
            config: {
                parameters: {
                    resourceCapacity: 100 // Base capacity for system
                }
            }
        });

        // Step 3: Configure task scheduler with concurrency limits
        await scheduleTask({
            id: 'system',
            name: 'TestManager',
            config: {
                maxConcurrent: MAX_CONCURRENT_FLOWS,
                timeout: FLOW_TIMEOUT_MS
            }
        });

        // Step 4: Initialize test reporting system
        await initializeReporting([], {
            title: 'Test Execution Report',
            includeMetrics: true,
            exportFormats: ['HTML', 'JSON']
        });

        // Step 5: Set up data generation system
        await initializeDataGeneration();

        logInfo('TestManager initialization completed successfully');

        // Log initialization success
        testManagerLog.push({
            flowId: 'system',
            timestamp: Date.now(),
            action: 'INITIALIZE',
            details: {
                status: 'success',
                config: {
                    maxConcurrentFlows: MAX_CONCURRENT_FLOWS,
                    flowTimeout: FLOW_TIMEOUT_MS
                }
            }
        });

    } catch (error) {
        // Log initialization failure
        testManagerLog.push({
            flowId: 'system',
            timestamp: Date.now(),
            action: 'INITIALIZE',
            details: {
                status: 'failure',
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        });
        throw error;
    }
}

/**
 * Manages the execution of test flows with proper resource allocation and state management
 * Implements requirement: Test Management - Coordinate test flow execution
 */
@tryCatch
export async function manageTestFlows(testFlows: Array<ITestFlow>): Promise<void> {
    if (!testFlows?.length) {
        throw new Error('No test flows provided for management');
    }

    logInfo('Starting test flow management', {
        flowCount: testFlows.length
    });

    try {
        // Step 1: Validate input test flows
        testFlows.forEach(validateTestFlow);

        // Step 2: Initialize execution state for each flow
        await Promise.all(testFlows.map(async (flow) => {
            await initializeState(flow);
            testManagerLog.push({
                flowId: flow.id,
                timestamp: Date.now(),
                action: 'INIT_STATE',
                details: { flowName: flow.name }
            });
        }));

        // Step 3: Allocate necessary resources
        const resources = await allocateResources({
            id: 'batch',
            name: 'TestFlowBatch',
            config: {
                parameters: {
                    resourceCapacity: testFlows.length * 20 // 20% capacity per test
                }
            }
        });

        // Step 4: Schedule test flows with concurrency control
        const scheduledFlows = testFlows.map(async (flow) => {
            try {
                await scheduleTask(flow);
                await updateState(flow, { status: TestFlowStatus.RUNNING });
                
                testManagerLog.push({
                    flowId: flow.id,
                    timestamp: Date.now(),
                    action: 'SCHEDULE',
                    details: { status: 'scheduled' }
                });

            } catch (error) {
                logError('Flow scheduling failed', error as Error, {
                    flowId: flow.id
                });
                await updateState(flow, {
                    status: TestFlowStatus.FAILED,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        await Promise.all(scheduledFlows);

        // Step 5: Execute test flows
        const executionPromises = testFlows.map(async (flow) => {
            try {
                // Track execution start
                await trackExecution(flow);

                // Execute the flow
                await executeTestFlow(flow);

                // Update successful execution state
                await updateState(flow, { status: TestFlowStatus.COMPLETED });

                testManagerLog.push({
                    flowId: flow.id,
                    timestamp: Date.now(),
                    action: 'EXECUTE',
                    details: { status: 'completed' }
                });

            } catch (error) {
                // Handle execution failure
                logError('Flow execution failed', error as Error, {
                    flowId: flow.id
                });

                await updateState(flow, {
                    status: TestFlowStatus.FAILED,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });

                testManagerLog.push({
                    flowId: flow.id,
                    timestamp: Date.now(),
                    action: 'EXECUTE',
                    details: { status: 'failed', error: error }
                });
            }
        });

        await Promise.all(executionPromises);

        // Step 6: Clean up resources
        await deallocateResources(resources);

        logInfo('Test flow management completed', {
            flowCount: testFlows.length
        });

    } catch (error) {
        logError('Test flow management failed', error as Error, {
            flowCount: testFlows.length
        });
        throw error;
    }
}

/**
 * Validates a test flow configuration
 */
function validateTestFlow(testFlow: ITestFlow): void {
    if (!testFlow.id || !testFlow.name) {
        throw new Error('Invalid test flow: missing required fields');
    }

    if (!testFlow.config) {
        throw new Error(`Invalid test flow configuration for flow: ${testFlow.id}`);
    }

    if (!Array.isArray(testFlow.config.steps) || testFlow.config.steps.length === 0) {
        throw new Error(`No test steps defined for flow: ${testFlow.id}`);
    }
}

// Export test management functionality
export const TestManager = {
    initializeTestManager,
    manageTestFlows
};