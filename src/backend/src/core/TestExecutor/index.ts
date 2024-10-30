/**
 * TestExecutor/index.ts
 * Entry point for the Test Executor module that orchestrates test flow execution by coordinating
 * parallel execution, retry handling, response validation, and resource management.
 * 
 * Implements requirements:
 * - Test Flow Execution (system_architecture/test_flow_execution)
 * - Component Integration (system_architecture/component_responsibilities)
 * 
 * @version async: 3.2.0
 */

// Import internal dependencies
import { executeFlow, executeFlowStep } from './flowExecutor';
import { executeParallelTests } from './parallelExecutor';
import { retryTestExecution } from './retryHandler';
import { validateApiResponse } from './responseValidator';
import { scheduleTask } from '../TestManager/taskScheduler';
import { allocateResources, deallocateResources } from '../TestManager/resourceManager';
import { trackExecution } from '../TestManager/executionTracker';
import { initializeState, updateState } from '../TestManager/stateManager';

// Import external dependencies
import * as async from 'async'; // v3.2.0

// Global execution tracking map
export const testExecutorLog: Map<string, ExecutionLog[]> = new Map();

// Global constants
export const MAX_CONCURRENT_TESTS = 5;
export const EXECUTION_TIMEOUT = 300000; // 5 minutes

// Interfaces
interface ExecutionLog {
    timestamp: Date;
    status: TestFlowStatus;
    message: string;
    metadata?: any;
}

interface ExecutorConfig {
    maxConcurrentTests?: number;
    executionTimeout?: number;
    retryAttempts?: number;
    validateResponses?: boolean;
    resourceRequirements?: {
        cpu?: number;
        memory?: number;
    };
}

interface ExecutionOptions {
    parallel?: boolean;
    maxConcurrent?: number;
    timeout?: number;
    retryAttempts?: number;
    validateResponses?: boolean;
}

interface ExecutionResult {
    flowId: string;
    status: TestFlowStatus;
    startTime: Date;
    endTime: Date;
    duration: number;
    steps: StepResult[];
    error?: Error;
    metrics: ExecutionMetrics;
}

interface StepResult {
    stepId: string;
    status: TestFlowStatus;
    duration: number;
    response?: any;
    error?: Error;
    validationResult?: boolean;
}

interface ExecutionMetrics {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    retryAttempts: number;
    averageStepDuration: number;
}

enum TestFlowStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

/**
 * Decorator for execution tracking
 */
function trackExecutionDecorator(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
        const startTime = new Date();
        const testFlows = args[0];

        try {
            // Track execution start
            await trackExecution(Array.isArray(testFlows) ? testFlows[0] : testFlows);
            
            // Execute original method
            const result = await originalMethod.apply(this, args);
            
            // Log successful execution
            logExecutionEvent(Array.isArray(testFlows) ? testFlows[0].id : testFlows.id, {
                timestamp: new Date(),
                status: TestFlowStatus.COMPLETED,
                message: 'Test execution completed successfully',
                metadata: { duration: Date.now() - startTime.getTime() }
            });

            return result;
        } catch (error) {
            // Log execution failure
            logExecutionEvent(Array.isArray(testFlows) ? testFlows[0].id : testFlows.id, {
                timestamp: new Date(),
                status: TestFlowStatus.FAILED,
                message: 'Test execution failed',
                metadata: { error: (error as Error).message }
            });
            throw error;
        }
    };

    return descriptor;
}

/**
 * Initializes the test executor module with provided configuration
 * Implements requirement: Test Flow Execution - Initialize execution environment
 */
export async function initializeTestExecutor(config: ExecutorConfig): Promise<void> {
    try {
        // Validate configuration
        if (config.maxConcurrentTests && config.maxConcurrentTests <= 0) {
            throw new Error('maxConcurrentTests must be greater than 0');
        }

        if (config.executionTimeout && config.executionTimeout <= 0) {
            throw new Error('executionTimeout must be greater than 0');
        }

        // Initialize execution tracking system
        testExecutorLog.clear();

        // Set up resource management pools
        await allocateResources({
            id: 'system',
            name: 'TestExecutor',
            config: {
                parameters: {
                    resourceCapacity: config.resourceRequirements?.cpu || 100
                }
            }
        });

        // Configure state management system
        await initializeState({
            id: 'system',
            name: 'TestExecutor',
            config: {
                maxConcurrentTests: config.maxConcurrentTests || MAX_CONCURRENT_TESTS,
                executionTimeout: config.executionTimeout || EXECUTION_TIMEOUT
            }
        });

        // Log successful initialization
        logExecutionEvent('system', {
            timestamp: new Date(),
            status: TestFlowStatus.COMPLETED,
            message: 'Test executor initialized successfully',
            metadata: { config }
        });

    } catch (error) {
        logExecutionEvent('system', {
            timestamp: new Date(),
            status: TestFlowStatus.FAILED,
            message: 'Test executor initialization failed',
            metadata: { error: (error as Error).message }
        });
        throw error;
    }
}

