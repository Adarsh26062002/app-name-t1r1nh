/**
 * flowController.ts
 * Implements the REST API controller for handling test flow-related requests.
 * Serves as the entry point for test flow execution in the system.
 * 
 * Implements requirements:
 * - Flow Execution API (system_design.api_design.api_endpoints)
 * - Component Integration (system_architecture.component_dependencies)
 * 
 * @version express: 4.17.1
 */

import { Request, Response, NextFunction } from 'express';
import { executeFlow as executeTestFlow, executeFlowStep } from '../../core/TestExecutor/flowExecutor';
import { scheduleTask } from '../../core/TestManager/taskScheduler';
import { trackExecution, getState } from '../../core/TestManager/stateManager';
import loggerMiddleware from '../middleware/logger.middleware';
import errorHandler from '../middleware/error.middleware';
import { ITestFlow, TestFlowStatus } from '../../types/test.types';

// Global execution timeout (5 minutes)
const EXECUTION_TIMEOUT = 300000;

/**
 * Validates test flow request body against ITestFlow interface
 */
const validateTestFlow = (flow: any): flow is ITestFlow => {
    return (
        flow &&
        typeof flow.id === 'string' &&
        typeof flow.config === 'object' &&
        Array.isArray(flow.config.steps) &&
        flow.config.steps.length > 0
    );
};

/**
 * Handles the execution of a test flow via POST /api/v1/flows endpoint
 * Implements requirement: Flow Execution API - Execute and manage test flows
 */
export const executeFlow = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Validate request body
        if (!validateTestFlow(req.body)) {
            throw new Error('Invalid test flow configuration');
        }

        const testFlow: ITestFlow = req.body;

        // Initialize execution tracking
        await trackExecution(testFlow, {
            startTime: Date.now(),
            status: TestFlowStatus.PENDING
        });

        // Schedule the test flow execution
        await scheduleTask(testFlow);

        // Begin flow execution
        const executionPromise = executeTestFlow(testFlow);

        // Set execution timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Flow execution timeout exceeded'));
            }, EXECUTION_TIMEOUT);
        });

        // Start execution with timeout
        Promise.race([executionPromise, timeoutPromise])
            .then(async () => {
                await trackExecution(testFlow, {
                    endTime: Date.now(),
                    status: TestFlowStatus.COMPLETED
                });
            })
            .catch(async (error) => {
                await trackExecution(testFlow, {
                    endTime: Date.now(),
                    status: TestFlowStatus.FAILED,
                    error: error.message
                });
                next(error);
            });

        // Return accepted response with tracking URL
        res.status(202).json({
            success: true,
            data: {
                flowId: testFlow.id,
                status: TestFlowStatus.PENDING,
                trackingUrl: `/api/v1/flows/${testFlow.id}/status`,
                message: 'Test flow execution initiated successfully'
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Retrieves the current status of a test flow execution
 * Implements requirement: Flow Execution API - Track flow execution status
 */
export const getFlowStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { flowId } = req.params;

        if (!flowId) {
            throw new Error('Flow ID is required');
        }

        // Get current execution state
        const executionState = await getState({
            id: flowId
        } as ITestFlow);

        // Return current status
        res.status(200).json({
            success: true,
            data: {
                flowId,
                status: executionState.status,
                progress: executionState.metrics,
                lastUpdated: executionState.lastUpdated
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Decorator for applying logger middleware to controller methods
 */
function withLogger(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
        const [req, res, next] = args;
        await loggerMiddleware(req, res, () => {});
        return originalMethod.apply(this, args);
    };

    return descriptor;
}

/**
 * Decorator for applying error handler to controller methods
 */
function withErrorHandler(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
        const [req, res, next] = args;
        try {
            await originalMethod.apply(this, args);
        } catch (error) {
            errorHandler(error, req, res, next);
        }
    };

    return descriptor;
}

// Apply decorators to controller methods
executeFlow = withLogger(flowController.prototype, 'executeFlow', {
    value: executeFlow
}).value;

executeFlow = withErrorHandler(flowController.prototype, 'executeFlow', {
    value: executeFlow
}).value;

getFlowStatus = withLogger(flowController.prototype, 'getFlowStatus', {
    value: getFlowStatus
}).value;

getFlowStatus = withErrorHandler(flowController.prototype, 'getFlowStatus', {
    value: getFlowStatus
}).value;

// Export controller methods
export const flowController = {
    executeFlow,
    getFlowStatus
};