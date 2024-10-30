/**
 * logger.middleware.ts
 * Express middleware for HTTP request/response logging with detailed metadata and timing information.
 * 
 * This implements the following requirements:
 * 1. Logging and Monitoring - system_architecture/component_responsibilities
 * 
 * @version express: 4.17.1
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid'; // @version uuid: 8.3.2
import { logInfo, logError, logDebug } from '../../utils/logger';
import { MESSAGES } from '../../constants/messages';

/**
 * Interface for response metadata logging
 */
interface ResponseMetadata {
    requestId: string;
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    responseSize?: number;
    userAgent?: string;
    ip?: string;
}

/**
 * Express middleware that logs HTTP requests and responses with detailed metadata
 * and timing information for monitoring and debugging purposes.
 * 
 * @param req - Express Request object
 * @param res - Express Response object
 * @param next - Express NextFunction
 */
const loggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    // Generate unique request ID for request tracking
    const requestId = uuidv4();
    req.id = requestId;

    // Record request start time for duration calculation
    const startTime = process.hrtime();

    // Log incoming request details
    logInfo('Incoming request', {
        requestId,
        method: req.method,
        url: req.url,
        headers: {
            ...req.headers,
            authorization: req.headers.authorization ? '[REDACTED]' : undefined
        },
        query: req.query,
        // Only log body for non-file uploads and within size limit
        body: !req.is('multipart/form-data') && JSON.stringify(req.body).length < 10000 
            ? req.body 
            : '[BODY_TOO_LARGE_OR_FILE_UPLOAD]',
        ip: req.ip,
        userAgent: req.get('user-agent')
    });

    // Store original response end method
    const originalEnd = res.end;
    let responseBody = '';

    // Override response end method to capture response body
    res.end = function (chunk: any, ...rest: any[]): any {
        if (chunk) {
            responseBody = chunk.toString();
        }
        res.end = originalEnd;
        return res.end(chunk, ...rest);
    };

    // Attach listener to response finish event
    res.on('finish', () => {
        // Calculate request duration
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds * 1000 + nanoseconds / 1000000;

        const responseMetadata: ResponseMetadata = {
            requestId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
            responseSize: parseInt(res.get('content-length') || '0'),
            userAgent: req.get('user-agent'),
            ip: req.ip
        };

        // Log based on response status
        if (res.statusCode >= 400) {
            // For error responses, log with error level
            logError(
                `Request failed with status ${res.statusCode}`,
                new Error(responseBody),
                {
                    ...responseMetadata,
                    errorResponse: responseBody.length < 10000 
                        ? responseBody 
                        : '[RESPONSE_TOO_LARGE]'
                }
            );
        } else {
            // For successful responses, log with info level
            logInfo(MESSAGES.SUCCESS, responseMetadata);
        }

        // Log detailed request/response data in development
        if (process.env.NODE_ENV === 'development') {
            logDebug('Request/Response details', {
                ...responseMetadata,
                requestHeaders: req.headers,
                responseHeaders: res.getHeaders(),
                responseBody: responseBody.length < 10000 
                    ? responseBody 
                    : '[RESPONSE_TOO_LARGE]'
            });
        }
    });

    next();
};

export default loggerMiddleware;