// External imports with version specifications
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

// Internal imports
import { TestResultModel } from '../models/testResult.model';
import { PostgreSQLClient } from '../clients/postgresql.client';
import { logInfo, logError } from '../../utils/logger';
import { ITestResult, ITestMetric, TestResultStatus } from '../../types/db.types';

/**
 * Repository class for managing test result entities in the database
 * Implements requirements from system_design.database_design.results_storage
 */
export class TestResultRepository {
    private dbClient: PostgreSQLClient;

    constructor() {
        this.dbClient = new PostgreSQLClient();
    }

    /**
     * Creates a new test result with associated metrics
     * @param testResult - The test result data to create
     * @param metrics - Associated test metrics
     * @returns Promise<ITestResult> - The created test result with metrics
     */
    public async createTestResult(
        testResult: ITestResult,
        metrics: ITestMetric[] = []
    ): Promise<ITestResult> {
        try {
            const queries = [
                {
                    query: `
                        INSERT INTO test_results (
                            id, flow_id, status, duration_ms, error, created_at, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                        RETURNING *
                    `,
                    params: [
                        testResult.id || uuidv4(),
                        testResult.flow_id,
                        testResult.status,
                        testResult.duration_ms,
                        testResult.error
                    ]
                },
                ...metrics.map(metric => ({
                    query: `
                        INSERT INTO test_metrics (
                            id, result_id, metric_type, value, recorded_at
                        ) VALUES ($1, $2, $3, $4, NOW())
                    `,
                    params: [
                        uuidv4(),
                        testResult.id,
                        metric.metric_type,
                        metric.value
                    ]
                }))
            ];

            const results = await this.dbClient.executeTransaction(queries);
            const createdResult = results[0].rows[0];

            logInfo('Test result created successfully', {
                resultId: createdResult.id,
                flowId: createdResult.flow_id
            });

            return createdResult;
        } catch (error) {
            logError('Failed to create test result', error as Error, {
                flowId: testResult.flow_id
            });
            throw error;
        }
    }

    /**
     * Retrieves a test result by its ID including associated metrics
     * @param id - The ID of the test result to retrieve
     * @returns Promise<ITestResult | null> - The test result with metrics or null if not found
     */
    public async getTestResultById(id: string): Promise<ITestResult | null> {
        try {
            const query = `
                SELECT r.*, 
                    json_agg(
                        json_build_object(
                            'id', m.id,
                            'metric_type', m.metric_type,
                            'value', m.value,
                            'recorded_at', m.recorded_at
                        )
                    ) as metrics
                FROM test_results r
                LEFT JOIN test_metrics m ON r.id = m.result_id
                WHERE r.id = $1
                GROUP BY r.id
            `;

            const result = await this.dbClient.executeQuery(query, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }

            logInfo('Test result retrieved successfully', { resultId: id });
            return result.rows[0];
        } catch (error) {
            logError('Failed to retrieve test result', error as Error, { resultId: id });
            throw error;
        }
    }

    /**
     * Retrieves all test results for a specific flow ID
     * @param flowId - The flow ID to filter results by
     * @returns Promise<ITestResult[]> - Array of test results for the flow
     */
    public async getTestResultsByFlowId(flowId: string): Promise<ITestResult[]> {
        try {
            const query = `
                SELECT r.*, 
                    json_agg(
                        json_build_object(
                            'id', m.id,
                            'metric_type', m.metric_type,
                            'value', m.value,
                            'recorded_at', m.recorded_at
                        )
                    ) as metrics
                FROM test_results r
                LEFT JOIN test_metrics m ON r.id = m.result_id
                WHERE r.flow_id = $1
                GROUP BY r.id
                ORDER BY r.created_at DESC
            `;

            const results = await this.dbClient.executeQuery(query, [flowId]);
            
            logInfo('Test results retrieved successfully', { 
                flowId,
                count: results.rows.length 
            });

            return results.rows;
        } catch (error) {
            logError('Failed to retrieve test results by flow ID', error as Error, {
                flowId
            });
            throw error;
        }
    }

