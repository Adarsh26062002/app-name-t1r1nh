/**
 * index.ts
 * Central entry point for all API routes that integrates data, metrics, report, and flow routes
 * into a single router instance with proper middleware chain and versioning support.
 * 
 * Implements requirements:
 * 1. API Endpoints Integration (system_design.api_design.api_endpoints)
 * 2. Component Integration (system_architecture.component_responsibilities)
 * 
 * @version express: 4.17.1
 */

import { Router } from 'express';
import setupDataRoutes from './dataRoutes';
import { setupMetricsRoutes } from './metricsRoutes';
import { setupRoutes } from './reportRoutes';
import { setupFlowRoutes } from './flowRoutes';

/**
 * Initializes and integrates all API routes into a single router instance with proper
 * versioning and middleware chain. Creates a modular routing architecture following
 * REST principles.
 * 
 * Implements requirements:
 * - API Endpoints Integration: Integrate all API endpoints for data, metrics, reports,
 *   and flows into a single entry point with versioned routes (/api/v1/*)
 * - Component Integration: Expose Test Reporter, Test Manager, and Data Generator
 *   functionalities through REST endpoints
 * 
 * @returns The configured Express Router instance with all integrated routes
 */
const initializeRoutes = (): Router => {
    // Initialize the main API router
    const router = Router();

    // Mount data management routes at /api/v1/data
    // Provides endpoints for test data CRUD operations
    setupDataRoutes(router);

    // Mount metrics retrieval routes at /api/v1/metrics
    // Provides endpoints for test execution metrics and analytics
    setupMetricsRoutes(router);

    // Mount report generation routes at /api/v1/reports
    // Provides endpoints for test report generation and retrieval
    setupRoutes(router);

    // Mount flow execution routes at /api/v1/flows
    // Provides endpoints for test flow execution and management
    setupFlowRoutes(router);

    return router;
};

// Export the route initialization function as default
export default initializeRoutes;