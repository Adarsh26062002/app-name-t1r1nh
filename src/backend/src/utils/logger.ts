/**
 * logger.ts
 * Implements a centralized logging utility for the backend system, providing standardized
 * logging capabilities with different severity levels, file and console transports, and
 * structured log formatting for consistent monitoring and debugging across all components.
 * 
 * This implements the following requirements:
 * 1. Logging and Monitoring - system_architecture/component_responsibilities
 * 
 * @version winston: 3.3.3
 */

import winston from 'winston';
import { INTERNAL_SERVER_ERROR } from '../constants/errors';
import { SERVER_ERROR } from '../constants/messages';

/**
 * Logger configuration object defining log levels, formats, and transports
 */
const loggerConfig = {
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({ 
            format: winston.format.colorize() 
        }),
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5 
        })
    ]
};

/**
 * Create the winston logger instance with the defined configuration
 */
const logger = winston.createLogger({
    level: loggerConfig.level,
    format: loggerConfig.format,
    transports: loggerConfig.transports
});

/**
 * Interface for metadata object structure
 */
interface LogMetadata {
    [key: string]: any;
    timestamp?: string;
    correlationId?: string;
    component?: string;
}

/**
 * Logs informational messages with timestamp and structured format
 * @param message - The message to log
 * @param metadata - Additional contextual information
 */
export const logInfo = (message: string, metadata: LogMetadata = {}): void => {
    if (!message) {
        throw new Error('Log message cannot be empty');
    }

    const enrichedMetadata = {
        ...metadata,
        timestamp: new Date().toISOString()
    };

    logger.info(message, enrichedMetadata);
};

/**
 * Logs error messages with stack trace and metadata
 * @param message - The error message
 * @param error - The error object
 * @param metadata - Additional contextual information
 */
export const logError = (message: string, error: Error, metadata: LogMetadata = {}): void => {
    if (!error || !(error instanceof Error)) {
        throw new Error('Valid error object is required');
    }

    const enrichedMetadata = {
        ...metadata,
        timestamp: new Date().toISOString(),
        errorCode: INTERNAL_SERVER_ERROR,
        errorMessage: SERVER_ERROR,
        stack: error.stack,
        errorName: error.name
    };

    logger.error(message, enrichedMetadata);
};

/**
 * Logs warning messages for non-critical issues
 * @param message - The warning message
 * @param metadata - Additional contextual information
 */
export const logWarning = (message: string, metadata: LogMetadata = {}): void => {
    if (!message) {
        throw new Error('Log message cannot be empty');
    }

    const enrichedMetadata = {
        ...metadata,
        timestamp: new Date().toISOString()
    };

    logger.warn(message, enrichedMetadata);
};

/**
 * Logs debug messages for development and troubleshooting
 * @param message - The debug message
 * @param metadata - Additional contextual information
 */
export const logDebug = (message: string, metadata: LogMetadata = {}): void => {
    if (!message) {
        throw new Error('Log message cannot be empty');
    }

    const enrichedMetadata = {
        ...metadata,
        timestamp: new Date().toISOString()
    };

    logger.debug(message, enrichedMetadata);
};

// Type guard to validate metadata object
const isValidMetadata = (metadata: any): metadata is LogMetadata => {
    return typeof metadata === 'object' && metadata !== null;
};

// Ensure logger is properly initialized before exporting
if (!logger) {
    throw new Error('Failed to initialize logger');
}