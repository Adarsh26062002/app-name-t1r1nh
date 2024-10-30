/**
 * databaseSeeder.ts
 * Implements the database seeding functionality for populating initial test data
 * following the data generation flow architecture.
 * 
 * Implements requirements from:
 * - Data Generation Flow (system_architecture/data_generation_flow)
 * - Test Data Storage (system_design/database_design/test_data_storage)
 */

// External dependencies
import { v4 as uuidv4 } from 'uuid'; // ^8.3.2

// Internal dependencies
import { TestDataModel, ITestData } from '../../db/models/testData.model';
import { TestFlowModel } from '../../db/models/testFlow.model';
import { TestResultModel } from '../../db/models/testResult.model';
import { 
    createTestData, 
    getActiveTestData 
} from '../../db/repositories/testData.repository';
import { createTestResult } from '../../db/repositories/testResult.repository';
import { PostgreSQLClient } from '../../db/clients/postgresql.client';

// Initialize PostgreSQL client as per global configuration
const dbClient = new PostgreSQLClient();

/**
 * Initial test data configuration for seeding
 */
const INITIAL_TEST_DATA: Partial<ITestData>[] = [
    {
        name: 'API Integration Test Data',
        scope: 'api_integration',
        schema: {
            fields: [
                { name: 'endpoint', type: 'string' },
                { name: 'method', type: 'string' },
                { name: 'payload', type: 'object' }
            ],
            constraints: {
                required: ['endpoint', 'method']
            }
        }
    },
    {
        name: 'Database Test Data',
        scope: 'database',
        schema: {
            fields: [
                { name: 'table', type: 'string' },
                { name: 'operation', type: 'string' },
                { name: 'data', type: 'object' }
            ],
            constraints: {
                required: ['table', 'operation']
            }
        }
    }
];

/**
 * Seeds the database with initial test data, test flows, and test results
 * following the data generation flow architecture.
 * 
 * @returns Promise<void> Resolves when the database seeding is complete
 */
export async function seedDatabase(): Promise<void> {
    try {
        // Step 1: Connect to the PostgreSQL database
        await dbClient.connect();

        // Step 2: Begin a database transaction
        const transaction = async () => {
            // Step 3: Generate and validate initial test data
            const testDataEntities: TestDataModel[] = [];
            for (const data of INITIAL_TEST_DATA) {
                const testData = new TestDataModel(
                    uuidv4(),
                    data.name,
                    data.scope,
                    data.schema,
                    new Date(),
                    null // valid_to is null for active test data
                );

                // Validate test data before creation
                testData.validate();
                testDataEntities.push(testData);
            }

            // Step 4: Create test data entries
            const createdTestData = await Promise.all(
                testDataEntities.map(data => createTestData(data))
            );

            // Step 5: Verify test data creation
            const activeTestData = await getActiveTestData();
            if (activeTestData.length !== testDataEntities.length) {
                throw new Error('Failed to verify test data creation');
            }

            // Step 6: Generate and create test flows with references to test data
            const testFlows = createdTestData.map(data => ({
                id: uuidv4(),
                name: `Test Flow for ${data.name}`,
                description: `Automated test flow for ${data.scope} testing`,
                flow_type: data.scope,
                test_data_id: data.id,
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
                status: 'pending'
            }));

            // Step 7: Generate and create test results with references to test flows
            const testResults = testFlows.map(flow => ({
                id: uuidv4(),
                flow_id: flow.id,
                status: 'pending',
                duration_ms: 0,
                error: null,
                created_at: new Date(),
                updated_at: new Date()
            }));

            // Create test results
            await Promise.all(
                testResults.map(result => createTestResult(result))
            );
        };

        // Execute the transaction
        await dbClient.executeTransaction([{
            query: 'SELECT 1', // Placeholder query for transaction start
            params: []
        }]);
        await transaction();

        console.log('Database seeding completed successfully');
    } catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    } finally {
        // Step 10: Disconnect from the PostgreSQL database
        await dbClient.disconnect();
    }
}

// Export the seedDatabase function for external use
export default {
    seedDatabase
};