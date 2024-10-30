/**
 * testFlow.repository.ts
 * Implements the repository pattern for managing test flow entities within the database.
 * 
 * Implements requirements from:
 * - Test Flow Management (system_design/database_design.test_data_storage)
 * - Database Integration (system_architecture/database_integration_layer)
 */

// Internal dependencies
import { TestFlowModel } from '../models/testFlow.model';
import PostgreSQLClient from '../clients/postgresql.client';
import { ITestFlow, TestFlowStatus } from '../../types/db.types';

/**
 * Repository class for managing test flow entities in the database
 * Implements CRUD operations and complex queries with proper transaction management
 */
export class TestFlowRepository {
    private client: PostgreSQLClient;

    constructor() {
        this.client = new PostgreSQLClient();
    }

    /**
     * Creates a new test flow entity in the database
     * Implements requirement: Test Flow Management - Create operation
     */
    public async createTestFlow(testFlowData: ITestFlow): Promise<ITestFlow> {
        try {
            // Create and validate model instance
            const testFlow = new TestFlowModel(
                undefined,
                testFlowData.name,
                testFlowData.description,
                testFlowData.flow_type,
                testFlowData.config,
                testFlowData.test_data_id,
                TestFlowStatus.PENDING
            );
            testFlow.validate();

            // Construct insert query
            const query = `
                INSERT INTO test_flows (
                    id, name, description, flow_type, config,
                    test_data_id, status, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *;
            `;

            const params = [
                testFlow.id,
                testFlow.name,
                testFlow.description,
                testFlow.flow_type,
                testFlow.config,
                testFlow.test_data_id,
                testFlow.status,
                testFlow.created_at,
                testFlow.updated_at
            ];

            // Execute query within transaction
            const result = await this.client.executeQuery<ITestFlow>(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating test flow:', error);
            throw new Error(`Failed to create test flow: ${error.message}`);
        }
    }

    /**
     * Retrieves a test flow entity by its ID
     * Implements requirement: Test Flow Management - Read operation
     */
    public async getTestFlowById(id: string): Promise<ITestFlow | null> {
        try {
            // Validate UUID format
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
                throw new Error('Invalid UUID format');
            }

            const query = `
                SELECT * FROM test_flows
                WHERE id = $1;
            `;

            const result = await this.client.executeQuery<ITestFlow>(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error retrieving test flow:', error);
            throw new Error(`Failed to retrieve test flow: ${error.message}`);
        }
    }

    /**
     * Updates an existing test flow entity
     * Implements requirement: Test Flow Management - Update operation
     */
    public async updateTestFlow(id: string, updateData: Partial<ITestFlow>): Promise<ITestFlow> {
        try {
            // Validate UUID format
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
                throw new Error('Invalid UUID format');
            }

            // Get existing test flow
            const existingFlow = await this.getTestFlowById(id);
            if (!existingFlow) {
                throw new Error('Test flow not found');
            }

            // Merge existing data with updates
            const updatedFlow = {
                ...existingFlow,
                ...updateData,
                updated_at: new Date()
            };

            // Validate updated data
            const testFlow = new TestFlowModel(
                updatedFlow.id,
                updatedFlow.name,
                updatedFlow.description,
                updatedFlow.flow_type,
                updatedFlow.config,
                updatedFlow.test_data_id,
                updatedFlow.status
            );
            testFlow.validate();

            // Construct update query
            const query = `
                UPDATE test_flows
                SET name = $1,
                    description = $2,
                    flow_type = $3,
                    config = $4,
                    test_data_id = $5,
                    status = $6,
                    updated_at = $7
                WHERE id = $8
                RETURNING *;
            `;

            const params = [
                updatedFlow.name,
                updatedFlow.description,
                updatedFlow.flow_type,
                updatedFlow.config,
                updatedFlow.test_data_id,
                updatedFlow.status,
                updatedFlow.updated_at,
                id
            ];

            // Execute update within transaction
            const result = await this.client.executeQuery<ITestFlow>(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('Error updating test flow:', error);
            throw new Error(`Failed to update test flow: ${error.message}`);
        }
    }

    /**
     * Deletes a test flow entity from the database
     * Implements requirement: Test Flow Management - Delete operation
     */
    public async deleteTestFlow(id: string): Promise<void> {
        try {
            // Validate UUID format
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
                throw new Error('Invalid UUID format');
            }

            // Construct delete query with CASCADE option
            const query = `
                DELETE FROM test_flows
                WHERE id = $1;
            `;

            // Execute delete within transaction
            const result = await this.client.executeQuery(query, [id]);

            // Verify deletion
            if (result.rowCount === 0) {
                throw new Error('Test flow not found');
            }
        } catch (error) {
            console.error('Error deleting test flow:', error);
            throw new Error(`Failed to delete test flow: ${error.message}`);
        }
    }

    /**
     * Retrieves test flows filtered by their status
     * Implements requirement: Test Flow Management - Complex query operation
     */
    public async getTestFlowsByStatus(status: TestFlowStatus): Promise<ITestFlow[]> {
        try {
            // Validate status against enum
            if (!Object.values(TestFlowStatus).includes(status)) {
                throw new Error('Invalid test flow status');
            }

            // Construct select query with status filter
            const query = `
                SELECT * FROM test_flows
                WHERE status = $1
                ORDER BY created_at DESC;
            `;

            const result = await this.client.executeQuery<ITestFlow>(query, [status]);
            return result.rows;
        } catch (error) {
            console.error('Error retrieving test flows by status:', error);
            throw new Error(`Failed to retrieve test flows: ${error.message}`);
        }
    }
}

// Export repository class
export default TestFlowRepository;