    /**
     * Retrieves test results filtered by status
     * @param status - The status to filter by
     * @returns Promise<ITestResult[]> - Array of test results with the specified status
     */
    public async getTestResultsByStatus(status: TestResultStatus): Promise<ITestResult[]> {
        try {
            const query = `
                SELECT r.*, 
                    json_agg(
                        json_build_object(
                            'id', m.id,
                            'metric_type', m.metric_type,
                            'value', m.value,
                            'recorded_at', m.recorded_at
                        )
                    ) as metrics
                FROM test_results r
                LEFT JOIN test_metrics m ON r.id = m.result_id
                WHERE r.status = $1
                GROUP BY r.id
                ORDER BY r.created_at DESC
            `;

            const results = await this.dbClient.executeQuery(query, [status]);
            
            logInfo('Test results retrieved by status successfully', {
                status,
                count: results.rows.length
            });

            return results.rows;
        } catch (error) {
            logError('Failed to retrieve test results by status', error as Error, {
                status
            });
            throw error;
        }
    }

    /**
     * Updates an existing test result and its metrics
     * @param id - The ID of the test result to update
     * @param updates - Partial test result data to update
     * @param metrics - New metrics to associate with the test result
     * @returns Promise<ITestResult> - The updated test result with metrics
     */
    public async updateTestResult(
        id: string,
        updates: Partial<ITestResult>,
        metrics: ITestMetric[] = []
    ): Promise<ITestResult> {
        try {
            const updateFields = Object.entries(updates)
                .filter(([key]) => key !== 'id')
                .map(([key, value], index) => `${key} = $${index + 2}`);

            const queries = [
                {
                    query: `
                        UPDATE test_results
                        SET ${updateFields.join(', ')}, updated_at = NOW()
                        WHERE id = $1
                        RETURNING *
                    `,
                    params: [id, ...Object.values(updates)]
                }
            ];

            if (metrics.length > 0) {
                queries.push({
                    query: 'DELETE FROM test_metrics WHERE result_id = $1',
                    params: [id]
                });

                metrics.forEach(metric => {
                    queries.push({
                        query: `
                            INSERT INTO test_metrics (
                                id, result_id, metric_type, value, recorded_at
                            ) VALUES ($1, $2, $3, $4, NOW())
                        `,
                        params: [
                            uuidv4(),
                            id,
                            metric.metric_type,
                            metric.value
                        ]
                    });
                });
            }

            const results = await this.dbClient.executeTransaction(queries);
            const updatedResult = results[0].rows[0];

            logInfo('Test result updated successfully', { resultId: id });
            return updatedResult;
        } catch (error) {
            logError('Failed to update test result', error as Error, { resultId: id });
            throw error;
        }
    }

    /**
     * Deletes a test result and its associated metrics
     * @param id - The ID of the test result to delete
     * @returns Promise<void>
     */
    public async deleteTestResult(id: string): Promise<void> {
        try {
            const queries = [
                {
                    query: 'DELETE FROM test_metrics WHERE result_id = $1',
                    params: [id]
                },
                {
                    query: 'DELETE FROM test_results WHERE id = $1',
                    params: [id]
                }
            ];

            await this.dbClient.executeTransaction(queries);
            
            logInfo('Test result deleted successfully', { resultId: id });
        } catch (error) {
            logError('Failed to delete test result', error as Error, { resultId: id });
            throw error;
        }
    }

    /**
     * Creates multiple test results in a single transaction
     * @param testResults - Array of test results to create
     * @returns Promise<ITestResult[]> - Array of created test results
     */
    public async batchCreateTestResults(testResults: ITestResult[]): Promise<ITestResult[]> {
        try {
            const queries = testResults.map(result => ({
                query: `
                    INSERT INTO test_results (
                        id, flow_id, status, duration_ms, error, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                    RETURNING *
                `,
                params: [
                    result.id || uuidv4(),
                    result.flow_id,
                    result.status,
                    result.duration_ms,
                    result.error
                ]
            }));

            const results = await this.dbClient.executeTransaction(queries);
            const createdResults = results.map(result => result.rows[0]);

            logInfo('Batch test results created successfully', {
                count: createdResults.length
            });

            return createdResults;
        } catch (error) {
            logError('Failed to batch create test results', error as Error, {
                count: testResults.length
            });
            throw error;
        }
    }
}