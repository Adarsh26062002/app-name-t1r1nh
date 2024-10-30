/**
 * DataGenerator/index.ts
 * Entry point for the Data Generator module that orchestrates test data generation,
 * seeding, and validation across Events and Inventory databases.
 * 
 * @version 1.0.0
 */

// Import internal dependencies
import { generateTestData } from './testDataGenerator';
import { seedDatabase } from './databaseSeeder';
import { validateSchema } from './schemaValidator';
import { ITestData } from '../../types/db.types';

/**
 * Initializes the data generation process by coordinating seeding, generation,
 * and validation of test data across Events and Inventory databases.
 * 
 * Implements requirements from:
 * - Data Generation Flow (system_architecture.data_generation_flow)
 * - Component Responsibilities (system_architecture.component_responsibilities)
 * 
 * The sequence follows:
 * 1. Seed both Events and Inventory databases with initial data
 * 2. Generate test data with proper reference integrity
 * 3. Validate generated data schemas against ERD specifications
 * 
 * @returns Promise<void> Resolves when initialization is complete
 * @throws Error if any step in the initialization process fails
 */
export async function initializeDataGenerator(): Promise<void> {
    try {
        // Step 1: Seed both Events and Inventory databases with initial test data
        // This establishes the base data structure as per the ERD specification
        await seedDatabase();

        // Step 2: Generate test data for Events database
        const eventsTestData: ITestData = {
            id: 'events-test-data',
            name: 'Events Test Dataset',
            scope: 'events',
            schema: {
                testSuite: {
                    name: 'Events Database Tests',
                    description: 'Test suite for Events database validation'
                },
                testCases: [
                    {
                        name: 'Event Creation Test',
                        flowType: 'database',
                        config: {
                            timeout: 30000,
                            query: 'INSERT INTO events',
                            parameters: ['id', 'type', 'timestamp', 'payload']
                        }
                    }
                ],
                testSteps: [
                    {
                        operation: 'create',
                        request: { type: 'event_creation' },
                        expected: { status: 'success' },
                        sequence: 1
                    }
                ],
                dataSets: [
                    {
                        values: { type: 'test_event' },
                        status: 'active'
                    }
                ]
            },
            valid_from: new Date(),
            valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days validity
        };

        // Generate and validate Events test data
        await generateTestData(eventsTestData);
        await validateSchema(eventsTestData);

        // Step 3: Generate test data for Inventory database with references to Events
        const inventoryTestData: ITestData = {
            id: 'inventory-test-data',
            name: 'Inventory Test Dataset',
            scope: 'inventory',
            schema: {
                testSuite: {
                    name: 'Inventory Database Tests',
                    description: 'Test suite for Inventory database validation'
                },
                testCases: [
                    {
                        name: 'Inventory Creation Test',
                        flowType: 'database',
                        config: {
                            timeout: 30000,
                            query: 'INSERT INTO inventory',
                            parameters: ['id', 'event_id', 'quantity', 'status', 'metadata']
                        }
                    }
                ],
                testSteps: [
                    {
                        operation: 'create',
                        request: { 
                            event_id: eventsTestData.id, // Reference to Events test data
                            quantity: 100 
                        },
                        expected: { status: 'success' },
                        sequence: 1
                    }
                ],
                dataSets: [
                    {
                        values: { 
                            status: 'active',
                            metadata: { generated: true }
                        },
                        status: 'active'
                    }
                ]
            },
            valid_from: new Date(),
            valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days validity
        };

        // Generate and validate Inventory test data
        await generateTestData(inventoryTestData);
        await validateSchema(inventoryTestData);

        // Step 4: Validate reference integrity between Events and Inventory
        // This is handled internally by generateTestData which ensures proper references

        console.log('Data Generator initialization completed successfully');
    } catch (error) {
        console.error('Data Generator initialization failed:', error);
        throw new Error(`Failed to initialize Data Generator: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Export the initialization function
export default {
    initializeDataGenerator
};