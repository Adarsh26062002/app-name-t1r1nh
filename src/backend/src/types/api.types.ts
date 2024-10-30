/**
 * API Type Definitions for Backend System
 * Defines comprehensive TypeScript interfaces and types for API interactions
 * including GraphQL and REST client configurations, request/response types,
 * and endpoint-specific interfaces.
 * 
 * @version typescript: 4.9.5
 */

// Import types from GraphQL and REST client configurations
import { 
  GraphQLClientConfig as ImportedGraphQLConfig,
  GraphQLResponse as ImportedGraphQLResponse 
} from '../integration/graphql/client';

import {
  RESTClientConfig as ImportedRESTConfig,
  RESTResponse as ImportedRESTResponse
} from '../integration/rest/client';

// Re-export GraphQL client configuration types
// Implements: system_design.api_design.graphql_client_configuration
export interface GraphQLClientConfig extends ImportedGraphQLConfig {
  endpoint: string;
  headers: Record<string, string>;
  timeout: number;
  retryAttempts: number;
  validateSchema: boolean;
}

// Generic GraphQL response interface
export interface GraphQLResponse<T> extends ImportedGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    path: string[];
  }>;
}

// Re-export REST client configuration types
// Implements: system_design.api_design.rest_client_configuration
export interface RESTClientConfig extends ImportedRESTConfig {
  baseUrl: string;
  headers: Record<string, string>;
  timeout: number;
  retryConfig: {
    attempts: number;
    backoff: number;
  };
  validateStatus: (status: number) => boolean;
}

// Generic REST response interface
export interface RESTResponse<T> extends ImportedRESTResponse<T> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

// Test Flow Execution Request Interface
// Implements: system_design.api_design.api_endpoints - /api/v1/flows
export interface FlowRequest {
  /**
   * Unique identifier for the test flow to be executed
   */
  flowId: string;

  /**
   * Parameters required for test flow execution
   */
  parameters: Record<string, any>;

  /**
   * Flag to indicate if the flow should be executed in parallel
   */
  parallel: boolean;
}

// Test Data Generation Request Interface
// Implements: system_design.api_design.api_endpoints - /api/v1/data
export interface DataGenerationRequest {
  /**
   * Schema definition for test data generation
   */
  schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };

  /**
   * Number of test data records to generate
   */
  count: number;

  /**
   * Constraints for test data generation
   */
  constraints: Record<string, any>;
}

// Test Results Validation Request Interface
// Implements: system_design.api_design.api_endpoints - /api/v1/validate
export interface ValidationRequest {
  /**
   * Unique identifier for the test results to validate
   */
  testId: string;

  /**
   * Actual test results to validate
   */
  results: {
    status: string;
    data: Record<string, any>;
    metrics?: Record<string, number>;
    timestamp: string;
  };

  /**
   * Expected test results for validation
   */
  expectedResults: {
    status: string;
    data: Record<string, any>;
    tolerances?: Record<string, number>;
  };
}

// Export all API types under namespace for organization
export namespace APITypes {
  export { FlowRequest };
  export { DataGenerationRequest };
  export { ValidationRequest };
}