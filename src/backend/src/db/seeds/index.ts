/**
 * index.ts (Database Seeds)
 * Implements the database seeding functionality for initializing test data and configurations.
 * 
 * Implements requirements from:
 * - Test Data Storage (system_design/database_design/test_data_storage)
 * - Database Client Management (system_architecture/component_responsibilities)
 */

// Internal dependencies
import { TestDataModel } from '../models/testData.model';
import { createTestData } from '../repositories/testData.repository';
import PostgreSQLClient from '../clients/postgresql.client';
import { logger } from '../../utils/logger';

/**
 * Initial test data configurations following the ERD schema
 * These represent the base test data entities used for development and testing
 */
const initialTestData: Array<{
    name: string;
    scope: string;
    schema: object;
    valid_from: Date;
    valid_to?: Date;
}> = [
    {
        name: 'API Integration Test Data',
        scope: 'api_integration',
        schema: {
            fields: [
                { name: 'endpoint', type: 'string' },
                { name: 'method', type: 'string' },
                { name: 'headers', type: 'object' },
                { name: 'payload', type: 'object' }
            ],
            constraints: {
                required: ['endpoint', 'method'],
                methods: ['GET', 'POST', 'PUT', 'DELETE']
            }
        },
        valid_from: new Date(),
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
                required: ['table', 'operation'],
                operations: ['INSERT', 'UPDATE', 'DELETE', 'SELECT']
            }
        },
        valid_from: new Date(),
    },
    {
        name: 'Flow Test Data',
        scope: 'test_flow',
        schema: {
            fields: [
                { name: 'flow_name', type: 'string' },
                { name: 'steps', type: 'array' },
                { name: 'dependencies', type: 'array' }
            ],
            constraints: {
                required: ['flow_name', 'steps'],
                maxSteps: 50
            }
        },
        valid_from: new Date(),
    }
];

/**
 * Seeds the database with initial test data and configurations
 * Implements the database initialization process following the ERD specification
 */
export async function seedDatabase(): Promise<void> {
    const dbClient = new PostgreSQLClient();
    
    try {
        // Connect to the PostgreSQL database
        await dbClient.connect();
        
        logger.info('Starting database seeding process...');

        // Create test data entities with proper schema validation
        for (const testDataConfig of initialTestData) {
            try {
                // Create TestDataModel instance with validation
                const testData = new TestDataModel(
                    undefined, // Let the model generate UUID
                    testDataConfig.name,
                    testDataConfig.scope,
                    testDataConfig.schema,
                    testDataConfig.valid_from,
                    testDataConfig.valid_to
                );

                // Validate the test data model
                testData.validate();

                // Create test data in the database
                await createTestData(testData);

                logger.info(`Successfully created test data: ${testData.name}`);
            } catch (error) {
                logger.error(`Failed to create test data ${testDataConfig.name}:`, error);
                throw error;
            }
        }

        logger.info('Database seeding completed successfully');
    } catch (error) {
        logger.error('Database seeding failed:', error);
        throw error;
    } finally {
        // Ensure database connection is properly closed
        await dbClient.disconnect();
    }
}

/**
 * Exports the database seeding functionality for initialization
 * during deployment or development
 */
export default {
    seedDatabase
};