/**
 * Executes a suite of test flows with comprehensive orchestration
 * Implements requirement: Test Flow Execution - Coordinate test execution
 */
@trackExecutionDecorator
export async function executeTestSuite(
    testFlows: TestFlowModel[],
    options: ExecutionOptions = {}
): Promise<ExecutionResult[]> {
    if (!testFlows?.length) {
        throw new Error('No test flows provided for execution');
    }

    const startTime = new Date();
    const results: ExecutionResult[] = [];

    try {
        // Initialize execution state for each flow
        await Promise.all(testFlows.map(flow => 
            initializeState(flow)
        ));

        // Allocate required resources for the suite
        const resources = await allocateResources({
            id: 'suite',
            name: 'TestSuite',
            config: {
                parameters: {
                    resourceCapacity: testFlows.length * 20 // 20% capacity per test
                }
            }
        });

        // Schedule flows using task scheduler
        await Promise.all(testFlows.map(flow =>
            scheduleTask(flow)
        ));

        // Execute flows based on parallel option
        if (options.parallel) {
            // Execute flows in parallel
            const parallelResults = await executeParallelTests(
                testFlows,
                {
                    maxConcurrent: options.maxConcurrent || MAX_CONCURRENT_TESTS,
                    timeout: options.timeout || EXECUTION_TIMEOUT
                }
            );

            results.push(...parallelResults.map(result => ({
                ...result,
                startTime,
                endTime: new Date(),
                steps: [],
                metrics: calculateExecutionMetrics([], startTime, new Date())
            })));
        } else {
            // Execute flows sequentially
            for (const flow of testFlows) {
                try {
                    const flowStartTime = new Date();
                    const flowResult = await executeFlow(flow, {
                        timeout: options.timeout,
                        validateResponses: options.validateResponses
                    });

                    // Validate responses if required
                    if (options.validateResponses) {
                        for (const step of flowResult.steps) {
                            if (step.response) {
                                step.validationResult = await validateApiResponse(
                                    step.response,
                                    flow.config.expectedResponse,
                                    flow
                                );
                            }
                        }
                    }

                    results.push({
                        flowId: flow.id,
                        status: TestFlowStatus.COMPLETED,
                        startTime: flowStartTime,
                        endTime: new Date(),
                        duration: Date.now() - flowStartTime.getTime(),
                        steps: flowResult.steps,
                        metrics: calculateExecutionMetrics(
                            flowResult.steps,
                            flowStartTime,
                            new Date()
                        )
                    });

                } catch (error) {
                    // Handle flow execution failure
                    if (options.retryAttempts) {
                        const retrySuccess = await retryTestExecution(flow, options.retryAttempts);
                        if (!retrySuccess) {
                            results.push(createFailedResult(flow, error as Error, startTime));
                        }
                    } else {
                        results.push(createFailedResult(flow, error as Error, startTime));
                    }
                }
            }
        }

        // Update execution state
        await Promise.all(testFlows.map(flow =>
            updateState(flow, {
                status: TestFlowStatus.COMPLETED,
                results: results.find(r => r.flowId === flow.id)
            })
        ));

        // Release allocated resources
        await deallocateResources(resources);

        return results;

    } catch (error) {
        // Handle suite execution failure
        await Promise.all(testFlows.map(flow =>
            updateState(flow, {
                status: TestFlowStatus.FAILED,
                error: (error as Error).message
            })
        ));

        throw error;
    }
}

/**
 * Helper function to calculate execution metrics
 */
function calculateExecutionMetrics(
    steps: StepResult[],
    startTime: Date,
    endTime: Date
): ExecutionMetrics {
    const successfulSteps = steps.filter(
        step => step.status === TestFlowStatus.COMPLETED
    ).length;

    const failedSteps = steps.filter(
        step => step.status === TestFlowStatus.FAILED
    ).length;

    const totalDuration = steps.reduce(
        (sum, step) => sum + step.duration,
        0
    );

    return {
        totalSteps: steps.length,
        successfulSteps,
        failedSteps,
        retryAttempts: steps.filter(step => step.error).length,
        averageStepDuration: steps.length ? totalDuration / steps.length : 0
    };
}

/**
 * Helper function to create a failed execution result
 */
function createFailedResult(
    flow: TestFlowModel,
    error: Error,
    startTime: Date
): ExecutionResult {
    return {
        flowId: flow.id,
        status: TestFlowStatus.FAILED,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        steps: [],
        error,
        metrics: {
            totalSteps: 0,
            successfulSteps: 0,
            failedSteps: 0,
            retryAttempts: 0,
            averageStepDuration: 0
        }
    };
}

/**
 * Helper function to log execution events
 */
function logExecutionEvent(flowId: string, event: ExecutionLog): void {
    // Initialize log array if not exists
    if (!testExecutorLog.has(flowId)) {
        testExecutorLog.set(flowId, []);
    }

    // Add event to log
    testExecutorLog.get(flowId)?.push(event);
}