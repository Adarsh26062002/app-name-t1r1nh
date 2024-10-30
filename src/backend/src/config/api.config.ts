/**
 * API Configuration Module
 * Configures API client settings for both GraphQL and REST interactions
 * Implements retry mechanisms, timeout controls, and schema validation
 * 
 * @version typescript: 4.9.5
 */

import { GraphQLClientConfig, RESTClientConfig } from '../types/api.types';
import { CONFIG } from '../constants/config';

/**
 * API Configuration object that defines settings for both GraphQL and REST clients
 * Implements requirements from:
 * - system_design.api_design.graphql_client_configuration
 * - system_design.api_design.rest_client_configuration
 * - system_architecture.api_integration_layer
 */
export const apiConfig = {
  /**
   * GraphQL client configuration
   * Implements schema validation and retry mechanisms for GraphQL operations
   */
  graphql: {
    // GraphQL API endpoint with environment-specific configuration
    endpoint: process.env.GRAPHQL_ENDPOINT || 'https://api.example.com/graphql',
    
    // Standard headers for GraphQL requests including authentication
    headers: {
      authorization: process.env.GRAPHQL_AUTH_TOKEN || '',
      'content-type': 'application/json'
    },
    
    // Request timeout from global configuration
    timeout: CONFIG.API.TIMEOUT,
    
    // Number of retry attempts for failed requests
    retryAttempts: CONFIG.API.RETRY_ATTEMPTS,
    
    // Enable schema validation for GraphQL operations
    validateSchema: true
  } as GraphQLClientConfig,

  /**
   * REST client configuration
   * Implements status validation and retry mechanisms with exponential backoff
   */
  rest: {
    // Base URL for REST API endpoints
    baseUrl: process.env.REST_BASE_URL || 'https://api.example.com',
    
    // Standard headers for REST requests including authentication
    headers: {
      authorization: process.env.REST_AUTH_TOKEN || '',
      'content-type': 'application/json'
    },
    
    // Request timeout from global configuration
    timeout: CONFIG.API.TIMEOUT,
    
    // Retry configuration with exponential backoff
    retryConfig: {
      attempts: CONFIG.API.RETRY_ATTEMPTS,
      backoff: CONFIG.API.RETRY_BACKOFF
    },
    
    // Validate response status codes
    validateStatus: (status: number) => status >= 200 && status < 300
  } as RESTClientConfig
};

// Freeze configuration object to prevent runtime modifications
Object.freeze(apiConfig);
Object.freeze(apiConfig.graphql);
Object.freeze(apiConfig.rest);
Object.freeze(apiConfig.graphql.headers);
Object.freeze(apiConfig.rest.headers);
Object.freeze(apiConfig.rest.retryConfig);