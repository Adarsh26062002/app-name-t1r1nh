/**
 * stateManager.ts
 * Manages the state of test executions, ensuring consistency and reliability across test flows.
 * Implements state tracking, persistence, and recovery mechanisms with proper error handling
 * and retry capabilities.
 * 
 * Implements requirements:
 * - State Management (system_architecture/component_responsibilities)
 * - Flow Test Execution (system_architecture/component_responsibilities)
 * 
 * @version typescript: 4.x
 * @version async: 3.2.0
 */

import { allocateResources } from './resourceManager';
import { retryTestExecution } from '../TestExecutor/retryHandler';
import { updateTestFlow, getTestFlowById } from '../../db/repositories/testFlow.repository';
import { ITestFlow, TestFlowStatus } from '../../types/test.types';
import * as async from 'async'; // v3.2.0

// Global state tracking arrays and maps as defined in specification
const stateLog: Array<{
    flowId: string;
    timestamp: number;
    action: string;
    details: object;
}> = [];

const stateMap = new Map<string, {
    status: TestFlowStatus;
    resources: object;
    metrics: object;
    lastUpdated: number;
}>();

// Constants for state management
const STATE_CHECK_INTERVAL = 5000;  // 5 seconds
const MAX_STATE_AGE = 3600000;     // 1 hour

/**
 * Decorator for error handling in state management functions
 */
function tryCatch(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
        try {
            return await originalMethod.apply(this, args);
        } catch (error) {
            console.error(`Error in ${propertyKey}:`, error);
            // Attempt retry for the operation
            return await retryTestExecution(args[0], 3);
        }
    };
    return descriptor;
}

/**
 * Initializes the state for a test flow
 * Implements requirement: State Management - Initialize state with proper configuration
 */
@tryCatch
export async function initializeState(testFlow: ITestFlow): Promise<void> {
    // Validate test flow input
    if (!testFlow || !testFlow.id) {
        throw new Error('Invalid test flow provided for state initialization');
    }

    // Create initial state entry
    const initialState = {
        status: TestFlowStatus.PENDING,
        resources: {},
        metrics: {
            startTime: Date.now(),
            retryCount: 0,
            lastCheckpoint: null
        },
        lastUpdated: Date.now()
    };

    // Allocate necessary resources
    const allocatedResources = await allocateResources(testFlow);
    initialState.resources = allocatedResources;

    // Update state map
    stateMap.set(testFlow.id, initialState);

    // Log state initialization
    stateLog.push({
        flowId: testFlow.id,
        timestamp: Date.now(),
        action: 'INITIALIZE',
        details: {
            flowName: testFlow.name,
            config: testFlow.config,
            resources: allocatedResources
        }
    });

    // Update test flow status in database
    await updateTestFlow(testFlow.id, {
        status: TestFlowStatus.RUNNING,
        config: {
            ...testFlow.config,
            stateInitialized: true
        }
    });

    // Set up state monitoring
    setupStateMonitoring(testFlow.id);
}

/**
 * Updates the state of a test flow
 * Implements requirement: State Management - Maintain consistency across updates
 */
@tryCatch
export async function updateState(
    testFlow: ITestFlow,
    stateUpdates: object
): Promise<void> {
    // Validate inputs
    if (!testFlow?.id || !stateUpdates) {
        throw new Error('Invalid parameters for state update');
    }

    // Get current state
    const currentState = stateMap.get(testFlow.id);
    if (!currentState) {
        throw new Error(`No state found for test flow: ${testFlow.id}`);
    }

    // Apply updates
    const updatedState = {
        ...currentState,
        ...stateUpdates,
        lastUpdated: Date.now()
    };

    // Update state map
    stateMap.set(testFlow.id, updatedState);

    // Log state update
    stateLog.push({
        flowId: testFlow.id,
        timestamp: Date.now(),
        action: 'UPDATE',
        details: {
            previousState: currentState,
            updates: stateUpdates,
            newState: updatedState
        }
    });

    // Persist state to database
    await updateTestFlow(testFlow.id, {
        status: updatedState.status,
        config: {
            ...testFlow.config,
            lastState: updatedState
        }
    });

    // Clean up stale states
    cleanupStaleStates();
}

/**
 * Retrieves the current state of a test flow
 * Implements requirement: State Management - Reliable state retrieval
 */
@tryCatch
export async function getState(testFlow: ITestFlow): Promise<object> {
    // Validate input
    if (!testFlow?.id) {
        throw new Error('Invalid test flow provided for state retrieval');
    }

    // Try to get state from memory
    let state = stateMap.get(testFlow.id);

    // If not in memory, try to recover from database
    if (!state) {
        const dbTestFlow = await getTestFlowById(testFlow.id);
        if (!dbTestFlow) {
            throw new Error(`Test flow not found: ${testFlow.id}`);
        }

        // Initialize state from database
        state = {
            status: dbTestFlow.status,
            resources: dbTestFlow.config.lastState?.resources || {},
            metrics: dbTestFlow.config.lastState?.metrics || {},
            lastUpdated: Date.now()
        };

        // Restore state to memory
        stateMap.set(testFlow.id, state);
    }

    // Return deep copy to prevent direct mutations
    return JSON.parse(JSON.stringify(state));
}

/**
 * Tracks the execution progress of a test flow
 * Implements requirement: Flow Test Execution - Track execution progress
 */
@tryCatch
export async function trackExecution(
    testFlow: ITestFlow,
    executionDetails: object
): Promise<void> {
    // Validate inputs
    if (!testFlow?.id || !executionDetails) {
        throw new Error('Invalid parameters for execution tracking');
    }

    // Get current state
    const currentState = stateMap.get(testFlow.id);
    if (!currentState) {
        throw new Error(`No state found for test flow: ${testFlow.id}`);
    }

    // Update metrics
    const updatedMetrics = {
        ...currentState.metrics,
        lastCheckpoint: Date.now(),
        executionProgress: executionDetails
    };

    // Update state with new metrics
    await updateState(testFlow, {
        metrics: updatedMetrics
    });

    // Log execution progress
    stateLog.push({
        flowId: testFlow.id,
        timestamp: Date.now(),
        action: 'TRACK_EXECUTION',
        details: {
            executionDetails,
            metrics: updatedMetrics
        }
    });
}

/**
 * Sets up monitoring for a test flow's state
 * @param flowId - ID of the test flow to monitor
 */
function setupStateMonitoring(flowId: string): void {
    setInterval(async () => {
        const state = stateMap.get(flowId);
        if (state) {
            // Check state health
            const stateAge = Date.now() - state.lastUpdated;
            if (stateAge > MAX_STATE_AGE) {
                // Log warning for stale state
                console.warn(`Stale state detected for flow: ${flowId}`);
                stateLog.push({
                    flowId,
                    timestamp: Date.now(),
                    action: 'STALE_STATE_WARNING',
                    details: { stateAge }
                });
            }
        }
    }, STATE_CHECK_INTERVAL);
}

/**
 * Cleans up stale states from memory
 */
function cleanupStaleStates(): void {
    const now = Date.now();
    for (const [flowId, state] of stateMap.entries()) {
        if (now - state.lastUpdated > MAX_STATE_AGE) {
            stateMap.delete(flowId);
            stateLog.push({
                flowId,
                timestamp: now,
                action: 'CLEANUP',
                details: {
                    reason: 'STALE_STATE',
                    stateAge: now - state.lastUpdated
                }
            });
        }
    }
}

// Export state management functions
export const stateManager = {
    initializeState,
    updateState,
    getState,
    trackExecution
};