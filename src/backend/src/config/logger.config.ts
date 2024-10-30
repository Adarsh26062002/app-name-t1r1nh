/**
 * logger.config.ts
 * Configures the centralized logging system for the backend application using winston.
 * 
 * This implements the following requirements:
 * 1. Logging and Monitoring - system_architecture/component_responsibilities
 * 2. Component Configuration - system_architecture/component_configuration
 */

// winston v3.3.3 - Enterprise-grade logging library
import * as winston from 'winston';
import { SYSTEM } from '../constants/config';

/**
 * Logger configuration object that defines the logging behavior
 * including log levels, formats, and transport options
 */
export const loggerConfig = {
    // Set log level from system configuration or default to 'info'
    level: SYSTEM.LOG_LEVEL || 'info',

    // Configure structured logging format with timestamp and JSON formatting
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.json()
    ),

    // Configure multiple transports for different logging purposes
    transports: [
        // Console transport with colorization for development environment
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple(),
                winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                    return `${timestamp} ${level}: ${message} ${Object.keys(metadata).length ? JSON.stringify(metadata) : ''}`;
                })
            )
        }),

        // File transport for error logs with rotation
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
            format: winston.format.combine(
                winston.format.uncolorize(),
                winston.format.json()
            )
        }),

        // File transport for combined logs with rotation
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
            format: winston.format.combine(
                winston.format.uncolorize(),
                winston.format.json()
            )
        })
    ]
};

/**
 * Configures and initializes the winston logger with specified transports and formats
 * @returns {winston.Logger} Configured winston logger instance
 */
const configureLogger = (): winston.Logger => {
    // Create logger instance with configuration
    const logger = winston.createLogger({
        level: loggerConfig.level,
        format: loggerConfig.format,
        transports: loggerConfig.transports,
        // Exit on error: false to prevent logger from crashing on transport errors
        exitOnError: false
    });

    // Add error event handlers for each transport
    logger.transports.forEach(transport => {
        transport.on('error', (error) => {
            console.error('Logger transport error:', error);
        });
    });

    return logger;
};

// Create and configure the logger instance
const logger = configureLogger();

// Prevent modifications to the logger configuration
Object.freeze(loggerConfig);
Object.freeze(logger);

// Export the configured logger instance for system-wide use
export default logger;