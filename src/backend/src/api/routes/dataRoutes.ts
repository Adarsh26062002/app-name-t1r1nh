/**
 * dataRoutes.ts
 * Defines versioned RESTful API routes for test data management operations with proper middleware integration.
 * 
 * Implements requirements:
 * 1. Data Management API (system_design.api_design.api_endpoints)
 * 2. API Security (security_considerations.authentication_and_authorization)
 * 
 * @version express: 4.17.1
 */

import { Router } from 'express';
import { 
    createData, 
    getDataById, 
    updateData, 
    deleteData 
} from '../controllers/dataController';
import errorHandler from '../middleware/error.middleware';
import loggerMiddleware from '../middleware/logger.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';

/**
 * Sets up versioned routes for data management operations with proper middleware chain
 * Implements secure, validated, and logged data management endpoints
 * 
 * @param router - Express Router instance
 * @returns Configured Express Router with data management routes
 */
const setupDataRoutes = (router: Router): Router => {
    // Create a new router instance for data routes
    const dataRouter = Router();

    // Apply global middleware to all data routes
    dataRouter.use(loggerMiddleware);
    dataRouter.use(authenticate);

    // POST /api/v1/data - Create new test data
    // Requires: test_admin or test_developer role
    dataRouter.post(
        '/',
        authorize(['test_admin', 'test_developer']),
        validateRequest,
        createData
    );

    // GET /api/v1/data/:id - Retrieve test data by ID
    // Accessible by all authenticated users
    dataRouter.get(
        '/:id',
        authorize(['test_admin', 'test_developer', 'test_executor', 'report_viewer']),
        getDataById
    );

    // PUT /api/v1/data/:id - Update existing test data
    // Requires: test_admin or test_developer role
    dataRouter.put(
        '/:id',
        authorize(['test_admin', 'test_developer']),
        validateRequest,
        updateData
    );

    // DELETE /api/v1/data/:id - Delete test data
    // Requires: test_admin role only
    dataRouter.delete(
        '/:id',
        authorize(['test_admin']),
        deleteData
    );

    // Apply error handling middleware last
    dataRouter.use(errorHandler);

    // Mount the data router under the /api/v1/data path
    router.use('/api/v1/data', dataRouter);

    return router;
};

// Export the route setup function as default
export default setupDataRoutes;