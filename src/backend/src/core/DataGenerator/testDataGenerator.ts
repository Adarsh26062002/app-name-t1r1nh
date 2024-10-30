/**
 * testDataGenerator.ts
 * Implements comprehensive test data generation and seeding functionality with validation,
 * transaction management, and reference integrity checks across multiple databases.
 * 
 * @version 1.0.0
 */

// External dependencies
import { Pool } from 'pg'; // v8.7.1

// Internal dependencies
import { TestDataModel } from '../../db/models/testData.model';
import { 
    createTestData, 
    getTestDataById, 
    getActiveTestData 
} from '../../db/repositories/testData.repository';
import { 
    connect, 
    disconnect, 
    executeQuery, 
    executeTransaction 
} from '../../db/clients/postgresql.client';
import { ITestData } from '../../types/db.types';
import { validateTestData } from '../../utils/validators';

/**
 * Interface for event data structure
 * Implements event data schema requirements
 */
interface EventData {
    id: string;
    type: string;
    timestamp: Date;
    payload: Record<string, any>;
}

/**
 * Interface for inventory data structure
 * Implements inventory data schema requirements
 */
interface InventoryData {
    id: string;
    event_id: string;
    quantity: number;
    status: string;
    metadata: Record<string, any>;
}

/**
 * Generates and seeds test data into the database with comprehensive validation
 * and transaction management.
 * 
 * Implements requirements:
 * - Data Generation Flow (system_architecture.data_generation_flow)
 * - Component Responsibilities (system_architecture.component_responsibilities)
 * 
 * @param testData - The test data configuration to be generated and seeded
 * @returns Promise<ITestData> - The generated and validated test data entity
 */
export async function generateTestData(testData: ITestData): Promise<ITestData> {
    try {
        // Step 1: Validate test data structure and content
        validateTestData(testData);

        // Step 2: Create TestDataModel instance
        const testDataModel = new TestDataModel(
            testData.id,
            testData.name,
            testData.scope,
            testData.schema,
            testData.valid_from,
            testData.valid_to
        );

        // Step 3: Validate model using TestDataModel validation
        testDataModel.validate();

        // Step 4: Connect to PostgreSQL database
        await connect();

        // Step 5: Begin database transaction
        const transaction = [
            // Check for existing active test data
            {
                query: `
                    SELECT id FROM test_data 
                    WHERE scope = $1 
                    AND valid_from <= NOW() 
                    AND (valid_to IS NULL OR valid_to > NOW())
                `,
                params: [testData.scope]
            },
            // Insert event data
            {
                query: `
                    INSERT INTO events (
                        id, type, timestamp, payload, test_data_id
                    ) VALUES (
                        $1, $2, $3, $4, $5
                    ) RETURNING id
                `,
                params: [
                    testData.id,
                    'TEST_DATA_GENERATION',
                    new Date(),
                    testData.schema,
                    testData.id
                ]
            },
            // Insert inventory data
            {
                query: `
                    INSERT INTO inventory (
                        id, event_id, quantity, status, metadata, test_data_id
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6
                    ) RETURNING id
                `,
                params: [
                    testData.id,
                    testData.id,
                    1,
                    'ACTIVE',
                    { generated: true },
                    testData.id
                ]
            }
        ];

        // Step 6: Execute transaction with all database operations
        const results = await executeTransaction(transaction);

        // Step 7: Validate database operation results
        if (!results || results.length !== 3) {
            throw new Error('Failed to complete all database operations');
        }

        // Step 8: Create test data entry using repository
        const createdTestData = await createTestData(testDataModel);

        // Step 9: Validate references between Events and Inventory DBs
        const referenceValidation = {
            query: `
                SELECT e.id as event_id, i.id as inventory_id
                FROM events e
                JOIN inventory i ON e.id = i.event_id
                WHERE e.test_data_id = $1 AND i.test_data_id = $1
            `,
            params: [testData.id]
        };

        const validationResult = await executeQuery(referenceValidation.query, referenceValidation.params);

        if (!validationResult || validationResult.rows.length === 0) {
            throw new Error('Reference integrity validation failed');
        }

        // Step 10: Return the created and validated test data entity
        return createdTestData;

    } catch (error) {
        // Handle specific error types and rethrow with appropriate context
        if (error instanceof Error) {
            throw new Error(`Test data generation failed: ${error.message}`);
        }
        throw error;
    } finally {
        // Step 11: Always disconnect from database
        await disconnect();
    }
}

/**
 * Validates and retrieves active test data for a given scope
 * 
 * @param scope - The scope of test data to retrieve
 * @returns Promise<ITestData[]> - Array of active test data entities
 */
export async function getActiveTestDataByScope(scope: string): Promise<ITestData[]> {
    try {
        await connect();
        const activeTestData = await getActiveTestData();
        return activeTestData.filter(data => data.scope === scope);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to retrieve active test data: ${error.message}`);
        }
        throw error;
    } finally {
        await disconnect();
    }
}

/**
 * Validates test data references across databases
 * 
 * @param testDataId - The ID of the test data to validate
 * @returns Promise<boolean> - True if references are valid
 */
export async function validateTestDataReferences(testDataId: string): Promise<boolean> {
    try {
        await connect();
        
        const validationQuery = {
            query: `
                WITH event_refs AS (
                    SELECT id FROM events WHERE test_data_id = $1
                ), inventory_refs AS (
                    SELECT id FROM inventory WHERE test_data_id = $1
                )
                SELECT 
                    (SELECT COUNT(*) FROM event_refs) as event_count,
                    (SELECT COUNT(*) FROM inventory_refs) as inventory_count
            `,
            params: [testDataId]
        };

        const result = await executeQuery(validationQuery.query, validationQuery.params);
        
        if (!result || !result.rows[0]) {
            return false;
        }

        const { event_count, inventory_count } = result.rows[0];
        return event_count > 0 && inventory_count > 0;

    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Reference validation failed: ${error.message}`);
        }
        throw error;
    } finally {
        await disconnect();
    }
}