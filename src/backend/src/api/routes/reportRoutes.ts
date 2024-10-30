/**
 * reportRoutes.ts
 * Sets up API routes for handling report-related requests with comprehensive security measures
 * and request validation.
 * 
 * Implements requirements:
 * - API Endpoints Integration (system_design/api_design/api_endpoints)
 * - Security Requirements (security_considerations/authentication_and_authorization)
 * 
 * @version express: 4.17.1
 */

import { Router } from 'express'; // @version express: 4.17.1
import { generateReport, getReport } from '../controllers/reportController';
import { authenticate, authorize } from '../middleware/auth.middleware';
import errorHandler from '../middleware/error.middleware';
import loggerMiddleware from '../middleware/logger.middleware';
import { validateRequest } from '../middleware/validation.middleware';

// Define allowed roles for report endpoints
const REPORT_ROLES = {
    GENERATE: ['test_admin', 'test_developer'],
    VIEW: ['test_admin', 'test_developer', 'report_viewer']
};

// Request validation schemas
const reportQuerySchema = {
    type: 'object',
    properties: {
        reportId: { type: 'string', required: true },
        format: { type: 'string', enum: ['HTML', 'CSV', 'JSON'] }
    }
};

const reportGenerationSchema = {
    type: 'object',
    properties: {
        testFlows: {
            type: 'array',
            items: {
                type: 'object',
                required: ['flowId', 'configuration']
            }
        },
        reportOptions: {
            type: 'object',
            required: ['format', 'includeMetrics']
        }
    },
    required: ['testFlows', 'reportOptions']
};

/**
 * Configures and returns the router for report-related endpoints
 * Implements comprehensive security measures and request validation
 * 
 * @returns Express Router configured with report routes
 */
export const setupRoutes = (): Router => {
    const router = Router();

    // Apply global middleware for all report routes
    router.use(loggerMiddleware);
    router.use(authenticate);

    // GET /api/v1/reports - Retrieve test reports
    // Implements requirement: API Endpoints Integration
    router.get(
        '/api/v1/reports',
        authorize(REPORT_ROLES.VIEW),
        validateRequest,
        async (req, res, next) => {
            try {
                await getReport(req, res, next);
            } catch (error) {
                next(error);
            }
        }
    );

    // POST /api/v1/reports - Generate new test reports
    // Implements requirements: API Endpoints Integration, Security Requirements
    router.post(
        '/api/v1/reports',
        authorize(REPORT_ROLES.GENERATE),
        validateRequest,
        async (req, res, next) => {
            try {
                await generateReport(req, res, next);
            } catch (error) {
                next(error);
            }
        }
    );

    // Apply error handling middleware last
    router.use(errorHandler);

    return router;
};

// Export the route setup function
export default setupRoutes;