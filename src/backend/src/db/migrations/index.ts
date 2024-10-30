/**
 * migrations/index.ts
 * Manages database migrations for maintaining schema consistency across environments.
 * Implements requirements from:
 * - Database Schema Management (system_architecture/database_integration_layer)
 * - Test Data Storage Schema (system_design/database_design/test_data_storage)
 */

// External dependencies
import { createHash } from 'crypto';
import { QueryResult } from 'pg'; // v8.7.1

// Internal dependencies
import { PostgreSQLClient } from '../clients/postgresql.client';
import { TestDataModel } from '../models/testData.model';
import { TestFlowModel } from '../models/testFlow.model';
import { TestResultModel } from '../models/testResult.model';

// Migration table name constant
const MIGRATIONS_TABLE = 'schema_migrations';

// Migration script interface
interface MigrationScript {
    name: string;
    version: string;
    up: string;
    down: string;
    checksum: string;
}

// Migration scripts array containing all database schema changes
const migrationScripts: MigrationScript[] = [
    {
        name: 'create_test_data_table',
        version: '1.0.0',
        up: `
            CREATE TABLE test_data (
                id UUID PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                scope VARCHAR(100) NOT NULL,
                schema JSONB NOT NULL,
                valid_from TIMESTAMP NOT NULL,
                valid_to TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX idx_test_data_name ON test_data(name);
            CREATE INDEX idx_test_data_scope ON test_data(scope);
        `,
        down: 'DROP TABLE IF EXISTS test_data;',
        checksum: ''
    },
    {
        name: 'create_test_flow_table',
        version: '1.0.1',
        up: `
            CREATE TABLE test_flow (
                id UUID PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                flow_type VARCHAR(50) NOT NULL,
                config JSONB NOT NULL,
                test_data_id UUID NOT NULL REFERENCES test_data(id),
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT valid_flow_type CHECK (flow_type IN ('api', 'database', 'integration', 'e2e')),
                CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
            );
            CREATE INDEX idx_test_flow_name ON test_flow(name);
            CREATE INDEX idx_test_flow_status ON test_flow(status);
            CREATE INDEX idx_test_flow_test_data_id ON test_flow(test_data_id);
        `,
        down: 'DROP TABLE IF EXISTS test_flow;',
        checksum: ''
    },
    {
        name: 'create_test_result_table',
        version: '1.0.2',
        up: `
            CREATE TABLE test_result (
                id UUID PRIMARY KEY,
                flow_id UUID NOT NULL REFERENCES test_flow(id),
                status VARCHAR(50) NOT NULL,
                duration_ms INTEGER NOT NULL DEFAULT 0,
                error JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT valid_result_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
            );
            CREATE INDEX idx_test_result_flow_id ON test_result(flow_id);
            CREATE INDEX idx_test_result_status ON test_result(status);
            CREATE INDEX idx_test_result_created_at ON test_result(created_at);
        `,
        down: 'DROP TABLE IF EXISTS test_result;',
        checksum: ''
    }
];

// Calculate checksums for migration scripts
migrationScripts.forEach(script => {
    script.checksum = createHash('sha256')
        .update(script.up + script.down)
        .digest('hex');
});

/**
 * Creates the migrations table if it doesn't exist
 * Implements schema versioning requirements from Database Schema Management
 */
async function createMigrationsTable(client: PostgreSQLClient): Promise<void> {
    const query = `
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            id SERIAL PRIMARY KEY,
            version VARCHAR(50) NOT NULL,
            name VARCHAR(255) NOT NULL,
            checksum VARCHAR(64) NOT NULL,
            applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_schema_migrations_version 
        ON ${MIGRATIONS_TABLE}(version);
    `;
    
    await client.executeQuery(query);
}

/**
 * Executes all pending migrations to update the database schema
 * Implements forward migration requirements from Database Schema Management
 */
