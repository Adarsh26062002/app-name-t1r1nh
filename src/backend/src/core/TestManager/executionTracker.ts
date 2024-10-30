/**
 * executionTracker.ts
 * Implements comprehensive execution tracking for test flows with real-time monitoring,
 * event-based communication, and detailed logging.
 * 
 * Implements requirements:
 * - Execution Tracking (system_architecture/component_responsibilities)
 * - Flow Test Execution (system_architecture/component_responsibilities)
 * 
 * @version typescript: 4.x
 * @version async: 3.2.0
 * @version events: 3.3.0
 */

import { EventEmitter } from 'events'; // v3.3.0
import * as async from 'async'; // v3.2.0
import { trackExecution as trackState, updateState, initializeState } from './stateManager';
import { allocateResources, deallocateResources } from './resourceManager';
import { retryTestExecution } from '../TestExecutor/retryHandler';
import { ITestFlow, TestFlowStatus } from '../../types/test.types';
import { logInfo, logError, logWarning } from '../../utils/logger';

// Global execution tracking arrays and event emitter
export const executionLog: Array<{
    flowId: string;
    timestamp: number;
    event: string;
    details: object;
}> = [];

export const executionEmitter = new EventEmitter();

// Constants for execution tracking
export const MAX_EXECUTION_TIME = 3600000; // 1 hour
export const EXECUTION_CHECK_INTERVAL = 5000; // 5 seconds

// Map to store active execution monitors
const activeMonitors = new Map<string, NodeJS.Timeout>();

/**
 * Decorator for error handling in execution tracking functions
 */
function tryCatch(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
        try {
            return await originalMethod.apply(this, args);
        } catch (error) {
            logError('Error in execution tracking', error as Error, {
                method: propertyKey,
                args
            });
            throw error;
        }
    };
    return descriptor;
}

/**
 * Tracks the execution of a test flow with comprehensive monitoring
 * Implements requirement: Execution Tracking - Track test flow execution with detailed logging
 */
@tryCatch
export async function trackExecution(testFlow: ITestFlow): Promise<void> {
    if (!testFlow?.id) {
        throw new Error('Invalid test flow provided for execution tracking');
    }

    logInfo('Starting execution tracking', {
        flowId: testFlow.id,
        flowName: testFlow.name
    });

    try {
        // Initialize execution state
        await initializeState(testFlow);
        
        // Log execution start
        executionLog.push({
            flowId: testFlow.id,
            timestamp: Date.now(),
            event: 'EXECUTION_STARTED',
            details: {
                flowName: testFlow.name,
                config: testFlow.config
            }
        });

        // Emit execution started event
        executionEmitter.emit('executionStarted', {
            flowId: testFlow.id,
            timestamp: Date.now(),
            flowDetails: testFlow
        });

        // Allocate required resources
        const resources = await allocateResources(testFlow);
        
        // Update initial execution state
        await updateState(testFlow, {
            status: TestFlowStatus.RUNNING,
            resources
        });

        // Emit ready for execution event
        executionEmitter.emit('readyForExecution', {
            flowId: testFlow.id,
            timestamp: Date.now(),
            resources
        });

        // Set up execution monitoring
        const monitorInterval = setupExecutionMonitoring(testFlow);
        activeMonitors.set(testFlow.id, monitorInterval);

        // Track execution progress
        await trackState(testFlow);

        // Set up execution completion listener
        const executionPromise = new Promise<void>((resolve, reject) => {
            const completionTimeout = setTimeout(() => {
                reject(new Error('Execution timeout exceeded'));
            }, MAX_EXECUTION_TIME);

            executionEmitter.once(`execution:${testFlow.id}:completed`, () => {
                clearTimeout(completionTimeout);
                resolve();
            });

            executionEmitter.once(`execution:${testFlow.id}:failed`, (error) => {
                clearTimeout(completionTimeout);
                reject(error);
            });
        });

        try {
            await executionPromise;
            await handleExecutionSuccess(testFlow);
        } catch (error) {
            await handleExecutionFailure(testFlow, error as Error);
        }

    } catch (error) {
        await handleExecutionError(testFlow, error as Error);
    } finally {
        await cleanupExecution(testFlow);
    }
}

