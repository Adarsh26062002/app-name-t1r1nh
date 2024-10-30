/**
 * server.ts
 * Entry point for the backend server that initializes the application,
 * sets up database connections, and handles graceful shutdown.
 * 
 * This implements the following requirements:
 * 1. Server Initialization - system_architecture/high-level_architecture_overview
 * 2. Database Integration - system_architecture/database_integration_layer
 * 
 * @version http: built-in
 */

import http from 'http';
import app from './app';
import { logInfo, logError, logWarning } from './utils/logger';
import { initializeDatabase, closeConnections } from './config/database.config';

// Server port configuration with fallback
const port = process.env.PORT || 3000;

// Server instance declaration
let server: http.Server;

/**
 * Starts the HTTP server, initializes database connections,
 * and sets up graceful shutdown handlers.
 * 
 * @returns {Promise<void>} Resolves when server is successfully started
 */
export const startServer = async (): Promise<void> => {
    try {
        // Initialize database connections first
        await initializeDatabase();
        logInfo('Database connections initialized successfully', {
            component: 'server',
            timestamp: new Date().toISOString()
        });

        // Create HTTP server instance
        server = http.createServer(app);

        // Handle server-level errors
        server.on('error', (error: NodeJS.ErrnoException) => {
            logError('Server error occurred', error, {
                component: 'server',
                port,
                fatal: true
            });

            if (error.syscall !== 'listen') {
                throw error;
            }

            // Handle specific listen errors
            switch (error.code) {
                case 'EACCES':
                    logError('Port requires elevated privileges', error, {
                        component: 'server',
                        port
                    });
                    process.exit(1);
                    break;
                case 'EADDRINUSE':
                    logError('Port is already in use', error, {
                        component: 'server',
                        port
                    });
                    process.exit(1);
                    break;
                default:
                    throw error;
            }
        });

        // Start listening on configured port
        await new Promise<void>((resolve) => {
            server.listen(port, () => {
                logInfo('Server started successfully', {
                    component: 'server',
                    port,
                    environment: process.env.NODE_ENV,
                    timestamp: new Date().toISOString()
                });
                resolve();
            });
        });

        // Set up process handlers for graceful shutdown
        setupGracefulShutdown();

    } catch (error) {
        logError('Failed to start server', error as Error, {
            component: 'server',
            fatal: true
        });
        throw error;
    }
};

/**
 * Handles graceful shutdown of the server and database connections.
 * Implements proper cleanup of resources before process termination.
 * 
 * @returns {Promise<void>} Resolves when server and connections are closed
 */
const gracefulShutdown = async (): Promise<void> => {
    try {
        logWarning('Initiating graceful shutdown', {
            component: 'server',
            timestamp: new Date().toISOString()
        });

        // Close the HTTP server first
        if (server) {
            await new Promise<void>((resolve, reject) => {
                server.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            
            logInfo('HTTP server closed successfully', {
                component: 'server'
            });
        }

        // Close all database connections
        await closeConnections();
        logInfo('Database connections closed successfully', {
            component: 'server'
        });

        // Log successful shutdown
        logInfo('Graceful shutdown completed', {
            component: 'server',
            timestamp: new Date().toISOString()
        });

        // Exit process with success code
        process.exit(0);

    } catch (error) {
        logError('Error during graceful shutdown', error as Error, {
            component: 'server',
            fatal: true
        });
        // Force exit with error code
        process.exit(1);
    }
};

/**
 * Sets up process event handlers for graceful shutdown
 * Ensures proper cleanup on various termination signals
 */
const setupGracefulShutdown = (): void => {
    // Handle process termination signals
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach((signal) => {
        process.on(signal, async () => {
            logWarning(`Received ${signal} signal`, {
                component: 'server',
                signal
            });
            await gracefulShutdown();
        });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error: Error) => {
        logError('Uncaught exception', error, {
            component: 'server',
            fatal: true
        });
        await gracefulShutdown();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason: unknown) => {
        logError('Unhandled promise rejection', reason as Error, {
            component: 'server',
            fatal: true
        });
        await gracefulShutdown();
    });
};

// Auto-start server if this is the main module
if (require.main === module) {
    startServer().catch((error) => {
        logError('Failed to start server from main', error as Error, {
            component: 'server',
            fatal: true
        });
        process.exit(1);
    });
}