/**
 * dbTestGenerator.ts
 * Implements database test case generation functionality with comprehensive validation
 * of database operations, data integrity, and state management.
 * 
 * @version typescript 4.9.5
 * @version pg 8.7.1
 */

import { parseGraphQLSchema, parseRESTSchema } from './schemaParser';
import { generateTestData } from '../DataGenerator/testDataGenerator';
import { 
    connect, 
    disconnect, 
    executeQuery, 
    executeTransaction 
} from '../../db/clients/postgresql.client';
import { ITestData, ITestFlow, TestFlowStatus } from '../../types/db.types';

// Types for database test flows
interface DBTestCase {
    name: string;
    description: string;
    steps: DBTestStep[];
    expectedState: Record<string, any>;
}

interface DBTestStep {
    operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT';
    table: string;
    data?: Record<string, any>;
    condition?: string;
    expectedResult?: Record<string, any>;
}

interface DBTestFlow extends ITestFlow {
    testCases: DBTestCase[];
    database: 'events' | 'inventory';
}

/**
 * Generates comprehensive database test cases based on schema information
 * Implements requirements from:
 * - Database Test Generation (system_architecture.component_responsibilities)
 * - Test Data Storage (system_design.database_design.test_data_storage)
 * 
 * @param testData Configuration for test data generation
 * @returns Promise<Array<ITestFlow>> Array of generated database test flows
 */
export async function generateDBTests(testData: ITestData): Promise<Array<ITestFlow>> {
    try {
        // Step 1: Parse GraphQL and REST schemas to understand data structures
        const graphQLSchema = await parseGraphQLSchema({
            endpoint: process.env.GRAPHQL_ENDPOINT!,
            headers: { 'Content-Type': 'application/json' }
        });

        const restSchema = await parseRESTSchema({
            baseUrl: process.env.REST_API_BASE_URL!,
            headers: { 'Accept': 'application/json' },
            timeout: 5000
        });

        // Step 2: Generate and validate test data
        const generatedTestData = await generateTestData(testData);

        // Step 3: Connect to PostgreSQL database
        await connect();

        // Step 4: Generate test flows for Events DB
        const eventsDBTests = await generateEventsDBTests(generatedTestData, graphQLSchema);

        // Step 5: Generate test flows for Inventory DB
        const inventoryDBTests = await generateInventoryDBTests(generatedTestData, restSchema);

        // Step 6: Generate cross-database relationship tests
        const relationshipTests = await generateRelationshipTests(generatedTestData);

        // Combine all test flows
        const allTestFlows: Array<ITestFlow> = [
            ...eventsDBTests,
            ...inventoryDBTests,
            ...relationshipTests
        ];

        return allTestFlows;

    } catch (error) {
        throw new Error(`Failed to generate database tests: ${error.message}`);
    } finally {
        await disconnect();
    }
}

/**
 * Generates test cases for Events database operations
 * Implements test case generation for Events DB schema
 */
async function generateEventsDBTests(
    testData: ITestData,
    schema: any
): Promise<Array<ITestFlow>> {
    const eventTests: DBTestFlow[] = [{
        id: `evt-test-${Date.now()}`,
        name: 'Events DB CRUD Operations',
        description: 'Validates CRUD operations on Events database',
        flow_type: 'database',
        config: {
            steps: [],
            parameters: {},
            environment: {
                name: 'test',
                variables: {}
            },
            timeout: 30000,
            retries: 3
        },
        test_data_id: testData.id,
        status: TestFlowStatus.PENDING,
        created_at: new Date(),
        updated_at: new Date(),
        testCases: [],
        database: 'events'
    }];

    // Generate CRUD test cases
    const crudTestCases: DBTestCase[] = [
        {
            name: 'Event Creation Test',
            description: 'Validates event insertion with proper schema validation',
            steps: [
                {
                    operation: 'INSERT',
                    table: 'events',
                    data: {
                        type: 'TEST_EVENT',
                        payload: { test: true },
                        timestamp: new Date()
                    },
                    expectedResult: { rowCount: 1 }
                }
            ],
            expectedState: { eventExists: true }
        },
        {
            name: 'Event Query Test',
            description: 'Validates event retrieval operations',
            steps: [
                {
                    operation: 'SELECT',
                    table: 'events',
                    condition: "type = 'TEST_EVENT'",
                    expectedResult: { rowCount: 1 }
                }
            ],
            expectedState: { eventFound: true }
        }
    ];

    eventTests[0].testCases = crudTestCases;
    return eventTests;
}

/**
 * Generates test cases for Inventory database operations
 * Implements test case generation for Inventory DB schema
 */