/**
 * Sets up monitoring interval for execution tracking
 */
function setupExecutionMonitoring(testFlow: ITestFlow): NodeJS.Timeout {
    return setInterval(() => {
        const executionTime = Date.now() - testFlow.created_at.getTime();
        
        if (executionTime > MAX_EXECUTION_TIME) {
            executionEmitter.emit(`execution:${testFlow.id}:failed`, 
                new Error('Maximum execution time exceeded'));
            return;
        }

        // Log execution progress
        executionLog.push({
            flowId: testFlow.id,
            timestamp: Date.now(),
            event: 'EXECUTION_PROGRESS',
            details: {
                executionTime,
                status: testFlow.status
            }
        });

    }, EXECUTION_CHECK_INTERVAL);
}

/**
 * Handles successful execution completion
 */
async function handleExecutionSuccess(testFlow: ITestFlow): Promise<void> {
    await updateState(testFlow, {
        status: TestFlowStatus.COMPLETED
    });

    executionLog.push({
        flowId: testFlow.id,
        timestamp: Date.now(),
        event: 'EXECUTION_COMPLETED',
        details: {
            status: TestFlowStatus.COMPLETED,
            duration: Date.now() - testFlow.created_at.getTime()
        }
    });

    executionEmitter.emit('executionCompleted', {
        flowId: testFlow.id,
        timestamp: Date.now(),
        status: TestFlowStatus.COMPLETED
    });
}

/**
 * Handles execution failure with retry logic
 */
async function handleExecutionFailure(testFlow: ITestFlow, error: Error): Promise<void> {
    logError('Execution failed', error, {
        flowId: testFlow.id,
        flowName: testFlow.name
    });

    // Attempt retry
    const retrySuccess = await retryTestExecution(testFlow);

    if (!retrySuccess) {
        await updateState(testFlow, {
            status: TestFlowStatus.FAILED,
            error: error.message
        });

        executionLog.push({
            flowId: testFlow.id,
            timestamp: Date.now(),
            event: 'EXECUTION_FAILED',
            details: {
                error: error.message,
                retryAttempted: true,
                retrySuccess: false
            }
        });

        executionEmitter.emit('executionFailed', {
            flowId: testFlow.id,
            timestamp: Date.now(),
            error: error.message
        });
    }
}

/**
 * Handles unexpected execution errors
 */
async function handleExecutionError(testFlow: ITestFlow, error: Error): Promise<void> {
    logError('Unexpected execution error', error, {
        flowId: testFlow.id,
        flowName: testFlow.name
    });

    await updateState(testFlow, {
        status: TestFlowStatus.FAILED,
        error: error.message
    });

    executionEmitter.emit('executionError', {
        flowId: testFlow.id,
        timestamp: Date.now(),
        error: error.message
    });
}

/**
 * Cleans up execution resources and monitoring
 */
async function cleanupExecution(testFlow: ITestFlow): Promise<void> {
    try {
        // Clear monitoring interval
        const monitorInterval = activeMonitors.get(testFlow.id);
        if (monitorInterval) {
            clearInterval(monitorInterval);
            activeMonitors.delete(testFlow.id);
        }

        // Deallocate resources
        const resources = testFlow.config.parameters.resources;
        if (resources) {
            await deallocateResources(resources);
        }

        // Log cleanup completion
        logInfo('Execution cleanup completed', {
            flowId: testFlow.id,
            flowName: testFlow.name
        });

    } catch (error) {
        logWarning('Error during execution cleanup', {
            flowId: testFlow.id,
            error: (error as Error).message
        });
    }
}

// Export execution tracking functionality
export const executionTracker = {
    trackExecution,
    executionEmitter
};