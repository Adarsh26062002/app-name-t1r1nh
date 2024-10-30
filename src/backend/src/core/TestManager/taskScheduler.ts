/**
 * taskScheduler.ts
 * Implements a robust task scheduling system for test flow execution, managing concurrency,
 * resource allocation, and execution order with proper error handling and retry mechanisms.
 * 
 * Implements requirements:
 * - Task Scheduling (system_architecture/component_responsibilities)
 * - Resource Management (system_architecture/component_responsibilities)
 * - State Management (system_architecture/component_responsibilities)
 * 
 * @version typescript: 4.x
 * @version async: 3.2.0
 */

import { Queue } from 'async'; // v3.2.0
import { initializeState, updateState } from './stateManager';
import { allocateResources, deallocateResources } from './resourceManager';
import { trackExecution } from './executionTracker';
import { retryTestExecution } from '../TestExecutor/retryHandler';
import { ITestFlow, TestFlowStatus } from '../../types/test.types';
import { logInfo, logError, logWarning } from '../../utils/logger';

// Global task queue with concurrency control
const taskQueue = new Queue({ concurrency: 5 });

// Constants for task scheduling
const MAX_QUEUE_SIZE = 100;
const TASK_TIMEOUT_MS = 3600000; // 1 hour

// Map to store task timeouts
const taskTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Decorator for error handling in task scheduling functions
 */
function tryCatch(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
        try {
            return await originalMethod.apply(this, args);
        } catch (error) {
            logError('Error in task scheduling', error as Error, {
                method: propertyKey,
                args
            });
            throw error;
        }
    };
    return descriptor;
}

/**
 * Schedules a test flow for execution with proper resource allocation and error handling
 * Implements requirement: Task Scheduling - Manage execution order and concurrency
 */
@tryCatch
export async function scheduleTask(testFlow: ITestFlow): Promise<void> {
    // Validate test flow input parameters
    if (!testFlow?.id || !testFlow.name || !testFlow.config) {
        throw new Error('Invalid test flow parameters provided');
    }

    logInfo('Scheduling new task', {
        flowId: testFlow.id,
        flowName: testFlow.name
    });

    // Check queue capacity
    if (taskQueue.length() >= MAX_QUEUE_SIZE) {
        throw new Error('Task queue is at maximum capacity');
    }

    try {
        // Initialize execution state
        await initializeState(testFlow);

        // Allocate necessary resources
        const resources = await allocateResources(testFlow);

        // Set up task timeout
        const timeoutId = setTimeout(() => {
            handleTaskTimeout(testFlow);
        }, TASK_TIMEOUT_MS);
        taskTimeouts.set(testFlow.id, timeoutId);

        // Add task to queue
        await taskQueue.push(async () => {
            try {
                // Update state to running
                await updateState(testFlow, {
                    status: TestFlowStatus.RUNNING,
                    resources
                });

                // Track execution progress
                await trackExecution(testFlow);

                // Execute the task
                const success = await executeTask(testFlow);

                if (!success) {
                    // Attempt retry if execution failed
                    const retrySuccess = await retryTestExecution(testFlow);
                    if (!retrySuccess) {
                        throw new Error('Task execution failed after retries');
                    }
                }

                // Update state to completed
                await updateState(testFlow, {
                    status: TestFlowStatus.COMPLETED
                });

            } catch (error) {
                // Handle execution failure
                await handleTaskFailure(testFlow, error as Error);
            } finally {
                // Clean up resources
                await cleanupTask(testFlow, resources);
            }
        });

        logInfo('Task scheduled successfully', {
            flowId: testFlow.id,
            queueLength: taskQueue.length()
        });

    } catch (error) {
        logError('Failed to schedule task', error as Error, {
            flowId: testFlow.id
        });
        throw error;
    }
}

/**
 * Executes a scheduled task with proper monitoring
 * Implements requirement: Task Scheduling - Ensure execution reliability
 */
async function executeTask(testFlow: ITestFlow): Promise<boolean> {
    logInfo('Starting task execution', {
        flowId: testFlow.id,
        flowName: testFlow.name
    });

    try {
        // Execute test flow steps in sequence
        for (const step of testFlow.config.steps) {
            await executeStep(testFlow, step);
        }

        return true;
    } catch (error) {
        logError('Task execution failed', error as Error, {
            flowId: testFlow.id
        });
        return false;
    }
}

/**
 * Executes a single step of the test flow
 * Implements requirement: Task Scheduling - Manage execution order
 */
async function executeStep(
    testFlow: ITestFlow,
    step: { name: string; type: string; action: string }
): Promise<void> {
    logInfo('Executing step', {
        flowId: testFlow.id,
        stepName: step.name
    });

    const stepTimeout = step.timeout || TASK_TIMEOUT_MS;
    const stepPromise = new Promise<void>((resolve, reject) => {
        // Step execution logic would be implemented here
        // This is a placeholder for the actual step execution
        setTimeout(() => {
            resolve();
        }, 100);
    });

    try {
        await Promise.race([
            stepPromise,
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Step timeout exceeded: ${step.name}`));
                }, stepTimeout);
            })
        ]);
    } catch (error) {
        throw new Error(`Step execution failed: ${step.name} - ${(error as Error).message}`);
    }
}

/**
 * Handles task timeout by cleaning up resources and updating state
 * Implements requirement: Task Scheduling - Handle execution timeouts
 */
async function handleTaskTimeout(testFlow: ITestFlow): Promise<void> {
    logWarning('Task timeout exceeded', {
        flowId: testFlow.id,
        timeout: TASK_TIMEOUT_MS
    });

    try {
        // Update state to failed
        await updateState(testFlow, {
            status: TestFlowStatus.FAILED,
            error: 'Task timeout exceeded'
        });

        // Clean up resources
        const resources = testFlow.config.parameters.resources;
        if (resources) {
            await deallocateResources(resources);
        }

    } catch (error) {
        logError('Error handling task timeout', error as Error, {
            flowId: testFlow.id
        });
    }
}

/**
 * Handles task failure with proper error handling and state updates
 * Implements requirement: Task Scheduling - Handle execution failures
 */
async function handleTaskFailure(testFlow: ITestFlow, error: Error): Promise<void> {
    logError('Task failed', error, {
        flowId: testFlow.id,
        flowName: testFlow.name
    });

    try {
        // Update state to failed
        await updateState(testFlow, {
            status: TestFlowStatus.FAILED,
            error: error.message
        });

    } catch (updateError) {
        logError('Error updating failed task state', updateError as Error, {
            flowId: testFlow.id
        });
    }
}

/**
 * Cleans up task resources and removes timeouts
 * Implements requirement: Resource Management - Ensure proper resource cleanup
 */
async function cleanupTask(
    testFlow: ITestFlow,
    resources: any
): Promise<void> {
    try {
        // Clear task timeout
        const timeoutId = taskTimeouts.get(testFlow.id);
        if (timeoutId) {
            clearTimeout(timeoutId);
            taskTimeouts.delete(testFlow.id);
        }

        // Deallocate resources
        if (resources) {
            await deallocateResources(resources);
        }

        logInfo('Task cleanup completed', {
            flowId: testFlow.id
        });

    } catch (error) {
        logError('Error during task cleanup', error as Error, {
            flowId: testFlow.id
        });
    }
}

// Export task scheduling functionality
export const taskScheduler = {
    scheduleTask
};