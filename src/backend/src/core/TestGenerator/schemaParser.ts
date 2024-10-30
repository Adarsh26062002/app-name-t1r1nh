/**
 * schemaParser.ts
 * Responsible for parsing GraphQL and REST API schemas to facilitate test case generation.
 * Implements comprehensive schema parsing capabilities ensuring type safety and validation.
 * 
 * @version typescript: 4.9.5
 * @version graphql: ^16.8.0
 * @version openapi-types: ^12.1.3
 */

import {
  buildSchema,
  GraphQLSchema,
  introspectionFromSchema,
  IntrospectionQuery,
  getIntrospectionQuery,
  buildClientSchema
} from 'graphql'; // ^16.8.0

import { OpenAPIV3 } from 'openapi-types'; // ^12.1.3

import {
  GraphQLClientConfig,
  RESTClientConfig
} from '../types/api.types';

import { validateTestData } from '../utils/validators';
import { formatSuccessMessage } from '../utils/formatters';

// Types for parsed schema components
interface ParsedGraphQLType {
  name: string;
  fields: Array<{
    name: string;
    type: string;
    isRequired: boolean;
    isList: boolean;
  }>;
}

interface ParsedGraphQLOperation {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  arguments: Array<{
    name: string;
    type: string;
    isRequired: boolean;
  }>;
  returnType: string;
}

interface ParsedRESTEndpoint {
  path: string;
  method: string;
  parameters: Array<{
    name: string;
    in: 'path' | 'query' | 'header' | 'body';
    type: string;
    required: boolean;
  }>;
  requestBody?: {
    contentType: string;
    schema: object;
  };
  responses: {
    [statusCode: string]: {
      description: string;
      schema?: object;
    };
  };
}

/**
 * Parses a GraphQL schema to extract types, queries, mutations, and subscriptions.
 * Implements requirement: GraphQL Schema Validation (system_design.api_design.graphql_client_configuration)
 * 
 * @param config - GraphQL client configuration
 * @returns Promise resolving to parsed schema details
 */
