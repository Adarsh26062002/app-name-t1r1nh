/**
 * metricsRoutes.ts
 * Sets up API routes for handling metrics-related requests, providing endpoints for retrieving
 * test execution metrics, coverage data, and performance statistics.
 * 
 * Implements requirements:
 * - Metrics API Endpoints (system_design.api_design.api_endpoints)
 * - Component Responsibility (system_architecture.component_responsibilities)
 * 
 * @version express: 4.17.1
 */

import { Router } from 'express';
import { getMetrics, getMetricsByFlow } from '../controllers/metricsController';
import { authenticate } from '../middleware/auth.middleware';
import loggerMiddleware from '../middleware/logger.middleware';
import errorHandler from '../middleware/error.middleware';
import { validateRequest } from '../middleware/validation.middleware';

/**
 * Configures and sets up routes for metrics-related API operations
 * Implements requirement: Metrics API Endpoints - Provide endpoints for retrieving and analyzing test metrics
 * 
 * @param router - Express Router instance
 * @returns Configured router with metrics routes
 */
export const setupMetricsRoutes = (router: Router): Router => {
    // Apply authentication middleware to all metrics routes
    router.use(authenticate);

    // Apply logging middleware for request/response tracking
    router.use(loggerMiddleware);

    // GET /metrics - Retrieve overall metrics with filtering and aggregation support
    router.get(
        '/metrics',
        validateRequest,
        getMetrics
    );

    // GET /metrics/:flowId - Retrieve metrics for a specific test flow
    router.get(
        '/metrics/:flowId',
        validateRequest,
        getMetricsByFlow
    );

    // Apply error handling middleware
    router.use(errorHandler);

    return router;
};