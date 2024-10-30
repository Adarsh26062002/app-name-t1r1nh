/**
 * testData.repository.ts
 * Implements the repository pattern for managing test data entities within the database.
 * 
 * Implements requirements from:
 * - Test Data Storage (system_design/database_design/test_data_storage)
 */

// Internal dependencies
import { TestDataModel } from '../models/testData.model';
import PostgreSQLClient from '../clients/postgresql.client';

/**
 * Repository class for managing test data entities in the database
 * Implements CRUD operations with temporal validity management
 */
export class TestDataRepository {
    private dbClient: PostgreSQLClient;

    constructor() {
        this.dbClient = new PostgreSQLClient();
    }

    /**
     * Creates a new test data entry in the database
     * Implements test data creation requirement with validation
     */
    public async createTestData(testData: TestDataModel): Promise<TestDataModel> {
        try {
            // Validate test data model
            testData.validate();

            await this.dbClient.connect();

            const query = `
                INSERT INTO test_data (
                    id, name, scope, schema, valid_from, valid_to, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8
                ) RETURNING *;
            `;

            const params = [
                testData.id,
                testData.name,
                testData.scope,
                testData.schema,
                testData.valid_from,
                testData.valid_to,
                testData.created_at,
                testData.updated_at
            ];

            const result = await this.dbClient.executeQuery<TestDataModel>(query, params);
            return new TestDataModel(
                result.rows[0].id,
                result.rows[0].name,
                result.rows[0].scope,
                result.rows[0].schema,
                result.rows[0].valid_from,
                result.rows[0].valid_to
            );
        } catch (error) {
            throw error;
        } finally {
            await this.dbClient.disconnect();
        }
    }

    /**
     * Retrieves a test data entry by its ID
     * Implements test data retrieval requirement
     */
    public async getTestDataById(id: string): Promise<TestDataModel | null> {
        try {
            await this.dbClient.connect();

            const query = `
                SELECT * FROM test_data 
                WHERE id = $1 AND (valid_to IS NULL OR valid_to > NOW());
            `;

            const result = await this.dbClient.executeQuery<TestDataModel>(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            const data = result.rows[0];
            return new TestDataModel(
                data.id,
                data.name,
                data.scope,
                data.schema,
                data.valid_from,
                data.valid_to
            );
        } catch (error) {
            throw error;
        } finally {
            await this.dbClient.disconnect();
        }
    }

    /**
     * Updates an existing test data entry
     * Implements test data update requirement with validation
     */
    public async updateTestData(id: string, testData: TestDataModel): Promise<TestDataModel> {
        try {
            // Validate updated test data
            testData.validate();

            await this.dbClient.connect();

            // Start transaction for atomic update
            const queries = [
                {
                    query: `
                        UPDATE test_data 
                        SET valid_to = NOW() 
                        WHERE id = $1 AND (valid_to IS NULL OR valid_to > NOW());
                    `,
                    params: [id]
                },
                {
                    query: `
                        INSERT INTO test_data (
                            id, name, scope, schema, valid_from, valid_to, created_at, updated_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8
                        ) RETURNING *;
                    `,
                    params: [
                        id,
                        testData.name,
                        testData.scope,
                        testData.schema,
                        new Date(), // valid_from set to current time
                        testData.valid_to,
                        testData.created_at,
                        new Date() // updated_at set to current time
                    ]
                }
            ];

            const results = await this.dbClient.executeTransaction(queries);
            const updatedData = results[1].rows[0];

            return new TestDataModel(
                updatedData.id,
                updatedData.name,
                updatedData.scope,
                updatedData.schema,
                updatedData.valid_from,
                updatedData.valid_to
            );
        } catch (error) {
            throw error;
        } finally {
            await this.dbClient.disconnect();
        }
    }

    /**
     * Soft deletes a test data entry by setting valid_to to current timestamp
     * Implements test data deletion requirement with temporal validity
     */
    public async deleteTestData(id: string): Promise<void> {
        try {
            await this.dbClient.connect();

            const query = `
                UPDATE test_data 
                SET valid_to = NOW() 
                WHERE id = $1 AND (valid_to IS NULL OR valid_to > NOW());
            `;

            await this.dbClient.executeQuery(query, [id]);
        } catch (error) {
            throw error;
        } finally {
            await this.dbClient.disconnect();
        }
    }

    /**
     * Retrieves all currently valid test data entries
     * Implements active test data retrieval requirement
     */
    public async getActiveTestData(): Promise<TestDataModel[]> {
        try {
            await this.dbClient.connect();

            const query = `
                SELECT * FROM test_data 
                WHERE valid_from <= NOW() 
                AND (valid_to IS NULL OR valid_to > NOW())
                ORDER BY created_at DESC;
            `;

            const result = await this.dbClient.executeQuery<TestDataModel>(query);

            return result.rows.map(data => new TestDataModel(
                data.id,
                data.name,
                data.scope,
                data.schema,
                data.valid_from,
                data.valid_to
            ));
        } catch (error) {
            throw error;
        } finally {
            await this.dbClient.disconnect();
        }
    }
}

// Export repository methods for managing test data entities
export const {
    createTestData,
    getTestDataById,
    updateTestData,
    deleteTestData,
    getActiveTestData
} = new TestDataRepository();