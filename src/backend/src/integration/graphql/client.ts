/**
 * GraphQL client implementation for executing queries and mutations
 * Implements requirements from:
 * 1. GraphQL Client Implementation (system_design/api_design/graphql_client_configuration)
 * 2. Integration Layer Component (system_architecture/high-level_architecture_overview)
 * 
 * @version graphql: 16.8.1
 * @version graphql-tag: 2.12.6
 * @version axios: 1.6.2
 */

import { DocumentNode, parse } from 'graphql';
import gql from 'graphql-tag';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { validateTestData } from '../../utils/validators';
import logger from '../../utils/logger';

// Interface for GraphQL client configuration
export interface GraphQLClientConfig {
    endpoint: string;
    headers: Record<string, string>;
    timeout: number;
    retryAttempts: number;
    validateSchema: boolean;
}

// Interface for GraphQL response structure
export interface GraphQLResponse<T> {
    data?: T;
    errors?: Array<{
        message: string;
        path: string[];
    }>;
}

// Default configuration for GraphQL client
const DEFAULT_GRAPHQL_CONFIG: GraphQLClientConfig = {
    endpoint: process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.GRAPHQL_AUTH_TOKEN || '',
        'Accept': 'application/json'
    },
    timeout: 30000,
    retryAttempts: 3,
    validateSchema: true
};

/**
 * Validates a GraphQL query string using graphql-tag's validation
 * @param query - GraphQL query string to validate
 * @returns boolean indicating if query is valid
 * @throws GraphQLError if query is invalid
 */
const validateQuery = (query: string): boolean => {
    try {
        // Parse the query string using gql tag
        const parsedQuery: DocumentNode = gql(query);
        
        // Additional validation using graphql parse
        parse(query);
        
        // Log successful validation
        logger.logDebug('GraphQL query validation successful', {
            component: 'GraphQLClient',
            queryLength: query.length
        });
        
        return true;
    } catch (error) {
        // Log validation error
        logger.logError('GraphQL query validation failed', error as Error, {
            component: 'GraphQLClient',
            query
        });
        throw error;
    }
};

/**
 * Creates an axios instance with retry mechanism
 * @param config - GraphQL client configuration
 * @returns Configured axios instance
 */
const createAxiosInstance = (config: GraphQLClientConfig): AxiosInstance => {
    const instance = axios.create({
        baseURL: config.endpoint,
        headers: config.headers,
        timeout: config.timeout
    });

    // Add response interceptor for retry mechanism
    instance.interceptors.response.use(
        response => response,
        async (error: AxiosError) => {
            const config = error.config as any;
            
            // Initialize retry count if not exists
            config.retryCount = config.retryCount ?? 0;
            
            if (config.retryCount < DEFAULT_GRAPHQL_CONFIG.retryAttempts) {
                config.retryCount += 1;
                
                // Log retry attempt
                logger.logWarning('Retrying GraphQL request', {
                    component: 'GraphQLClient',
                    attempt: config.retryCount,
                    error: error.message
                });
                
                // Exponential backoff delay
                const delay = Math.min(1000 * (2 ** config.retryCount), 10000);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                return instance(config);
            }
            
            throw error;
        }
    );

    return instance;
};

/**
 * Executes a GraphQL query with retry mechanism and error handling
 * @param query - GraphQL query string
 * @param variables - Query variables
 * @param config - Optional client configuration
 * @returns Promise resolving to GraphQL response
 */
export const executeQuery = async <T>(
    query: string,
    variables: Record<string, any> = {},
    config: Partial<GraphQLClientConfig> = {}
): Promise<GraphQLResponse<T>> => {
    try {
        // Merge provided config with defaults
        const mergedConfig: GraphQLClientConfig = {
            ...DEFAULT_GRAPHQL_CONFIG,
            ...config,
            headers: {
                ...DEFAULT_GRAPHQL_CONFIG.headers,
                ...config.headers
            }
        };

        // Validate query structure
        validateQuery(query);

        // Validate variables if present
        if (Object.keys(variables).length > 0) {
            validateTestData(variables);
        }

        // Create axios instance with retry mechanism
        const axiosInstance = createAxiosInstance(mergedConfig);

        // Log operation start
        logger.logInfo('Executing GraphQL operation', {
            component: 'GraphQLClient',
            endpoint: mergedConfig.endpoint,
            variablesPresent: Object.keys(variables).length > 0
        });

        // Execute GraphQL request
        const response = await axiosInstance.post<GraphQLResponse<T>>(
            '',
            {
                query,
                variables
            }
        );

        // Check for GraphQL errors in response
        if (response.data.errors?.length) {
            logger.logError('GraphQL operation returned errors', new Error(response.data.errors[0].message), {
                component: 'GraphQLClient',
                errors: response.data.errors
            });
        }

        // Log successful operation
        logger.logInfo('GraphQL operation completed', {
            component: 'GraphQLClient',
            hasData: !!response.data.data,
            hasErrors: !!response.data.errors
        });

        return response.data;
    } catch (error) {
        // Log and handle errors
        logger.logError('GraphQL operation failed', error as Error, {
            component: 'GraphQLClient',
            query,
            variables
        });

        // Rethrow with additional context
        throw new Error(`GraphQL operation failed: ${(error as Error).message}`);
    }
};