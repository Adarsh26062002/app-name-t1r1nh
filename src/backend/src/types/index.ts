/**
 * Central export point for TypeScript types and interfaces used throughout the backend system.
 * This file consolidates database entity types, API configuration types, and response interfaces
 * to ensure type safety and consistency across various components.
 * 
 * @version typescript: 4.9.5
 */

// Import database entity types and interfaces
// Implements: Centralized Type Definitions (system_architecture.core_components)
import {
  ITestData,
  ITestFlow,
  ITestResult,
  ITestFlowConfig,
  TestFlowStatus,
  TestResultStatus
} from './db.types';

// Import API configuration and response types
// Implements: API Type Safety (system_design.api_design.graphql_client_configuration)
// Implements: REST Client Types (system_design.api_design.rest_client_configuration)
import {
  GraphQLClientConfig,
  RESTClientConfig,
  GraphQLResponse,
  RESTResponse
} from './api.types';

// Re-export database entity types and interfaces
// Implements: Centralized Type Definitions for database entities
export {
  ITestData,
  ITestFlow,
  ITestResult,
  ITestFlowConfig,
  TestFlowStatus,
  TestResultStatus
};

// Re-export API configuration types
// Implements: API Type Safety for GraphQL client configuration
export {
  GraphQLClientConfig,
  GraphQLResponse
};

// Re-export REST client types
// Implements: REST Client Types for configuration and response handling
export {
  RESTClientConfig,
  RESTResponse
};

// Type aliases for commonly used combinations
export type TestFlowWithConfig = ITestFlow & { config: ITestFlowConfig };
export type TestResultWithFlow = ITestResult & { flow: ITestFlow };

// Type guards for runtime type checking
export const isTestFlow = (value: any): value is ITestFlow => {
  return (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    'name' in value &&
    'flow_type' in value &&
    'status' in value
  );
};

export const isTestResult = (value: any): value is ITestResult => {
  return (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    'flow_id' in value &&
    'status' in value &&
    'duration_ms' in value
  );
};

// Utility type for partial updates
export type PartialTestFlow = Partial<ITestFlow>;
export type PartialTestResult = Partial<ITestResult>;

// Type for test flow execution options
export interface TestFlowExecutionOptions {
  timeout?: number;
  retries?: number;
  parallel?: boolean;
  validateResults?: boolean;
}

// Type for API response error details
export interface APIErrorDetail {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

// Type for paginated response wrapper
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Type for test execution metrics
export interface TestExecutionMetrics {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage: number;
  timestamp: Date;
}

// Namespace for grouping related types
export namespace TestTypes {
  export type Flow = ITestFlow;
  export type Result = ITestResult;
  export type Data = ITestData;
  export type FlowConfig = ITestFlowConfig;
  export type FlowStatus = TestFlowStatus;
  export type ResultStatus = TestResultStatus;
}

// Namespace for API related types
export namespace APITypes {
  export type GraphQLConfig = GraphQLClientConfig;
  export type RESTConfig = RESTClientConfig;
  export type GraphQLRes<T> = GraphQLResponse<T>;
  export type RESTRes<T> = RESTResponse<T>;
}