async function generateInventoryDBTests(
    testData: ITestData,
    schema: any
): Promise<Array<ITestFlow>> {
    const inventoryTests: DBTestFlow[] = [{
        id: `inv-test-${Date.now()}`,
        name: 'Inventory DB CRUD Operations',
        description: 'Validates CRUD operations on Inventory database',
        flow_type: 'database',
        config: {
            steps: [],
            parameters: {},
            environment: {
                name: 'test',
                variables: {}
            },
            timeout: 30000,
            retries: 3
        },
        test_data_id: testData.id,
        status: TestFlowStatus.PENDING,
        created_at: new Date(),
        updated_at: new Date(),
        testCases: [],
        database: 'inventory'
    }];

    // Generate CRUD test cases
    const crudTestCases: DBTestCase[] = [
        {
            name: 'Inventory Creation Test',
            description: 'Validates inventory item insertion with proper schema validation',
            steps: [
                {
                    operation: 'INSERT',
                    table: 'inventory',
                    data: {
                        item_id: 'TEST_ITEM',
                        quantity: 100,
                        status: 'AVAILABLE'
                    },
                    expectedResult: { rowCount: 1 }
                }
            ],
            expectedState: { itemExists: true }
        },
        {
            name: 'Inventory Update Test',
            description: 'Validates inventory item update operations',
            steps: [
                {
                    operation: 'UPDATE',
                    table: 'inventory',
                    data: { quantity: 50 },
                    condition: "item_id = 'TEST_ITEM'",
                    expectedResult: { rowCount: 1 }
                }
            ],
            expectedState: { itemUpdated: true }
        }
    ];

    inventoryTests[0].testCases = crudTestCases;
    return inventoryTests;
}

/**
 * Generates test cases for cross-database relationships
 * Implements test case generation for database relationship validation
 */
async function generateRelationshipTests(
    testData: ITestData
): Promise<Array<ITestFlow>> {
    const relationshipTests: DBTestFlow[] = [{
        id: `rel-test-${Date.now()}`,
        name: 'Cross-Database Relationship Tests',
        description: 'Validates relationships between Events and Inventory databases',
        flow_type: 'database',
        config: {
            steps: [],
            parameters: {},
            environment: {
                name: 'test',
                variables: {}
            },
            timeout: 30000,
            retries: 3
        },
        test_data_id: testData.id,
        status: TestFlowStatus.PENDING,
        created_at: new Date(),
        updated_at: new Date(),
        testCases: [],
        database: 'events'
    }];

    // Generate relationship test cases
    const relationshipTestCases: DBTestCase[] = [
        {
            name: 'Event-Inventory Relationship Test',
            description: 'Validates referential integrity between events and inventory',
            steps: [
                {
                    operation: 'INSERT',
                    table: 'events',
                    data: {
                        type: 'INVENTORY_UPDATE',
                        payload: { item_id: 'TEST_ITEM' },
                        timestamp: new Date()
                    },
                    expectedResult: { rowCount: 1 }
                },
                {
                    operation: 'SELECT',
                    table: 'inventory',
                    condition: "item_id = 'TEST_ITEM'",
                    expectedResult: { rowCount: 1 }
                }
            ],
            expectedState: { relationshipValid: true }
        }
    ];

    relationshipTests[0].testCases = relationshipTestCases;
    return relationshipTests;
}

/**
 * Validates test case execution results
 * Implements test result validation requirements
 */
async function validateTestResults(
    testFlow: DBTestFlow,
    results: Array<Record<string, any>>
): Promise<boolean> {
    try {
        for (let i = 0; i < testFlow.testCases.length; i++) {
            const testCase = testFlow.testCases[i];
            const result = results[i];

            // Validate each step's results
            for (const step of testCase.steps) {
                if (step.expectedResult && 
                    JSON.stringify(step.expectedResult) !== JSON.stringify(result)) {
                    return false;
                }
            }

            // Validate final state
            if (testCase.expectedState) {
                const stateValidation = await validateDatabaseState(
                    testFlow.database,
                    testCase.expectedState
                );
                if (!stateValidation) {
                    return false;
                }
            }
        }
        return true;
    } catch (error) {
        throw new Error(`Test result validation failed: ${error.message}`);
    }
}

/**
 * Validates database state after test execution
 * Implements database state validation requirements
 */
async function validateDatabaseState(
    database: string,
    expectedState: Record<string, any>
): Promise<boolean> {
    try {
        const stateQueries = Object.entries(expectedState).map(([key, value]) => ({
            query: `SELECT EXISTS (
                SELECT 1 FROM ${database}
                WHERE ${key} = $1
            )`,
            params: [value]
        }));

        const results = await executeTransaction(stateQueries);
        return results.every(result => result.rows[0].exists);
    } catch (error) {
        throw new Error(`Database state validation failed: ${error.message}`);
    }
}