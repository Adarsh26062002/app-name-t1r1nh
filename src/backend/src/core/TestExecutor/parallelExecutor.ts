/**
 * parallelExecutor.ts
 * Implements parallel execution logic for test flows with resource management and retry capabilities.
 * 
 * Implements requirements:
 * - Parallel Test Execution (system_architecture/component_responsibilities)
 * - Flow Test Execution (system_architecture/component_responsibilities)
 * 
 * @version async: 3.2.0
 * @version p-limit: 4.0.0
 */

import * as async from 'async';
import pLimit from 'p-limit';
import { retryTestExecution } from './retryHandler';
import { logInfo, logError, logWarning } from '../../utils/logger';
import { TestFlowModel, TestFlowStatus } from '../../types/test.types';

// Global constants from environment or defaults
const MAX_CONCURRENT_EXECUTIONS = Number(process.env.MAX_CONCURRENT_EXECUTIONS) || 5;
const EXECUTION_TIMEOUT_MS = 60000;

/**
 * Interface for parallel execution options
 */
interface ParallelExecutionOptions {
    maxConcurrent?: number;
    timeout?: number;
    priorityGroups?: boolean;
    resourceMonitoring?: boolean;
}

/**
 * Interface for execution result metrics
 */
interface ExecutionResult {
    flowId: string;
    status: TestFlowStatus;
    duration: number;
    retryCount: number;
    error?: Error;
    resourceMetrics?: ResourceMetrics;
}

/**
 * Interface for resource usage metrics
 */
interface ResourceMetrics {
    cpuUsage: number;
    memoryUsage: number;
    timestamp: number;
}

/**
 * Interface for execution state tracking
 */
interface ExecutionState {
    status: TestFlowStatus;
    startTime: number;
    retryCount: number;
    resourceMetrics: ResourceMetrics[];
}

/**
 * Class to track parallel execution progress and resource usage
 */
export class ParallelExecutionTracker {
    private executionStates: Map<string, ExecutionState>;
    private completedExecutions: number;
    private resourceUsage: ResourceMetrics;

    constructor() {
        this.executionStates = new Map();
        this.completedExecutions = 0;
        this.resourceUsage = {
            cpuUsage: 0,
            memoryUsage: 0,
            timestamp: Date.now()
        };
        this.initializeResourceMonitoring();
    }

    /**
     * Tracks execution state for a test flow
     */
    public trackExecution(flowId: string, state: ExecutionState): void {
        this.executionStates.set(flowId, state);
        
        if (state.status === TestFlowStatus.COMPLETED || 
            state.status === TestFlowStatus.FAILED) {
            this.completedExecutions++;
        }

        this.updateResourceMetrics(state.resourceMetrics);
        this.logExecutionProgress(flowId, state);
    }

    /**
     * Initializes resource monitoring
     */
    private initializeResourceMonitoring(): void {
        setInterval(() => {
            const metrics = this.getCurrentResourceMetrics();
            this.resourceUsage = metrics;
            
            if (metrics.cpuUsage > 80 || metrics.memoryUsage > 80) {
                logWarning('High resource utilization detected', {
                    metrics,
                    activeExecutions: this.executionStates.size
                });
            }
        }, 5000);
    }

    /**
     * Updates resource metrics
     */
    private updateResourceMetrics(metrics: ResourceMetrics[]): void {
        if (!metrics.length) return;
        
        const latestMetric = metrics[metrics.length - 1];
        this.resourceUsage = {
            ...this.resourceUsage,
            ...latestMetric
        };
    }

    /**
     * Gets current resource metrics
     */
    private getCurrentResourceMetrics(): ResourceMetrics {
        const usage = process.memoryUsage();
        return {
            cpuUsage: process.cpuUsage().user / 1000000,
            memoryUsage: (usage.heapUsed / usage.heapTotal) * 100,
            timestamp: Date.now()
        };
    }

    /**
     * Logs execution progress
     */
    private logExecutionProgress(flowId: string, state: ExecutionState): void {
        logInfo('Test execution progress update', {
            flowId,
            status: state.status,
            duration: Date.now() - state.startTime,
            retryCount: state.retryCount,
            resourceMetrics: this.resourceUsage
        });
    }
}

/**
 * Creates an execution promise for a single test flow
 */
async function createExecutionPromise(
    testFlow: TestFlowModel,
    options: ParallelExecutionOptions,
    tracker: ParallelExecutionTracker
): Promise<ExecutionResult> {
    const startTime = Date.now();
    const state: ExecutionState = {
        status: TestFlowStatus.RUNNING,
        startTime,
        retryCount: 0,
        resourceMetrics: []
    };

    tracker.trackExecution(testFlow.id, state);

    try {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Execution timeout after ${options.timeout}ms`));
            }, options.timeout || EXECUTION_TIMEOUT_MS);
        });

        const executionPromise = async () => {
            const success = await retryTestExecution(testFlow);
            if (!success) {
                throw new Error('Test execution failed after retries');
            }
            return success;
        };

        await Promise.race([executionPromise(), timeoutPromise]);

        state.status = TestFlowStatus.COMPLETED;
        tracker.trackExecution(testFlow.id, state);

        return {
            flowId: testFlow.id,
            status: TestFlowStatus.COMPLETED,
            duration: Date.now() - startTime,
            retryCount: state.retryCount,
            resourceMetrics: state.resourceMetrics
        };
    } catch (error) {
        state.status = TestFlowStatus.FAILED;
        tracker.trackExecution(testFlow.id, state);

        return {
            flowId: testFlow.id,
            status: TestFlowStatus.FAILED,
            duration: Date.now() - startTime,
            retryCount: state.retryCount,
            error: error as Error,
            resourceMetrics: state.resourceMetrics
        };
    }
}

/**
 * Executes multiple test flows in parallel with resource management
 */
export async function executeParallelTests(
    testFlows: TestFlowModel[],
    options: ParallelExecutionOptions = {}
): Promise<ExecutionResult[]> {
    if (!testFlows.length) {
        throw new Error('No test flows provided for execution');
    }

    const tracker = new ParallelExecutionTracker();
    const limit = pLimit(options.maxConcurrent || MAX_CONCURRENT_EXECUTIONS);
    
    // Group test flows by priority if enabled
    const prioritizedFlows = options.priorityGroups
        ? testFlows.sort((a, b) => (b.config?.priority || 0) - (a.config?.priority || 0))
        : testFlows;

    logInfo('Starting parallel test execution', {
        flowCount: testFlows.length,
        maxConcurrent: options.maxConcurrent || MAX_CONCURRENT_EXECUTIONS,
        timeout: options.timeout || EXECUTION_TIMEOUT_MS
    });

    try {
        // Create execution promises for all flows
        const executionPromises = prioritizedFlows.map(testFlow =>
            limit(() => createExecutionPromise(testFlow, options, tracker))
        );

        // Execute all promises with progress tracking
        const results = await Promise.all(executionPromises);

        logInfo('Parallel test execution completed', {
            totalExecutions: results.length,
            successCount: results.filter(r => r.status === TestFlowStatus.COMPLETED).length,
            failureCount: results.filter(r => r.status === TestFlowStatus.FAILED).length
        });

        return results;
    } catch (error) {
        logError('Parallel test execution failed', error as Error, {
            flowCount: testFlows.length
        });
        throw error;
    }
}