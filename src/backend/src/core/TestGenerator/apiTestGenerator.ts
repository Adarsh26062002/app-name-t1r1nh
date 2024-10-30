/**
 * apiTestGenerator.ts
 * Generates comprehensive API test cases by parsing and analyzing GraphQL and REST API schemas.
 * Implements intelligent test case generation strategies ensuring full coverage of API endpoints,
 * operations, and data variations while validating against schema definitions.
 * 
 * @version typescript: 4.9.5
 * @version axios: 0.21.1
 */

import { parseGraphQLSchema, parseRESTSchema } from './schemaParser';
import { executeFlow } from '../TestExecutor/flowExecutor';
import {
  GraphQLClientConfig,
  RESTClientConfig
} from '../../types/api.types';
import { ITestFlow } from '../../types/test.types';
import axios from 'axios'; // ^0.21.1

// Global configuration for API test generation
const API_TEST_CONFIG = {
  maxTestsPerEndpoint: 5,
  includeNegativeCases: true,
  validateResponses: true,
  timeout: 30000
};

/**
 * Decorator for validating API client configurations
 */
function validateConfig(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const [graphqlConfig, restConfig] = args;

    // Validate GraphQL configuration
    if (graphqlConfig) {
      if (!graphqlConfig.endpoint || typeof graphqlConfig.endpoint !== 'string') {
        throw new Error('Invalid GraphQL endpoint configuration');
      }
      if (!graphqlConfig.headers || typeof graphqlConfig.headers !== 'object') {
        throw new Error('Invalid GraphQL headers configuration');
      }
    }

    // Validate REST configuration
    if (restConfig) {
      if (!restConfig.baseUrl || typeof restConfig.baseUrl !== 'string') {
        throw new Error('Invalid REST baseUrl configuration');
      }
      if (!restConfig.headers || typeof restConfig.headers !== 'object') {
        throw new Error('Invalid REST headers configuration');
      }
    }

    return originalMethod.apply(this, args);
  };

  return descriptor;
}

/**
 * Generates comprehensive API test cases by analyzing GraphQL and REST schemas
 * Implements requirements:
 * - API Test Generation (system_architecture.component_responsibilities)
 * - GraphQL Schema Integration (system_design.api_design.graphql_client_configuration)
 * - REST API Integration (system_design.api_design.rest_client_configuration)
 */
@validateConfig
export async function generateAPITests(
  graphqlConfig: GraphQLClientConfig,
  restConfig: RESTClientConfig
): Promise<ITestFlow[]> {
  const testFlows: ITestFlow[] = [];

  try {
    // Generate GraphQL test flows if configuration is provided
    if (graphqlConfig) {
      const graphqlTests = await generateGraphQLTests(graphqlConfig);
      testFlows.push(...graphqlTests);
    }

    // Generate REST test flows if configuration is provided
    if (restConfig) {
      const restTests = await generateRESTTests(restConfig);
      testFlows.push(...restTests);
    }

    return testFlows;
  } catch (error) {
    throw new Error(`Failed to generate API tests: ${error.message}`);
  }
}

/**
 * Generates test flows for GraphQL operations
 * Implements GraphQL Schema Integration requirement
 */
async function generateGraphQLTests(config: GraphQLClientConfig): Promise<ITestFlow[]> {
  const testFlows: ITestFlow[] = [];
  
  try {
    // Parse GraphQL schema
    const { operations, types } = await parseGraphQLSchema(config);

    // Generate test flows for each operation
    for (const operation of operations) {
      // Generate positive test cases
      const positiveFlow = generatePositiveGraphQLFlow(operation, config);
      testFlows.push(positiveFlow);

      // Generate negative test cases if enabled
      if (API_TEST_CONFIG.includeNegativeCases) {
        const negativeFlows = generateNegativeGraphQLFlows(operation, config);
        testFlows.push(...negativeFlows);
      }
    }

    return testFlows;
  } catch (error) {
    throw new Error(`Failed to generate GraphQL tests: ${error.message}`);
  }
}

/**
 * Generates test flows for REST endpoints
 * Implements REST API Integration requirement
 */
