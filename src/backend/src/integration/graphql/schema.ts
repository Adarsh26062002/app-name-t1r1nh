/**
 * GraphQL Schema Definition
 * Implements requirements from:
 * 1. GraphQL Schema Definition (system_design.api_design.graphql_client_configuration)
 * 2. Integration Layer Component (system_architecture.high-level_architecture_overview)
 * 
 * @version graphql: 16.8.1
 * @version graphql-tools: 8.3.1
 */

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLID,
  GraphQLNonNull,
  GraphQLList,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLInputObjectType,
  GraphQLEnumType
} from 'graphql';
import { makeExecutableSchema } from 'graphql-tools';
import { executeQuery, GraphQLResponse } from './client';
import { GraphQLClientConfig } from '../types/api.types';
import { validateTestData } from '../../utils/validators';

// Enum types for test flow and result statuses
const TestFlowStatusEnum = new GraphQLEnumType({
  name: 'TestFlowStatus',
  description: 'Status of a test flow execution',
  values: {
    PENDING: { value: 'pending' },
    RUNNING: { value: 'running' },
    COMPLETED: { value: 'completed' },
    FAILED: { value: 'failed' },
    CANCELLED: { value: 'cancelled' }
  }
});

const TestResultStatusEnum = new GraphQLEnumType({
  name: 'TestResultStatus',
  description: 'Status of a test execution result',
  values: {
    PASS: { value: 'pass' },
    FAIL: { value: 'fail' },
    ERROR: { value: 'error' },
    SKIPPED: { value: 'skipped' }
  }
});

/**
 * Defines GraphQL object types for test data, flows, and results
 * Implements: Test data storage schema from system_design.database_design.test_data_storage
 */
const defineTypes = () => {
  // Test Data Type
  const TestDataType = new GraphQLObjectType({
    name: 'TestData',
    description: 'Test data entity with validation schema',
    fields: () => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
      name: { type: new GraphQLNonNull(GraphQLString) },
      scope: { type: new GraphQLNonNull(GraphQLString) },
      schema: { type: new GraphQLNonNull(GraphQLString) },
      valid_from: { type: new GraphQLNonNull(GraphQLString) },
      valid_to: { type: new GraphQLNonNull(GraphQLString) },
      created_at: { type: new GraphQLNonNull(GraphQLString) },
      updated_at: { type: GraphQLString }
    })
  });

  // Test Flow Type
  const TestFlowType = new GraphQLObjectType({
    name: 'TestFlow',
    description: 'Test flow configuration and execution details',
    fields: () => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
      name: { type: new GraphQLNonNull(GraphQLString) },
      flow_type: { type: new GraphQLNonNull(GraphQLString) },
      test_data_id: { type: new GraphQLNonNull(GraphQLID) },
      config: { type: new GraphQLNonNull(GraphQLString) },
      status: { type: new GraphQLNonNull(TestFlowStatusEnum) },
      created_at: { type: new GraphQLNonNull(GraphQLString) },
      updated_at: { type: GraphQLString }
    })
  });

  // Test Result Type
  const TestResultType = new GraphQLObjectType({
    name: 'TestResult',
    description: 'Test execution result details',
    fields: () => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
      flow_id: { type: new GraphQLNonNull(GraphQLID) },
      status: { type: new GraphQLNonNull(TestResultStatusEnum) },
      duration_ms: { type: new GraphQLNonNull(GraphQLFloat) },
      error: { type: GraphQLString },
      created_at: { type: new GraphQLNonNull(GraphQLString) }
    })
  });

  return { TestDataType, TestFlowType, TestResultType };
};

/**
 * Defines GraphQL input types for mutations
 */
const defineInputTypes = () => {
  // Test Data Input Type
  const TestDataInput = new GraphQLInputObjectType({
    name: 'TestDataInput',
    description: 'Input type for creating test data',
    fields: {
      name: { type: new GraphQLNonNull(GraphQLString) },
      scope: { type: new GraphQLNonNull(GraphQLString) },
      schema: { type: new GraphQLNonNull(GraphQLString) },
      valid_from: { type: new GraphQLNonNull(GraphQLString) },
      valid_to: { type: new GraphQLNonNull(GraphQLString) }
    }
  });

  // Test Flow Input Type
  const TestFlowInput = new GraphQLInputObjectType({
    name: 'TestFlowInput',
    description: 'Input type for creating test flow',
    fields: {
      name: { type: new GraphQLNonNull(GraphQLString) },
      flow_type: { type: new GraphQLNonNull(GraphQLString) },
      test_data_id: { type: new GraphQLNonNull(GraphQLID) },
      config: { type: new GraphQLNonNull(GraphQLString) }
    }
  });

  return { TestDataInput, TestFlowInput };
};

