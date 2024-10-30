/**
 * flowExecutor.ts
 * Core component responsible for executing test flows within the testing framework.
 * Manages the lifecycle of test execution including resource allocation, parallel execution,
 * response validation, and result reporting.
 * 
 * Implements requirements:
 * - Test Flow Execution (system_architecture/test_flow_execution)
 * - Component Dependencies (system_architecture/component_dependencies)
 * 
 * @version async: 3.2.0
 */

import { validateApiResponse } from './responseValidator';
import { retryTestExecution } from './retryHandler';
import { executeParallelTests } from './parallelExecutor';
import { allocateResources, deallocateResources } from '../TestManager/resourceManager';
import { scheduleTask } from '../TestManager/taskScheduler';
import { trackExecution } from '../TestManager/executionTracker';
import { reportTestResults } from '../TestReporter';
import { executeQuery } from '../../integration/graphql/client';
import { makeRequest } from '../../integration/rest/client';
import { executeQuery as executeDBQuery } from '../../db/clients/postgresql.client';
import { logInfo, logError, logWarning } from '../../utils/logger';

// Global execution tracking map
export const flowExecutionLog: Map<string, ExecutionLog[]> = new Map();

// Global constants
export const MAX_RETRY_ATTEMPTS = 3;
export const EXECUTION_TIMEOUT = 300000; // 5 minutes

// Interfaces for test flow execution
interface ExecutionLog {
    timestamp: Date;
    status: TestFlowStatus;
    message: string;
    metadata?: any;
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
        const testFlow = args[0];
        const startTime = new Date();

        try {
            // Track execution start
            await trackExecution(testFlow);
            
            // Execute original method
            const result = await originalMethod.apply(this, args);
            
            // Log successful execution
            logExecutionEvent(testFlow.id, {
                timestamp: new Date(),
                status: TestFlowStatus.COMPLETED,
                message: 'Test flow execution completed successfully',
                metadata: { duration: Date.now() - startTime.getTime() }
            });

            return result;
        } catch (error) {
            // Log execution failure
            logExecutionEvent(testFlow.id, {
                timestamp: new Date(),
                status: TestFlowStatus.FAILED,
                message: 'Test flow execution failed',
                metadata: { error: error.message }
            });
            throw error;
        }
    };

    return descriptor;
}

/**
 * Decorator for retry handling
 */
function withRetry(attempts: number) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            let lastError: Error;
            
            for (let i = 0; i < attempts; i++) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error) {
                    lastError = error;
                    if (i < attempts - 1) {
                        await retryTestExecution(args[0], attempts);
                    }
                }
            }
            
            throw lastError;
        };

        return descriptor;
    };
}

/**
 * Main class for executing test flows
 * Implements Test Flow Execution requirement
 */
