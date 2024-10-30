/**
 * metricsController.ts
 * Implements the controller for handling metrics-related API requests, providing endpoints
 * to retrieve and analyze test execution metrics, coverage data, and performance statistics.
 * 
 * Implements requirements:
 * - Metrics API Endpoints (system_design.api_design.api_endpoints)
 * - Test Results Analysis (system_architecture.component_responsibilities)
 * 
 * @version express: 4.17.1
 * @version lodash: 4.17.21
 */

import { Request, Response, NextFunction } from 'express';
import _ from 'lodash'; // v4.17.21
import { 
    trackExecution,
    executionEmitter 
} from '../../core/TestManager/executionTracker';
import { 
    calculateCoverage,
    calculateMetricPercentage 
} from '../../core/TestReporter/coverageCalculator';
import { exportResults } from '../../core/TestReporter/resultExporter';
import { 
    logInfo,
    logError 
} from '../../utils/logger';
import errorHandler from '../middleware/error.middleware';

// Cache duration for metrics results (5 minutes)
const METRICS_CACHE_DURATION = 300000;

// Default limit for metrics results
const DEFAULT_METRICS_LIMIT = 100;

// Cache storage for metrics results
const metricsCache = new Map<string, {
    data: any;
    timestamp: number;
}>();

/**
 * Decorator for try-catch error handling
 */
function tryCatch(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        try {
            return await originalMethod.apply(this, args);
        } catch (error) {
            const next = args[2];
            next(error);
        }
    };
    return descriptor;
}

/**
 * Decorator for logging middleware
 */
function loggerMiddleware(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        const [req] = args;
        logInfo(`Metrics API Request: ${propertyKey}`, {
            method: req.method,
            path: req.path,
            query: req.query
        });
        return originalMethod.apply(this, args);
    };
    return descriptor;
}

/**
 * Handles GET requests to retrieve test metrics with support for filtering and aggregation
 * Implements requirement: Metrics API Endpoints - Provide endpoints for retrieving and analyzing test metrics
 */
@tryCatch
@loggerMiddleware
async function getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    const {
        startDate,
        endDate,
        type = 'execution',
        format = 'json',
        limit = DEFAULT_METRICS_LIMIT,
        aggregate = false
    } = req.query;

    // Generate cache key based on query parameters
    const cacheKey = JSON.stringify({ startDate, endDate, type, format, limit, aggregate });
    
    // Check cache first
    const cachedResult = metricsCache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < METRICS_CACHE_DURATION) {
        res.json(cachedResult.data);
        return;
    }

    try {
        // Validate date range
        const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 86400000);
        const end = endDate ? new Date(endDate as string) : new Date();

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new Error('Invalid date range provided');
        }

        // Track execution metrics
        const executionMetrics = await trackExecution({
            startDate: start,
            endDate: end,
            limit: Number(limit)
        });

        // Calculate coverage metrics if requested
        let coverageMetrics = [];
        if (type === 'coverage' || type === 'all') {
            coverageMetrics = await calculateCoverage(executionMetrics.map(m => m.flow));
        }

        // Aggregate metrics if requested
        let metrics = type === 'coverage' ? coverageMetrics : executionMetrics;
        if (aggregate === 'true') {
            metrics = aggregateMetrics(metrics, type as string);
        }

        // Export results in requested format
        const exportedResults = await exportResults(
            metrics,
            [format as string],
            {
                includeMetrics: true,
                prettify: true
            }
        );

        // Cache the results
        const result = {
            success: true,
            data: metrics,
            metadata: {
                startDate: start,
                endDate: end,
                type,
                count: metrics.length,
                format: exportedResults[0]
            }
        };

        metricsCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });

        res.json(result);

        // Log successful operation
        logInfo('Metrics retrieved successfully', {
            type,
            count: metrics.length,
            startDate: start,
            endDate: end
        });

    } catch (error) {
        next(error);
    }
}

/**
 * Retrieves metrics for a specific test flow
 * Implements requirement: Test Results Analysis - Analyze test results and generate metrics
 */
@tryCatch
@loggerMiddleware
async function getMetricsByFlow(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { flowId } = req.params;
    const { type = 'execution' } = req.query;

    if (!flowId) {
        throw new Error('Flow ID is required');
    }

    try {
        // Track flow-specific execution metrics
        const executionMetrics = await trackExecution({
            flowId,
            limit: 1
        });

        if (!executionMetrics.length) {
            res.status(404).json({
                success: false,
                error: {
                    message: 'No metrics found for the specified flow'
                }
            });
            return;
        }

        // Calculate flow-specific coverage metrics if requested
        let metrics = executionMetrics;
        if (type === 'coverage' || type === 'all') {
            const coverageMetrics = await calculateCoverage([executionMetrics[0].flow]);
            metrics = type === 'coverage' ? coverageMetrics : {
                ...executionMetrics[0],
                coverage: coverageMetrics[0]
            };
        }

        // Export flow metrics
        const exportedResults = await exportResults(
            [metrics],
            ['json'],
            {
                includeMetrics: true,
                prettify: true,
                filename: `flow-${flowId}-metrics`
            }
        );

        res.json({
            success: true,
            data: metrics,
            metadata: {
                flowId,
                type,
                exportPath: exportedResults[0].path
            }
        });

        // Log successful operation
        logInfo('Flow metrics retrieved successfully', {
            flowId,
            type,
            metricsCount: metrics.length
        });

    } catch (error) {
        next(error);
    }
}

/**
 * Aggregates metrics based on type and calculation rules
 */
function aggregateMetrics(metrics: any[], type: string): any {
    if (!metrics.length) return [];

    switch (type) {
        case 'execution':
            return {
                totalExecutions: metrics.length,
                averageDuration: _.meanBy(metrics, 'duration_ms'),
                successRate: calculateMetricPercentage(
                    'success',
                    metrics.filter(m => m.status === 'success').length,
                    metrics.length
                ),
                failureRate: calculateMetricPercentage(
                    'failure',
                    metrics.filter(m => m.status === 'failure').length,
                    metrics.length
                ),
                executionsByStatus: _.groupBy(metrics, 'status')
            };

        case 'coverage':
            return {
                averageCoverage: _.meanBy(metrics, 'summary.overallPercentage'),
                coverageByType: {
                    line: _.meanBy(metrics, 'metrics.line.percentage'),
                    branch: _.meanBy(metrics, 'metrics.branch.percentage'),
                    function: _.meanBy(metrics, 'metrics.function.percentage'),
                    statement: _.meanBy(metrics, 'metrics.statement.percentage')
                },
                totalCovered: _.sumBy(metrics, 'summary.totalCovered'),
                totalPossible: _.sumBy(metrics, 'summary.totalPossible')
            };

        default:
            return metrics;
    }
}

// Set up execution event listeners
executionEmitter.on('executionStarted', (data) => {
    logInfo('Test execution started', data);
});

executionEmitter.on('executionCompleted', (data) => {
    logInfo('Test execution completed', data);
});

executionEmitter.on('executionFailed', (data) => {
    logError('Test execution failed', new Error(data.error), data);
});

// Export controller functions
export {
    getMetrics,
    getMetricsByFlow
};