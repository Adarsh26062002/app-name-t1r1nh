/**
 * app.ts
 * Main entry point for the backend application that initializes and configures
 * the Express server with comprehensive middleware setup, security measures,
 * and API route initialization.
 * 
 * This implements the following requirements:
 * 1. Application Initialization - system_architecture/high-level_architecture_overview
 * 2. Security Implementation - security_considerations/authentication_and_authorization
 * 3. Logging Configuration - system_architecture/component_configuration
 * 
 * @version express: 4.17.1
 * @version cors: 2.8.5
 * @version helmet: 4.6.0
 * @version compression: 1.7.4
 * @version express-rate-limit: 5.3.0
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Import configurations
import { loggerConfig } from './config/logger.config';
import { apiConfig } from './config/api.config';

// Import middleware
import errorHandler from './api/middleware/error.middleware';
import loggerMiddleware from './api/middleware/logger.middleware';
import { validateRequest } from './api/middleware/validation.middleware';
import { authenticate, authorize } from './api/middleware/auth.middleware';

// Import route initialization
import initializeRoutes from './api/routes/index';

// Import logging utilities
import { logInfo, logError } from './utils/logger';

/**
 * Initializes and configures the Express application with all necessary
 * middleware, security measures, and routes.
 * 
 * @returns {Express} The configured Express application instance
 */
const initializeApp = (): Express => {
    // Create Express application instance
    const app: Express = express();

    try {
        // Configure security middleware
        configureSecurityMiddleware(app);

        // Configure standard middleware
        configureStandardMiddleware(app);

        // Configure logging middleware
        configureLoggingMiddleware(app);

        // Configure authentication and authorization
        configureAuthMiddleware(app);

        // Initialize API routes
        configureRoutes(app);

        // Configure error handling middleware (must be last)
        app.use(errorHandler);

        logInfo('Application initialized successfully', {
            component: 'app',
            environment: process.env.NODE_ENV
        });

        return app;
    } catch (error) {
        logError('Failed to initialize application', error as Error, {
            component: 'app',
            fatal: true
        });
        throw error;
    }
};

/**
 * Configures security-related middleware including CORS, Helmet,
 * and rate limiting.
 */
const configureSecurityMiddleware = (app: Express): void => {
    // Configure CORS with strict options
    app.use(cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true,
        maxAge: 86400 // 24 hours
    }));

    // Configure Helmet for security headers
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'", process.env.API_URL || '']
            }
        },
        hsts: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true
        }
    }));

    // Configure rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later',
        standardHeaders: true,
        legacyHeaders: false
    });
    app.use(limiter);
};

/**
 * Configures standard Express middleware for request parsing
 * and response compression.
 */
const configureStandardMiddleware = (app: Express): void => {
    // Enable gzip compression
    app.use(compression());

    // Parse JSON bodies
    app.use(express.json({
        limit: '10mb'
    }));

    // Parse URL-encoded bodies
    app.use(express.urlencoded({
        extended: true,
        limit: '10mb'
    }));

    // Add security headers
    app.use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        next();
    });
};

/**
 * Configures logging middleware for request/response tracking
 * using Winston logger.
 */
const configureLoggingMiddleware = (app: Express): void => {
    // Configure logging level from environment or config
    const logLevel = process.env.LOG_LEVEL || loggerConfig.level;
    
    // Add request logging middleware
    app.use(loggerMiddleware);

    logInfo('Logging middleware configured', {
        component: 'app',
        logLevel,
        transports: loggerConfig.transports.length
    });
};

/**
 * Configures authentication and authorization middleware
 * for securing API endpoints.
 */
const configureAuthMiddleware = (app: Express): void => {
    // Add authentication middleware to all /api routes
    app.use('/api', authenticate);

    // Add request validation middleware
    app.use('/api', validateRequest);

    logInfo('Authentication middleware configured', {
        component: 'app',
        ssoEnabled: process.env.SSO_ENABLED === 'true'
    });
};

/**
 * Initializes and configures API routes with proper middleware
 * and versioning.
 */
const configureRoutes = (app: Express): void => {
    // Health check endpoint (no auth required)
    app.get('/health', (req: Request, res: Response) => {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    });

    // Initialize API routes with versioning
    const apiRouter = initializeRoutes();
    app.use('/api/v1', apiRouter);

    // Add 404 handler for undefined routes
    app.use((req: Request, res: Response) => {
        res.status(404).json({
            error: 'Not Found',
            message: 'The requested resource does not exist'
        });
    });

    logInfo('API routes initialized', {
        component: 'app',
        apiVersion: 'v1',
        graphqlEndpoint: apiConfig.graphql.endpoint,
        restEndpoint: apiConfig.rest.baseUrl
    });
};

// Initialize the Express application
const app = initializeApp();

// Prevent modifications to the app instance
Object.freeze(app);

// Export the configured Express application
export default app;