export class FlowExecutor {
    /**
     * Executes a test flow with comprehensive lifecycle management
     */
    @trackExecutionDecorator
    @withRetry(MAX_RETRY_ATTEMPTS)
    public async executeFlow(
        testFlow: TestFlowModel,
        options: ExecutionOptions = {}
    ): Promise<ExecutionResult> {
        const startTime = new Date();
        const steps: StepResult[] = [];

        try {
            // Log execution start
            logExecutionEvent(testFlow.id, {
                timestamp: startTime,
                status: TestFlowStatus.RUNNING,
                message: 'Starting test flow execution'
            });

            // Allocate resources
            const resources = await allocateResources(testFlow);

            // Schedule task execution
            await scheduleTask(testFlow);

            // Execute test steps
            if (options.parallel && testFlow.config.steps.length > 1) {
                // Execute steps in parallel
                const parallelResults = await executeParallelTests(
                    testFlow.config.steps.map(step => ({
                        ...testFlow,
                        config: { ...testFlow.config, steps: [step] }
                    })),
                    {
                        maxConcurrent: options.maxConcurrent,
                        timeout: options.timeout
                    }
                );

                steps.push(...parallelResults.map(result => ({
                    stepId: result.flowId,
                    status: result.status,
                    duration: result.duration,
                    error: result.error
                })));
            } else {
                // Execute steps sequentially
                for (const step of testFlow.config.steps) {
                    const stepResult = await this.executeFlowStep(step, {
                        flowId: testFlow.id,
                        resources,
                        validateResponses: options.validateResponses
                    });
                    steps.push(stepResult);

                    if (stepResult.status === TestFlowStatus.FAILED) {
                        throw new Error(`Step execution failed: ${step.name}`);
                    }
                }
            }

            // Calculate execution metrics
            const endTime = new Date();
            const metrics = this.calculateExecutionMetrics(steps, startTime, endTime);

            // Generate execution result
            const result: ExecutionResult = {
                flowId: testFlow.id,
                status: TestFlowStatus.COMPLETED,
                startTime,
                endTime,
                duration: endTime.getTime() - startTime.getTime(),
                steps,
                metrics
            };

            // Report test results
            await reportTestResults(result);

            // Deallocate resources
            await deallocateResources(resources);

            return result;

        } catch (error) {
            const failureResult: ExecutionResult = {
                flowId: testFlow.id,
                status: TestFlowStatus.FAILED,
                startTime,
                endTime: new Date(),
                duration: Date.now() - startTime.getTime(),
                steps,
                error: error as Error,
                metrics: this.calculateExecutionMetrics(steps, startTime, new Date())
            };

            // Report failed test results
            await reportTestResults(failureResult);

            throw error;
        }
    }

    /**
     * Executes a single step within a test flow
     * Implements Test Flow Execution requirement for step-level execution
     */
    @trackExecutionDecorator
    private async executeFlowStep(
        step: TestFlowStep,
        context: {
            flowId: string;
            resources: any;
            validateResponses?: boolean;
        }
    ): Promise<StepResult> {
        const startTime = Date.now();

        try {
            let response: any;

            // Execute step based on type
            switch (step.type) {
                case 'graphql':
                    response = await executeQuery(
                        step.query,
                        step.variables,
                        step.config
                    );
                    break;

                case 'rest':
                    response = await makeRequest(
                        step.method,
                        step.url,
                        step.data,
                        step.config
                    );
                    break;

                case 'database':
                    response = await executeDBQuery(
                        step.query,
                        step.params
                    );
                    break;

                default:
                    throw new Error(`Unsupported step type: ${step.type}`);
            }

            // Validate response if required
            let validationResult: boolean | undefined;
            if (context.validateResponses) {
                validationResult = await validateApiResponse(
                    response,
                    step.expectedResponse,
                    { flowId: context.flowId }
                );

                if (!validationResult) {
                    throw new Error('Response validation failed');
                }
            }

            return {
                stepId: step.id,
                status: TestFlowStatus.COMPLETED,
                duration: Date.now() - startTime,
                response,
                validationResult
            };

        } catch (error) {
            return {
                stepId: step.id,
                status: TestFlowStatus.FAILED,
                duration: Date.now() - startTime,
                error: error as Error
            };
        }
    }

    /**
     * Calculates execution metrics for reporting
     */
    private calculateExecutionMetrics(
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
            averageStepDuration: totalDuration / steps.length
        };
    }
}

/**
 * Helper function to log execution events
 */
function logExecutionEvent(flowId: string, event: ExecutionLog): void {
    // Initialize log array if not exists
    if (!flowExecutionLog.has(flowId)) {
        flowExecutionLog.set(flowId, []);
    }

    // Add event to log
    flowExecutionLog.get(flowId)?.push(event);

    // Log event based on status
    switch (event.status) {
        case TestFlowStatus.RUNNING:
            logInfo(event.message, { flowId, ...event.metadata });
            break;
        case TestFlowStatus.COMPLETED:
            logInfo(event.message, { flowId, ...event.metadata });
            break;
        case TestFlowStatus.FAILED:
            logError(event.message, new Error(event.metadata?.error), { flowId });
            break;
        default:
            logWarning(event.message, { flowId, ...event.metadata });
    }
}

// Export flow executor functionality
export const flowExecutor = new FlowExecutor();