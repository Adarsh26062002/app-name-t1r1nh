/**
 * flowRoutes.ts
 * Configures and exposes the API routes for managing test flows, including execution,
 * tracking, and status reporting. Implements secure endpoints with authentication,
 * authorization, validation, and error handling.
 * 
 * Implements requirements:
 * 1. Flow Execution API (system_design.api_design.api_endpoints)
 * 2. API Security (security_considerations.authentication_and_authorization)
 * 
 * @version express: 4.17.1
 */

import { Router } from 'express'; // @version express: 4.17.1
import { executeFlow, getFlowStatus } from '../controllers/flowController';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import errorHandler from '../middleware/error.middleware';
import loggerMiddleware from '../middleware/logger.middleware';

/**
 * Configures and returns an Express router with secured endpoints for test flow management
 * Implements Flow Execution API requirement with secure endpoints for flow execution and status tracking
 * 
 * @param router - Express Router instance
 * @returns Configured Express router with flow management endpoints
 */
export const setupFlowRoutes = (router: Router): Router => {
    // Apply logger middleware to all routes in this router
    router.use(loggerMiddleware);

    // Apply authentication middleware to secure all routes
    router.use(authenticate);

    /**
     * POST /api/v1/flows
     * Execute a new test flow with the provided configuration
     * 
     * Required roles: test_admin, test_executor
     * Request body: ITestFlow configuration
     * Response: 202 Accepted with tracking URL
     */
    router.post(
        '/api/v1/flows',
        [
            // Authorize only test administrators and executors
            authorize(['test_admin', 'test_executor']),
            // Validate request body against flow schema
            validateRequest
        ],
        executeFlow
    );

    /**
     * GET /api/v1/flows/:id
     * Retrieve the current status of a test flow execution
     * 
     * Required roles: test_admin, test_executor, report_viewer
     * Parameters: flowId - The ID of the flow to check
     * Response: 200 OK with current flow status
     */
    router.get(
        '/api/v1/flows/:id',
        [
            // Authorize test administrators, executors, and report viewers
            authorize(['test_admin', 'test_executor', 'report_viewer'])
        ],
        getFlowStatus
    );

    // Apply error handling middleware
    router.use(errorHandler);

    return router;
};

/**
 * Factory function to create and configure a new flow router instance
 * Provides a clean way to initialize the flow routes
 * 
 * @returns Configured Express router for flow management
 */
export const createFlowRouter = (): Router => {
    const router = Router();
    return setupFlowRoutes(router);
};

// Export the setup function as the default export
export default setupFlowRoutes;