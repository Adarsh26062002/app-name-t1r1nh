/**
 * messages.ts
 * Defines standard messages used throughout the backend system to ensure consistency
 * in user communication, logging, and API responses across all components.
 * 
 * This implements the following requirements:
 * 1. Standardized Messaging - system_architecture/component_configuration
 * 2. API Response Standards - system_design.api_design.api_endpoints
 */

// Import error messages for consistency in error handling
import { 
    ERROR_MESSAGES,
} from './errors';

/**
 * Standard messages used across the system for consistent communication
 * These messages are used in API responses, logs, and user notifications
 */
export const MESSAGES = {
    // General operation status messages
    SUCCESS: 'Operation completed successfully',
    FAILURE: 'Operation failed',
    
    // Resource access messages (aligned with ERROR_MESSAGES for consistency)
    NOT_FOUND: ERROR_MESSAGES.NOT_FOUND,
    UNAUTHORIZED: ERROR_MESSAGES.UNAUTHORIZED,
    FORBIDDEN: ERROR_MESSAGES.FORBIDDEN,
    SERVER_ERROR: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    
    // Validation messages
    VALIDATION_SUCCESS: 'Data validation passed successfully',
    VALIDATION_FAILURE: 'Data validation failed',
    
    // Test flow execution messages
    TEST_FLOW_STARTED: 'Test flow execution has started',
    TEST_FLOW_COMPLETED: 'Test flow execution completed',
    TEST_FLOW_FAILED: 'Test flow execution failed',
    
    // Data generation messages
    DATA_GENERATION_STARTED: 'Test data generation process started',
    DATA_GENERATION_COMPLETED: 'Test data generation completed',
    
    // Report generation messages
    REPORT_GENERATION_STARTED: 'Report generation process started',
    REPORT_GENERATION_COMPLETED: 'Report generation completed',
    
    // Connection status messages
    DATABASE_CONNECTION_SUCCESS: 'Database connection established',
    DATABASE_CONNECTION_FAILURE: 'Database connection failed',
    API_CONNECTION_SUCCESS: 'API connection established',
    API_CONNECTION_FAILURE: 'API connection failed'
} as const;

// Type definitions for better TypeScript support
export type MessageKey = keyof typeof MESSAGES;

/**
 * Type guard to check if a string is a valid message key
 * @param key - The key to check
 * @returns boolean indicating if the key exists in MESSAGES
 */
export const isValidMessageKey = (key: string): key is MessageKey => {
    return key in MESSAGES;
};

/**
 * Get a message by its key with type safety
 * @param key - The message key
 * @returns The corresponding message
 */
export const getMessage = (key: MessageKey): string => {
    return MESSAGES[key];
};

// Type assertion to ensure all messages are strings
type MessagesAreStrings = Record<MessageKey, string> extends typeof MESSAGES ? true : never;
const _messagesAreStrings: MessagesAreStrings = true;