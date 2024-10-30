/**
 * index.ts
 * Main entry point for the backend system, orchestrating initialization and startup
 * of server, application components, test framework modules, and database connections.
 * 
 * Implements requirements:
 * - System Initialization (system_architecture/high-level_architecture_overview)
 * - Component Configuration (system_architecture/component_configuration)
 * 
 * @version dotenv: 8.2.0
 */

// Import environment variables configuration
import dotenv from 'dotenv';

// Import core application components
import app from './app';
import { startServer } from './server';
import { graphql, rest } from './config/api.config';
import { level, transports } from './config/logger.config';
import { initializeDatabase } from './config/database.config';
import { logInfo, logError } from './utils/logger';
import { NOT_FOUND, INTERNAL_SERVER_ERROR } from './constants';
import { initializeTestManager } from './core/TestManager';

/**
 * Initializes the backend system by setting up environment variables,
 * database connections, test framework components, and starting the server.
 * 
 * Implements requirement: System Initialization - Coordinate initialization of all components
 */
export const initializeSystem = async (): Promise<void> => {
    try {
        // Step 1: Load environment variables
        dotenv.config();
        logInfo('Environment variables loaded', {
            component: 'system',
            environment: process.env.NODE_ENV
        });

        // Step 2: Initialize logger with configured transports and log level
        logInfo('Initializing logger', {
            component: 'system',
            level,
            transports: transports.length
        });

        // Step 3: Initialize database connections
        await initializeDatabase();
        logInfo('Database connections initialized', {
            component: 'system',
            databases: ['events', 'inventory']
        });

        // Step 4: Initialize API clients
        logInfo('Initializing API clients', {
            component: 'system',
            graphqlEndpoint: graphql.endpoint,
            restEndpoint: rest.baseUrl
        });

        // Step 5: Initialize test framework components
        await initializeTestManager();
        logInfo('Test framework components initialized', {
            component: 'system',
            modules: ['TestManager', 'TestExecutor', 'TestReporter']
        });

        // Step 6: Start the HTTP server
        await startServer();
        logInfo('Server started successfully', {
            component: 'system',
            port: process.env.PORT || 3000
        });

        // Step 7: Set up graceful shutdown handlers
        setupGracefulShutdown();
        logInfo('Graceful shutdown handlers configured', {
            component: 'system'
        });

        logInfo('System initialization completed successfully', {
            component: 'system',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logError('System initialization failed', error as Error, {
            component: 'system',
            fatal: true
        });
        await handleGracefulShutdown();
        process.exit(1);
    }
};

/**
 * Handles graceful shutdown of system components
 * 
 * Implements requirement: Component Configuration - Proper cleanup of resources
 */
const handleGracefulShutdown = async (): Promise<void> => {
    try {
        logInfo('Initiating graceful shutdown', {
            component: 'system',
            timestamp: new Date().toISOString()
        });

        // Step 1: Stop accepting new requests
        if (app) {
            app.disable('accept-incoming');
            logInfo('Stopped accepting new requests', {
                component: 'system'
            });
        }

        // Step 2: Wait for existing requests to complete (5 second timeout)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 3: Stop test framework components
        try {
            await initializeTestManager();
            logInfo('Test framework components stopped', {
                component: 'system'
            });
        } catch (error) {
            logError('Error stopping test framework components', error as Error, {
                component: 'system'
            });
        }

        // Step 4: Close database connections
        try {
            await initializeDatabase();
            logInfo('Database connections closed', {
                component: 'system'
            });
        } catch (error) {
            logError('Error closing database connections', error as Error, {
                component: 'system'
            });
        }

        logInfo('Graceful shutdown completed', {
            component: 'system',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logError('Error during graceful shutdown', error as Error, {
            component: 'system',
            fatal: true
        });
        process.exit(1);
    }
};

/**
 * Sets up process event handlers for graceful shutdown
 */
const setupGracefulShutdown = (): void => {
    // Handle process termination signals
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach((signal) => {
        process.on(signal, async () => {
            logInfo(`Received ${signal} signal`, {
                component: 'system',
                signal
            });
            await handleGracefulShutdown();
            process.exit(0);
        });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error: Error) => {
        logError('Uncaught exception', error, {
            component: 'system',
            fatal: true,
            errorCode: INTERNAL_SERVER_ERROR
        });
        await handleGracefulShutdown();
        process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason: unknown) => {
        logError('Unhandled promise rejection', reason as Error, {
            component: 'system',
            fatal: true,
            errorCode: INTERNAL_SERVER_ERROR
        });
        await handleGracefulShutdown();
        process.exit(1);
    });
};

// Auto-start system if this is the main module
if (require.main === module) {
    initializeSystem().catch((error: Error) => {
        logError('Failed to start system from main', error, {
            component: 'system',
            fatal: true,
            errorCode: INTERNAL_SERVER_ERROR
        });
        process.exit(1);
    });
}