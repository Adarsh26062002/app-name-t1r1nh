/**
 * retryHandler.ts
 * Implements a robust retry mechanism for test executions with configurable retry attempts
 * and exponential backoff strategy. Handles transient failures and network issues during
 * test execution while maintaining detailed logging of retry attempts and their outcomes.
 * 
 * Implements requirements:
 * - Retry Logic for Test Executions (system_architecture/component_responsibilities)
 * - Flow Test Execution (system_architecture/component_responsibilities)
 * 
 * @version async: 3.2.0
 */

import { logInfo, logError } from '../../utils/logger';
import { ITestFlow, TestFlowStatus } from '../../types/test.types';
import * as async from 'async';

// Global constants for retry configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const MAX_BACKOFF_MS = 5000;

/**
 * Retries a failed test execution with exponential backoff strategy
 * @param testFlow - The test flow to execute
 * @param attempts - Number of retry attempts (default: MAX_RETRY_ATTEMPTS)
 * @returns Promise<boolean> - True if execution succeeds, false otherwise
 */
export const retryTestExecution = async (
    testFlow: ITestFlow,
    attempts: number = MAX_RETRY_ATTEMPTS
): Promise<boolean> => {
    // Validate input parameters
    if (!testFlow || !testFlow.id) {
        throw new Error('Invalid test flow provided');
    }

    // Ensure attempts is within limits
    const retryAttempts = Math.min(attempts, MAX_RETRY_ATTEMPTS);

    logInfo('Starting retry operation', {
        flowId: testFlow.id,
        flowName: testFlow.name,
        maxAttempts: retryAttempts
    });

    let currentAttempt = 0;
    let lastError: Error | null = null;

    // Configure retry operation with async.retry
    const retryOperation = {
        times: retryAttempts,
        interval: (retryCount: number, error: Error): number => {
            const delay = calculateBackoffDelay(retryCount, RETRY_DELAY_MS);
            logInfo('Calculating retry delay', {
                flowId: testFlow.id,
                attempt: retryCount,
                delay,
                error: error.message
            });
            return delay;
        }
    };

    try {
        const result = await async.retry(retryOperation, async () => {
            currentAttempt++;
            
            logInfo('Executing retry attempt', {
                flowId: testFlow.id,
                attempt: currentAttempt,
                totalAttempts: retryAttempts
            });

            // Update test flow status to running
            testFlow.status = TestFlowStatus.RUNNING;

            try {
                // Execute the test flow
                // Note: Actual test execution logic would be injected here
                const success = await executeTestFlow(testFlow);

                if (!success) {
                    const error = new Error(`Test execution failed on attempt ${currentAttempt}`);
                    lastError = error;
                    throw error;
                }

                // Update status on success
                testFlow.status = TestFlowStatus.COMPLETED;
                logInfo('Test execution succeeded', {
                    flowId: testFlow.id,
                    attempt: currentAttempt
                });

                return true;
            } catch (error) {
                lastError = error as Error;
                logError('Test execution failed', error as Error, {
                    flowId: testFlow.id,
                    attempt: currentAttempt,
                    remainingAttempts: retryAttempts - currentAttempt
                });
                throw error;
            }
        });

        return result;
    } catch (error) {
        // All retry attempts failed
        testFlow.status = TestFlowStatus.FAILED;
        logError('All retry attempts exhausted', lastError as Error, {
            flowId: testFlow.id,
            totalAttempts: currentAttempt
        });
        return false;
    }
};

/**
 * Calculates the exponential backoff delay for the next retry attempt
 * @param attempt - Current attempt number
 * @param baseDelay - Base delay in milliseconds
 * @returns number - Calculated delay with jitter, capped at MAX_BACKOFF_MS
 */
export const calculateBackoffDelay = (
    attempt: number,
    baseDelay: number
): number => {
    // Calculate exponential delay: baseDelay * (2 ^ attempt)
    const exponentialDelay = baseDelay * Math.pow(2, attempt);

    // Add random jitter (±20%) to prevent thundering herd
    const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
    const delay = exponentialDelay + jitter;

    // Cap the delay at MAX_BACKOFF_MS
    return Math.min(delay, MAX_BACKOFF_MS);
};

/**
 * Helper function to simulate test flow execution
 * This would be replaced by actual test execution logic in production
 * @param testFlow - The test flow to execute
 * @returns Promise<boolean>
 */
const executeTestFlow = async (testFlow: ITestFlow): Promise<boolean> => {
    // Placeholder for actual test execution logic
    // In production, this would integrate with the test execution engine
    return new Promise((resolve) => {
        const success = Math.random() > 0.5; // Simulate random success/failure
        setTimeout(() => resolve(success), 100);
    });
};