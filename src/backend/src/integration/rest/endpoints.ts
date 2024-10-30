/**
 * endpoints.ts
 * Implements REST API endpoints for the backend system with comprehensive validation,
 * error handling, and logging.
 * 
 * This implements the following requirements:
 * 1. API Endpoints Definition - system_design/api_design/api_endpoints
 * 2. REST Integration - system_architecture/api_integration_layer
 * 
 * @version express: 4.17.1
 */

import express, { Request, Response, Router } from 'express';
import { makeRequest, RESTClientConfig } from './client';
import { 
    validateTestData, 
    validateTestFlow, 
    validateTestResult 
} from '../../utils/validators';
import errorHandler from '../../api/middleware/error.middleware';
import loggerMiddleware from '../../api/middleware/logger.middleware';

// Initialize express router
const router: Router = express.Router();

// Attach logger middleware for all routes
router.use(loggerMiddleware);

/**
 * POST /api/v1/flows
 * Handles test flow execution requests with validation and error handling
 */
const handleFlowExecution = async (req: Request, res: Response): Promise<void> => {
    try {
        // Validate incoming flow configuration
        const flowConfig = req.body;
        validateTestFlow(flowConfig);

        // Process flow execution request
        const response = await makeRequest<any>(
            'POST',
            '/execute-flow',
            flowConfig,
            {
                headers: {
                    'X-Flow-ID': flowConfig.id,
                    'X-Correlation-ID': req.id
                }
            }
        );

        res.status(202).json({
            success: true,
            data: {
                flow_id: flowConfig.id,
                status: 'INITIATED',
                execution_id: response.data.execution_id
            }
        });
    } catch (error) {
        // Pass error to error handler middleware
        errorHandler(error, req, res, () => {});
    }
};

/**
 * POST /api/v1/data
 * Handles test data generation requests with validation
 */
const handleDataGeneration = async (req: Request, res: Response): Promise<void> => {
    try {
        // Validate incoming test data
        const testData = req.body;
        validateTestData(testData);

        // Process data generation request
        const response = await makeRequest<any>(
            'POST',
            '/generate-data',
            testData,
            {
                headers: {
                    'X-Data-ID': testData.id,
                    'X-Correlation-ID': req.id
                }
            }
        );

        res.status(201).json({
            success: true,
            data: {
                data_id: testData.id,
                status: 'GENERATED',
                generation_details: response.data
            }
        });
    } catch (error) {
        errorHandler(error, req, res, () => {});
    }
};

/**
 * POST /api/v1/validate
 * Handles test result validation requests
 */
const handleResultValidation = async (req: Request, res: Response): Promise<void> => {
    try {
        // Validate incoming test results
        const testResult = req.body;
        validateTestResult(testResult);

        // Process validation request
        const response = await makeRequest<any>(
            'POST',
            '/validate-results',
            testResult,
            {
                headers: {
                    'X-Result-ID': testResult.id,
                    'X-Correlation-ID': req.id
                }
            }
        );

        res.status(200).json({
            success: true,
            data: {
                result_id: testResult.id,
                validation_status: response.data.status,
                validation_details: response.data.details
            }
        });
    } catch (error) {
        errorHandler(error, req, res, () => {});
    }
};

/**
 * GET /api/v1/reports
 * Retrieves test execution reports with optional filtering
 */
const handleReportRetrieval = async (req: Request, res: Response): Promise<void> => {
    try {
        const { 
            flow_id, 
            start_date, 
            end_date, 
            status 
        } = req.query;

        // Process report retrieval request
        const response = await makeRequest<any>(
            'GET',
            '/reports',
            {
                flow_id,
                start_date,
                end_date,
                status
            },
            {
                headers: {
                    'X-Correlation-ID': req.id
                }
            }
        );

        res.status(200).json({
            success: true,
            data: {
                reports: response.data.reports,
                pagination: response.data.pagination
            }
        });
    } catch (error) {
        errorHandler(error, req, res, () => {});
    }
};

/**
 * GET /api/v1/metrics
 * Retrieves test execution metrics and statistics
 */
const handleMetricsRetrieval = async (req: Request, res: Response): Promise<void> => {
    try {
        const { 
            metric_type, 
            time_range, 
            aggregation 
        } = req.query;

        // Process metrics retrieval request
        const response = await makeRequest<any>(
            'GET',
            '/metrics',
            {
                metric_type,
                time_range,
                aggregation
            },
            {
                headers: {
                    'X-Correlation-ID': req.id
                }
            }
        );

        res.status(200).json({
            success: true,
            data: {
                metrics: response.data.metrics,
                summary: response.data.summary
            }
        });
    } catch (error) {
        errorHandler(error, req, res, () => {});
    }
};

/**
 * Sets up all REST API endpoints with proper middleware, validation, and error handling
 * @param app - Express application instance
 */
export const setupEndpoints = (app: express.Application): void => {
    // Attach base middleware
    app.use('/api/v1', router);

    // Setup endpoints with handlers
    router.post('/flows', handleFlowExecution);
    router.post('/data', handleDataGeneration);
    router.post('/validate', handleResultValidation);
    router.get('/reports', handleReportRetrieval);
    router.get('/metrics', handleMetricsRetrieval);

    // Attach error handler as the last middleware
    app.use(errorHandler);
};