async function generateRESTTests(config: RESTClientConfig): Promise<ITestFlow[]> {
  const testFlows: ITestFlow[] = [];

  try {
    // Parse REST schema
    const { endpoints, schemas } = await parseRESTSchema(config);

    // Generate test flows for each endpoint
    for (const endpoint of endpoints) {
      // Generate positive test cases
      const positiveFlow = generatePositiveRESTFlow(endpoint, config);
      testFlows.push(positiveFlow);

      // Generate negative test cases if enabled
      if (API_TEST_CONFIG.includeNegativeCases) {
        const negativeFlows = generateNegativeRESTFlows(endpoint, config);
        testFlows.push(...negativeFlows);
      }
    }

    return testFlows;
  } catch (error) {
    throw new Error(`Failed to generate REST tests: ${error.message}`);
  }
}

/**
 * Generates positive test flow for a GraphQL operation
 */
function generatePositiveGraphQLFlow(
  operation: any,
  config: GraphQLClientConfig
): ITestFlow {
  return {
    id: `graphql-${operation.type}-${operation.name}-positive`,
    name: `GraphQL ${operation.type} ${operation.name} Positive Test`,
    description: `Validates successful execution of ${operation.name} ${operation.type}`,
    flow_type: 'graphql',
    config: {
      steps: [{
        name: `Execute ${operation.name}`,
        type: 'graphql',
        action: 'execute',
        input: {
          query: generateGraphQLQuery(operation),
          variables: generateValidVariables(operation.arguments)
        },
        expected: {
          status: 'success',
          hasData: true,
          errorCount: 0
        },
        timeout: config.timeout
      }],
      parameters: {
        endpoint: config.endpoint,
        headers: config.headers,
        validateSchema: config.validateSchema
      },
      environment: {
        name: 'test',
        variables: {}
      },
      timeout: API_TEST_CONFIG.timeout,
      retries: config.retryAttempts
    },
    test_data_id: '',
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date()
  };
}

/**
 * Generates negative test flows for a GraphQL operation
 */
function generateNegativeGraphQLFlows(
  operation: any,
  config: GraphQLClientConfig
): ITestFlow[] {
  const negativeFlows: ITestFlow[] = [];

  // Invalid variables test
  negativeFlows.push({
    id: `graphql-${operation.type}-${operation.name}-invalid-variables`,
    name: `GraphQL ${operation.type} ${operation.name} Invalid Variables Test`,
    description: `Validates error handling for invalid variables in ${operation.name}`,
    flow_type: 'graphql',
    config: {
      steps: [{
        name: `Execute ${operation.name} with invalid variables`,
        type: 'graphql',
        action: 'execute',
        input: {
          query: generateGraphQLQuery(operation),
          variables: generateInvalidVariables(operation.arguments)
        },
        expected: {
          status: 'error',
          hasErrors: true
        },
        timeout: config.timeout
      }],
      parameters: {
        endpoint: config.endpoint,
        headers: config.headers,
        validateSchema: config.validateSchema
      },
      environment: {
        name: 'test',
        variables: {}
      },
      timeout: API_TEST_CONFIG.timeout,
      retries: config.retryAttempts
    },
    test_data_id: '',
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date()
  });

  return negativeFlows;
}

/**
 * Generates positive test flow for a REST endpoint
 */
function generatePositiveRESTFlow(
  endpoint: any,
  config: RESTClientConfig
): ITestFlow {
  return {
    id: `rest-${endpoint.method}-${endpoint.path}-positive`,
    name: `REST ${endpoint.method} ${endpoint.path} Positive Test`,
    description: `Validates successful execution of ${endpoint.method} ${endpoint.path}`,
    flow_type: 'rest',
    config: {
      steps: [{
        name: `Execute ${endpoint.method} ${endpoint.path}`,
        type: 'rest',
        action: 'execute',
        input: {
          method: endpoint.method,
          url: `${config.baseUrl}${endpoint.path}`,
          data: generateValidRequestBody(endpoint.requestBody),
          params: generateValidParameters(endpoint.parameters)
        },
        expected: {
          status: endpoint.responses['200'] ? 200 : 201,
          hasData: true
        },
        timeout: config.timeout
      }],
      parameters: {
        baseUrl: config.baseUrl,
        headers: config.headers,
        validateStatus: config.validateStatus
      },
      environment: {
        name: 'test',
        variables: {}
      },
      timeout: API_TEST_CONFIG.timeout,
      retries: config.retryConfig.attempts
    },
    test_data_id: '',
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date()
  };
}

/**
 * Generates negative test flows for a REST endpoint
 */