export async function parseGraphQLSchema(
  config: GraphQLClientConfig
): Promise<{
  types: ParsedGraphQLType[];
  operations: ParsedGraphQLOperation[];
  schema: GraphQLSchema;
}> {
  // Validate the GraphQL client configuration
  validateTestData({
    id: 'schema-validation',
    name: 'GraphQL Schema Validation',
    scope: 'integration',
    schema: config
  });

  try {
    // Fetch schema using introspection query
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        ...config.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: getIntrospectionQuery()
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch GraphQL schema: ${response.statusText}`);
    }

    const introspectionResult = await response.json();
    const clientSchema = buildClientSchema(introspectionResult.data as IntrospectionQuery);
    
    // Parse types
    const types: ParsedGraphQLType[] = [];
    const typeMap = clientSchema.getTypeMap();
    
    for (const [typeName, type] of Object.entries(typeMap)) {
      // Skip internal GraphQL types
      if (typeName.startsWith('__')) continue;

      if ('getFields' in type) {
        const fields = type.getFields();
        types.push({
          name: typeName,
          fields: Object.values(fields).map(field => ({
            name: field.name,
            type: field.type.toString(),
            isRequired: field.type.toString().endsWith('!'),
            isList: field.type.toString().includes('[')
          }))
        });
      }
    }

    // Parse operations
    const operations: ParsedGraphQLOperation[] = [];
    const queryType = clientSchema.getQueryType();
    const mutationType = clientSchema.getMutationType();
    const subscriptionType = clientSchema.getSubscriptionType();

    // Parse queries
    if (queryType) {
      const queryFields = queryType.getFields();
      for (const [name, field] of Object.entries(queryFields)) {
        operations.push({
          name,
          type: 'query',
          arguments: field.args.map(arg => ({
            name: arg.name,
            type: arg.type.toString(),
            isRequired: arg.type.toString().endsWith('!')
          })),
          returnType: field.type.toString()
        });
      }
    }

    // Parse mutations
    if (mutationType) {
      const mutationFields = mutationType.getFields();
      for (const [name, field] of Object.entries(mutationFields)) {
        operations.push({
          name,
          type: 'mutation',
          arguments: field.args.map(arg => ({
            name: arg.name,
            type: arg.type.toString(),
            isRequired: arg.type.toString().endsWith('!')
          })),
          returnType: field.type.toString()
        });
      }
    }

    // Parse subscriptions
    if (subscriptionType) {
      const subscriptionFields = subscriptionType.getFields();
      for (const [name, field] of Object.entries(subscriptionFields)) {
        operations.push({
          name,
          type: 'subscription',
          arguments: field.args.map(arg => ({
            name: arg.name,
            type: arg.type.toString(),
            isRequired: arg.type.toString().endsWith('!')
          })),
          returnType: field.type.toString()
        });
      }
    }

    formatSuccessMessage('Successfully parsed GraphQL schema');

    return {
      types,
      operations,
      schema: clientSchema
    };
  } catch (error) {
    throw new Error(`GraphQL schema parsing failed: ${error.message}`);
  }
}

/**
 * Parses a REST API schema (OpenAPI/Swagger) to extract endpoints and operations.
 * Implements requirement: REST Schema Validation (system_design.api_design.rest_client_configuration)
 * 
 * @param config - REST client configuration
 * @returns Promise resolving to parsed endpoint details
 */
export async function parseRESTSchema(
  config: RESTClientConfig
): Promise<{
  endpoints: ParsedRESTEndpoint[];
  schemas: { [key: string]: object };
}> {
  // Validate the REST client configuration
  validateTestData({
    id: 'schema-validation',
    name: 'REST Schema Validation',
    scope: 'integration',
    schema: config
  });

  try {
    // Fetch OpenAPI schema
    const response = await fetch(`${config.baseUrl}/openapi.json`, {
      method: 'GET',
      headers: config.headers,
      signal: AbortSignal.timeout(config.timeout)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch REST API schema: ${response.statusText}`);
    }

    const openApiSchema: OpenAPIV3.Document = await response.json();
    const endpoints: ParsedRESTEndpoint[] = [];
    const schemas: { [key: string]: object } = {};

    // Extract component schemas
    if (openApiSchema.components?.schemas) {
      Object.entries(openApiSchema.components.schemas).forEach(([name, schema]) => {
        schemas[name] = schema;
      });
    }

    // Parse paths and operations
    for (const [path, pathItem] of Object.entries(openApiSchema.paths)) {
      // Process each HTTP method
      for (const [method, operation] of Object.entries(pathItem)) {
        if (method === 'parameters' || !operation) continue;

        const endpoint: ParsedRESTEndpoint = {
          path,
          method: method.toUpperCase(),
          parameters: [],
          responses: {}
        };

        // Parse parameters
        const parameters = [
          ...(pathItem.parameters || []),
          ...(operation.parameters || [])
        ];

        endpoint.parameters = parameters.map(param => ({
          name: param.name,
          in: param.in as 'path' | 'query' | 'header' | 'body',
          type: 'schema' in param ? JSON.stringify(param.schema) : 'string',
          required: param.required || false
        }));

        // Parse request body
        if (operation.requestBody) {
          const content = (operation.requestBody as OpenAPIV3.RequestBodyObject).content;
          const contentType = Object.keys(content)[0];
          endpoint.requestBody = {
            contentType,
            schema: content[contentType].schema as object
          };
        }

        // Parse responses
        for (const [statusCode, response] of Object.entries(operation.responses)) {
          endpoint.responses[statusCode] = {
            description: response.description || '',
            schema: response.content?.['application/json']?.schema
          };
        }

        endpoints.push(endpoint);
      }
    }

    formatSuccessMessage('Successfully parsed REST API schema');

    return {
      endpoints,
      schemas
    };
  } catch (error) {
    throw new Error(`REST schema parsing failed: ${error.message}`);
  }
}