/**
 * postgresql.client.ts
 * Implements a robust PostgreSQL client for managing database connections and executing queries.
 * 
 * Implements requirements from:
 * - Database Integration Layer (system_architecture/database_integration_layer)
 * - Test Data Storage (system_design/database_design/test_data_storage)
 */

// pg v8.7.1 - PostgreSQL client for Node.js
import { Pool, PoolClient, QueryResult } from 'pg';
// pg-pool v3.4.1 - Connection pooling for PostgreSQL
import * as pgPool from 'pg-pool';

// Internal dependencies
import { ITestData } from '../../types/db.types';
import { CONFIG } from '../../constants/config';

/**
 * PostgreSQL client class that manages database connections and query execution
 * with connection pooling and transaction support.
 */
export class PostgreSQLClient {
    private pool: Pool;
    private client: PoolClient | null = null;

    constructor() {
        // Initialize connection pool with database configuration
        this.pool = new Pool({
            ...CONFIG.DATABASE,
            max: CONFIG.DATABASE.POOL_SIZE,
            idleTimeoutMillis: CONFIG.DATABASE.IDLE_TIMEOUT,
            connectionTimeoutMillis: CONFIG.DATABASE.CONNECTION_TIMEOUT
        });

        // Set up event handlers for pool error management
        this.pool.on('error', (err: Error) => {
            console.error('Unexpected error on idle client', err);
            process.exit(-1);
        });

        this.pool.on('connect', (client: PoolClient) => {
            client.on('error', (err: Error) => {
                console.error('Database client error:', err);
            });
        });
    }

    /**
     * Establishes a connection from the pool
     * Implements connection management requirements from Database Integration Layer
     */
    public async connect(): Promise<void> {
        try {
            this.client = await this.pool.connect();
            
            // Set statement timeout to prevent long-running queries
            await this.client.query('SET statement_timeout = 30000');
            
            console.log('Successfully connected to PostgreSQL database');
        } catch (error) {
            console.error('Error connecting to PostgreSQL:', error);
            throw new Error('Database connection failed');
        }
    }

    /**
     * Releases the connection back to the pool
     * Implements proper resource cleanup from Database Integration Layer
     */
    public async disconnect(): Promise<void> {
        try {
            if (this.client) {
                await this.client.release();
                this.client = null;
                console.log('Successfully disconnected from PostgreSQL database');
            }
        } catch (error) {
            console.error('Error disconnecting from PostgreSQL:', error);
            throw new Error('Database disconnection failed');
        }
    }

    /**
     * Executes a SQL query with proper error handling and connection management
     * Implements query execution requirements from Test Data Storage
     */
    public async executeQuery<T = any>(
        query: string,
        params: Array<any> = []
    ): Promise<QueryResult<T>> {
        let client: PoolClient | null = null;
        
        try {
            // Acquire client from pool
            client = await this.pool.connect();
            
            // Execute query with parameters
            const result = await client.query<T>(query, params);
            
            return result;
        } catch (error) {
            console.error('Error executing query:', error);
            throw new Error('Query execution failed');
        } finally {
            // Always release client back to pool
            if (client) {
                client.release();
            }
        }
    }

    /**
     * Executes multiple queries within a transaction
     * Implements transaction management requirements from Database Integration Layer
     */
    public async executeTransaction<T = any>(
        queries: Array<{ query: string; params: Array<any> }>
    ): Promise<Array<QueryResult<T>>> {
        let client: PoolClient | null = null;
        const results: Array<QueryResult<T>> = [];

        try {
            // Acquire client for transaction
            client = await this.pool.connect();

            // Begin transaction
            await client.query('BEGIN');

            // Execute each query in the transaction
            for (const { query, params } of queries) {
                const result = await client.query<T>(query, params);
                results.push(result);
            }

            // Commit transaction
            await client.query('COMMIT');

            return results;
        } catch (error) {
            // Rollback transaction on error
            if (client) {
                await client.query('ROLLBACK');
            }
            console.error('Transaction failed:', error);
            throw new Error('Transaction execution failed');
        } finally {
            // Release client back to pool
            if (client) {
                client.release();
            }
        }
    }

    /**
     * Retrieves the current connection pool statistics
     * Implements monitoring requirements from Database Integration Layer
     */
    public getPoolStats(): {
        totalCount: number;
        idleCount: number;
        waitingCount: number;
    } {
        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount,
        };
    }

    /**
     * Ends the connection pool
     * Implements cleanup requirements from Database Integration Layer
     */
    public async end(): Promise<void> {
        try {
            await this.pool.end();
            console.log('Connection pool has been closed');
        } catch (error) {
            console.error('Error closing connection pool:', error);
            throw new Error('Failed to close connection pool');
        }
    }
}

// Export PostgreSQLClient class for use in other modules
export default PostgreSQLClient;