/**
 * Defines GraphQL queries for retrieving test entities
 * Implements: Query operations from system_design.api_design.graphql_client_configuration
 */
const defineQueries = (types: ReturnType<typeof defineTypes>) => {
  const { TestDataType, TestFlowType, TestResultType } = types;

  return new GraphQLObjectType({
    name: 'Query',
    description: 'Root query type for test entities',
    fields: {
      getTestData: {
        type: new GraphQLList(TestDataType),
        args: {
          scope: { type: GraphQLString },
          limit: { type: GraphQLInt },
          offset: { type: GraphQLInt }
        },
        resolve: async (_, args) => {
          const response = await executeQuery<any[]>(`
            query GetTestData($scope: String, $limit: Int, $offset: Int) {
              testData(scope: $scope, limit: $limit, offset: $offset) {
                id name scope schema valid_from valid_to created_at updated_at
              }
            }
          `, args);
          return response.data;
        }
      },
      getTestFlow: {
        type: TestFlowType,
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
        },
        resolve: async (_, { id }) => {
          const response = await executeQuery<any>(`
            query GetTestFlow($id: ID!) {
              testFlow(id: $id) {
                id name flow_type test_data_id config status created_at updated_at
              }
            }
          `, { id });
          return response.data;
        }
      },
      getTestResults: {
        type: new GraphQLList(TestResultType),
        args: {
          flow_id: { type: new GraphQLNonNull(GraphQLID) }
        },
        resolve: async (_, { flow_id }) => {
          const response = await executeQuery<any[]>(`
            query GetTestResults($flow_id: ID!) {
              testResults(flow_id: $flow_id) {
                id flow_id status duration_ms error created_at
              }
            }
          `, { flow_id });
          return response.data;
        }
      }
    }
  });
};

/**
 * Defines GraphQL mutations for creating and updating test entities
 * Implements: Mutation operations from system_design.api_design.graphql_client_configuration
 */
const defineMutations = (types: ReturnType<typeof defineTypes>, inputTypes: ReturnType<typeof defineInputTypes>) => {
  const { TestDataType, TestFlowType, TestResultType } = types;
  const { TestDataInput, TestFlowInput } = inputTypes;

  return new GraphQLObjectType({
    name: 'Mutation',
    description: 'Root mutation type for test entities',
    fields: {
      createTestData: {
        type: TestDataType,
        args: {
          input: { type: new GraphQLNonNull(TestDataInput) }
        },
        resolve: async (_, { input }) => {
          // Validate test data before mutation
          validateTestData(input);
          
          const response = await executeQuery<any>(`
            mutation CreateTestData($input: TestDataInput!) {
              createTestData(input: $input) {
                id name scope schema valid_from valid_to created_at
              }
            }
          `, { input });
          return response.data;
        }
      },
      updateTestFlow: {
        type: TestFlowType,
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) },
          status: { type: new GraphQLNonNull(TestFlowStatusEnum) }
        },
        resolve: async (_, args) => {
          const response = await executeQuery<any>(`
            mutation UpdateTestFlow($id: ID!, $status: TestFlowStatus!) {
              updateTestFlow(id: $id, status: $status) {
                id status updated_at
              }
            }
          `, args);
          return response.data;
        }
      },
      createTestResult: {
        type: TestResultType,
        args: {
          flow_id: { type: new GraphQLNonNull(GraphQLID) },
          status: { type: new GraphQLNonNull(TestResultStatusEnum) },
          duration_ms: { type: new GraphQLNonNull(GraphQLFloat) },
          error: { type: GraphQLString }
        },
        resolve: async (_, args) => {
          const response = await executeQuery<any>(`
            mutation CreateTestResult($flow_id: ID!, $status: TestResultStatus!, $duration_ms: Float!, $error: String) {
              createTestResult(flow_id: $flow_id, status: $status, duration_ms: $duration_ms, error: $error) {
                id flow_id status duration_ms error created_at
              }
            }
          `, args);
          return response.data;
        }
      }
    }
  });
};

/**
 * Combines types, queries, and mutations into a complete GraphQL schema
 * Implements: Schema composition from system_design.api_design.graphql_client_configuration
 */
const defineSchema = (): GraphQLSchema => {
  // Initialize types
  const types = defineTypes();
  const inputTypes = defineInputTypes();

  // Create root query and mutation
  const query = defineQueries(types);
  const mutation = defineMutations(types, inputTypes);

  // Combine into schema
  return new GraphQLSchema({
    query,
    mutation,
    types: Object.values(types)
  });
};

// Export the complete GraphQL schema
export const schema = defineSchema();
export default schema;