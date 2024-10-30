/**
 * database.config.ts
 * Configures and manages database connections for both Events and Inventory databases.
 * 
 * Implements requirements from:
 * - Database Integration Layer (system_architecture/database_integration_layer)
 * - Test Data Storage (system_design/database_design/test_data_storage)
 */

// pg v8.7.1 - PostgreSQL client for Node.js
import { PoolConfig } from 'pg';

// Internal dependencies
import { connect, disconnect, executeQuery, executeTransaction } from '../db/clients/postgresql.client';
import { CONFIG } from '../constants/config';

/**
 * Database configuration interface for type safety
 */
interface DatabaseConfig extends PoolConfig {
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
}

/**
 * Events database configuration using environment variables and standard config parameters
 */
const eventsDbConfig: DatabaseConfig = {
    host: process.env.EVENTS_DB_HOST,
    port: parseInt(process.env.EVENTS_DB_PORT || '5432', 10),
    user: process.env.EVENTS_DB_USER,
    password: process.env.EVENTS_DB_PASSWORD,
    database: process.env.EVENTS_DB_NAME,
    max: CONFIG.DATABASE.POOL_SIZE,
    idleTimeoutMillis: CONFIG.DATABASE.IDLE_TIMEOUT,
    connectionTimeoutMillis: CONFIG.DATABASE.CONNECTION_TIMEOUT,
    // Additional security settings
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
};

/**
 * Inventory database configuration using environment variables and standard config parameters
 */
const inventoryDbConfig: DatabaseConfig = {
    host: process.env.INVENTORY_DB_HOST,
    port: parseInt(process.env.INVENTORY_DB_PORT || '5432', 10),
    user: process.env.INVENTORY_DB_USER,
    password: process.env.INVENTORY_DB_PASSWORD,
    database: process.env.INVENTORY_DB_NAME,
    max: CONFIG.DATABASE.POOL_SIZE,
    idleTimeoutMillis: CONFIG.DATABASE.IDLE_TIMEOUT,
    connectionTimeoutMillis: CONFIG.DATABASE.CONNECTION_TIMEOUT,
    // Additional security settings
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
};

// Track connection status
let eventsConnected = false;
let inventoryConnected = false;

/**
 * Initializes both Events and Inventory database clients with configuration settings
 * and establishes connections with proper pooling.
 * 
 * Implements connection pooling requirements from Database Integration Layer
 */
export const initializeDatabase = async (): Promise<void> => {
    try {
        // Initialize Events database connection
        await connect(eventsDbConfig);
        eventsConnected = true;
        console.log('Events database connection established successfully');

        // Initialize Inventory database connection
        await connect(inventoryDbConfig);
        inventoryConnected = true;
        console.log('Inventory database connection established successfully');

        // Set up process termination handlers for graceful shutdown
        process.on('SIGTERM', closeConnections);
        process.on('SIGINT', closeConnections);
    } catch (error) {
        console.error('Failed to initialize database connections:', error);
        // Attempt to close any open connections
        await closeConnections();
        throw new Error('Database initialization failed');
    }
};

/**
 * Gracefully closes all database connections and connection pools.
 * 
 * Implements proper cleanup requirements from Database Integration Layer
 */
export const closeConnections = async (): Promise<void> => {
    try {
        // Close Events database connection if connected
        if (eventsConnected) {
            await disconnect();
            eventsConnected = false;
            console.log('Events database connection closed successfully');
        }

        // Close Inventory database connection if connected
        if (inventoryConnected) {
            await disconnect();
            inventoryConnected = false;
            console.log('Inventory database connection closed successfully');
        }
    } catch (error) {
        console.error('Error while closing database connections:', error);
        throw new Error('Failed to close database connections');
    }
};

/**
 * Validates that both database connections are active
 */
const validateConnections = (): void => {
    if (!eventsConnected || !inventoryConnected) {
        throw new Error('Database connections not initialized');
    }
};

/**
 * Re-exports database client functions with connection validation
 * These functions are used by repositories to ensure valid connections
 */
export const executeValidatedQuery = async <T>(
    query: string,
    params?: any[]
): Promise<T> => {
    validateConnections();
    return executeQuery<T>(query, params);
};

export const executeValidatedTransaction = async <T>(
    queries: Array<{ query: string; params: any[] }>
): Promise<T[]> => {
    validateConnections();
    return executeTransaction<T>(queries);
};

// Export configuration objects for use in other modules
export const dbConfig = {
    events: eventsDbConfig,
    inventory: inventoryDbConfig,
};