export async function runMigrations(): Promise<void> {
    const client = new PostgreSQLClient();
    
    try {
        await client.connect();
        
        // Create migrations table if it doesn't exist
        await createMigrationsTable(client);
        
        // Get list of applied migrations
        const result = await client.executeQuery<{ version: string }>(
            `SELECT version FROM ${MIGRATIONS_TABLE} ORDER BY version`
        );
        const appliedVersions = new Set(result.rows.map(row => row.version));
        
        // Filter out already applied migrations
        const pendingMigrations = migrationScripts.filter(
            script => !appliedVersions.has(script.version)
        );
        
        // Sort migrations by version
        pendingMigrations.sort((a, b) => 
            a.version.localeCompare(b.version, undefined, { numeric: true }));
        
        // Execute pending migrations in transaction
        if (pendingMigrations.length > 0) {
            const queries = pendingMigrations.flatMap(migration => [
                {
                    query: migration.up,
                    params: []
                },
                {
                    query: `
                        INSERT INTO ${MIGRATIONS_TABLE} 
                        (version, name, checksum) 
                        VALUES ($1, $2, $3)
                    `,
                    params: [migration.version, migration.name, migration.checksum]
                }
            ]);
            
            await client.executeTransaction(queries);
            
            console.log(`Applied ${pendingMigrations.length} migrations successfully`);
        } else {
            console.log('No pending migrations to apply');
        }
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await client.disconnect();
    }
}

/**
 * Rolls back migrations to a specific version
 * Implements rollback requirements from Database Schema Management
 */
export async function rollbackMigrations(targetVersion: string): Promise<void> {
    const client = new PostgreSQLClient();
    
    try {
        await client.connect();
        
        // Get list of applied migrations
        const result = await client.executeQuery<{ version: string, name: string }>(
            `SELECT version, name FROM ${MIGRATIONS_TABLE} ORDER BY version DESC`
        );
        
        // Filter migrations to rollback
        const migrationsToRollback = result.rows
            .filter(row => row.version > targetVersion)
            .map(row => {
                const script = migrationScripts.find(s => s.version === row.version);
                if (!script) {
                    throw new Error(`Migration script not found for version ${row.version}`);
                }
                return script;
            });
        
        if (migrationsToRollback.length > 0) {
            // Execute rollbacks in transaction
            const queries = migrationsToRollback.flatMap(migration => [
                {
                    query: migration.down,
                    params: []
                },
                {
                    query: `
                        DELETE FROM ${MIGRATIONS_TABLE} 
                        WHERE version = $1
                    `,
                    params: [migration.version]
                }
            ]);
            
            await client.executeTransaction(queries);
            
            console.log(`Rolled back ${migrationsToRollback.length} migrations successfully`);
        } else {
            console.log('No migrations to roll back');
        }
    } catch (error) {
        console.error('Rollback failed:', error);
        throw error;
    } finally {
        await client.disconnect();
    }
}

/**
 * Retrieves the current status of all migrations
 * Implements migration status tracking requirements from Database Schema Management
 */
export async function getMigrationStatus(): Promise<Array<{
    name: string;
    version: string;
    applied: boolean;
    appliedAt?: Date;
}>> {
    const client = new PostgreSQLClient();
    
    try {
        await client.connect();
        
        // Get list of applied migrations
        const result = await client.executeQuery<{
            version: string;
            name: string;
            applied_at: Date;
        }>(
            `SELECT version, name, applied_at 
             FROM ${MIGRATIONS_TABLE} 
             ORDER BY version`
        );
        
        const appliedMigrations = new Map(
            result.rows.map(row => [row.version, row])
        );
        
        // Combine with available migrations
        return migrationScripts.map(script => ({
            name: script.name,
            version: script.version,
            applied: appliedMigrations.has(script.version),
            appliedAt: appliedMigrations.get(script.version)?.applied_at
        }));
    } catch (error) {
        console.error('Failed to get migration status:', error);
        throw error;
    } finally {
        await client.disconnect();
    }
}