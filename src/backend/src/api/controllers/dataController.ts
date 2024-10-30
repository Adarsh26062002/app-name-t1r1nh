/**
 * dataController.ts
 * Implements RESTful API controller for handling test data operations, managing the flow
 * of data between clients and the test data storage system.
 * 
 * Implements requirements:
 * 1. Data Management API (system_design.api_design.api_endpoints)
 * 2. Test Data Management (system_architecture.component_responsibilities)
 * 
 * @version express: 4.17.1
 */

import { Request, Response, NextFunction } from 'express';
import errorHandler from '../middleware/error.middleware';
import loggerMiddleware from '../middleware/logger.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import {
    createTestData,
    getTestDataById,
    updateTestData,
    deleteTestData,
    getActiveTestData
} from '../../db/repositories/testData.repository';
import { logInfo, logError } from '../../utils/logger';

/**
 * Creates a new test data entry with validation
 * POST /api/v1/data
 */
export const createData = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Log incoming request
        logInfo('Creating new test data', {
            correlationId: req.id,
            requestBody: req.body
        });

        // Validate request body
        await validateRequest(req, res, next);

        // Create test data entry
        const createdData = await createTestData(req.body);

        // Log successful creation
        logInfo('Test data created successfully', {
            correlationId: req.id,
            dataId: createdData.id
        });

        // Send success response
        res.status(201).json({
            success: true,
            data: createdData
        });
    } catch (error) {
        // Log error and pass to error handler
        logError('Failed to create test data', error as Error, {
            correlationId: req.id,
            requestBody: req.body
        });
        next(error);
    }
};

/**
 * Retrieves test data by ID
 * GET /api/v1/data/:id
 */
export const getDataById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        // Log request
        logInfo('Retrieving test data by ID', {
            correlationId: req.id,
            dataId: id
        });

        // Get test data
        const testData = await getTestDataById(id);

        if (!testData) {
            // Log not found
            logInfo('Test data not found', {
                correlationId: req.id,
                dataId: id
            });

            res.status(404).json({
                success: false,
                error: {
                    message: 'Test data not found'
                }
            });
            return;
        }

        // Log successful retrieval
        logInfo('Test data retrieved successfully', {
            correlationId: req.id,
            dataId: id
        });

        // Send success response
        res.status(200).json({
            success: true,
            data: testData
        });
    } catch (error) {
        // Log error and pass to error handler
        logError('Failed to retrieve test data', error as Error, {
            correlationId: req.id,
            dataId: req.params.id
        });
        next(error);
    }
};

/**
 * Updates existing test data
 * PUT /api/v1/data/:id
 */
export const updateData = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        // Log update request
        logInfo('Updating test data', {
            correlationId: req.id,
            dataId: id,
            updateData: req.body
        });

        // Validate request body
        await validateRequest(req, res, next);

        // Check if data exists
        const existingData = await getTestDataById(id);
        if (!existingData) {
            res.status(404).json({
                success: false,
                error: {
                    message: 'Test data not found'
                }
            });
            return;
        }

        // Update test data
        const updatedData = await updateTestData(id, req.body);

        // Log successful update
        logInfo('Test data updated successfully', {
            correlationId: req.id,
            dataId: id
        });

        // Send success response
        res.status(200).json({
            success: true,
            data: updatedData
        });
    } catch (error) {
        // Log error and pass to error handler
        logError('Failed to update test data', error as Error, {
            correlationId: req.id,
            dataId: req.params.id,
            updateData: req.body
        });
        next(error);
    }
};

/**
 * Deletes test data by ID
 * DELETE /api/v1/data/:id
 */
export const deleteData = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        // Log deletion request
        logInfo('Deleting test data', {
            correlationId: req.id,
            dataId: id
        });

        // Check if data exists
        const existingData = await getTestDataById(id);
        if (!existingData) {
            res.status(404).json({
                success: false,
                error: {
                    message: 'Test data not found'
                }
            });
            return;
        }

        // Delete test data
        await deleteTestData(id);

        // Log successful deletion
        logInfo('Test data deleted successfully', {
            correlationId: req.id,
            dataId: id
        });

        // Send success response
        res.status(204).send();
    } catch (error) {
        // Log error and pass to error handler
        logError('Failed to delete test data', error as Error, {
            correlationId: req.id,
            dataId: req.params.id
        });
        next(error);
    }
};

// Apply middleware to all routes
const applyMiddleware = (router: any): void => {
    router.use(loggerMiddleware);
    router.use(errorHandler);
};

// Export controller functions and middleware
export const dataController = {
    createData,
    getDataById,
    updateData,
    deleteData,
    applyMiddleware
};