function generateNegativeRESTFlows(
  endpoint: any,
  config: RESTClientConfig
): ITestFlow[] {
  const negativeFlows: ITestFlow[] = [];

  // Invalid request body test
  if (endpoint.requestBody) {
    negativeFlows.push({
      id: `rest-${endpoint.method}-${endpoint.path}-invalid-body`,
      name: `REST ${endpoint.method} ${endpoint.path} Invalid Body Test`,
      description: `Validates error handling for invalid request body in ${endpoint.method} ${endpoint.path}`,
      flow_type: 'rest',
      config: {
        steps: [{
          name: `Execute ${endpoint.method} ${endpoint.path} with invalid body`,
          type: 'rest',
          action: 'execute',
          input: {
            method: endpoint.method,
            url: `${config.baseUrl}${endpoint.path}`,
            data: generateInvalidRequestBody(endpoint.requestBody),
            params: generateValidParameters(endpoint.parameters)
          },
          expected: {
            status: 400,
            hasError: true
          },
          timeout: config.timeout
        }],
        parameters: {
          baseUrl: config.baseUrl,
          headers: config.headers,
          validateStatus: config.validateStatus
        },
        environment: {
          name: 'test',
          variables: {}
        },
        timeout: API_TEST_CONFIG.timeout,
        retries: config.retryConfig.attempts
      },
      test_data_id: '',
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  return negativeFlows;
}

/**
 * Helper function to generate a GraphQL query string
 */
function generateGraphQLQuery(operation: any): string {
  const { type, name, arguments: args, returnType } = operation;
  const argString = args.length > 0
    ? `(${args.map(arg => `$${arg.name}: ${arg.type}`).join(', ')})`
    : '';
  
  return `
    ${type} ${name}${argString} {
      ${name}${args.length > 0 ? `(${args.map(arg => `${arg.name}: $${arg.name}`).join(', ')})` : ''} {
        ${generateReturnTypeFields(returnType)}
      }
    }
  `;
}

/**
 * Helper function to generate return type fields for GraphQL query
 */
function generateReturnTypeFields(returnType: string): string {
  // Basic implementation - can be enhanced based on schema type definitions
  return 'id name description';
}

/**
 * Helper function to generate valid variables for GraphQL operation
 */
function generateValidVariables(args: any[]): Record<string, any> {
  const variables: Record<string, any> = {};
  
  for (const arg of args) {
    variables[arg.name] = generateValidValue(arg.type);
  }

  return variables;
}

/**
 * Helper function to generate invalid variables for GraphQL operation
 */
function generateInvalidVariables(args: any[]): Record<string, any> {
  const variables: Record<string, any> = {};
  
  for (const arg of args) {
    variables[arg.name] = generateInvalidValue(arg.type);
  }

  return variables;
}

/**
 * Helper function to generate valid request body for REST endpoint
 */
function generateValidRequestBody(schema: any): Record<string, any> {
  if (!schema) return {};
  
  const body: Record<string, any> = {};
  
  // Generate valid data based on schema
  for (const [key, value] of Object.entries(schema.schema.properties || {})) {
    body[key] = generateValidValue(value);
  }

  return body;
}

/**
 * Helper function to generate invalid request body for REST endpoint
 */
function generateInvalidRequestBody(schema: any): Record<string, any> {
  if (!schema) return {};
  
  const body: Record<string, any> = {};
  
  // Generate invalid data based on schema
  for (const [key, value] of Object.entries(schema.schema.properties || {})) {
    body[key] = generateInvalidValue(value);
  }

  return body;
}

/**
 * Helper function to generate valid parameters for REST endpoint
 */
function generateValidParameters(parameters: any[]): Record<string, any> {
  const params: Record<string, any> = {};
  
  for (const param of parameters) {
    if (param.in === 'query') {
      params[param.name] = generateValidValue(param.type);
    }
  }

  return params;
}

/**
 * Helper function to generate valid value based on type
 */
function generateValidValue(type: any): any {
  switch (type) {
    case 'String':
    case 'string':
      return 'test-value';
    case 'Int':
    case 'integer':
      return 42;
    case 'Float':
    case 'number':
      return 42.42;
    case 'Boolean':
    case 'boolean':
      return true;
    case 'ID':
      return 'test-id-123';
    default:
      return null;
  }
}

/**
 * Helper function to generate invalid value based on type
 */
function generateInvalidValue(type: any): any {
  switch (type) {
    case 'String':
    case 'string':
      return 42;
    case 'Int':
    case 'integer':
      return 'invalid';
    case 'Float':
    case 'number':
      return 'invalid';
    case 'Boolean':
    case 'boolean':
      return 'invalid';
    case 'ID':
      return {};
    default:
      return undefined;
  }
}