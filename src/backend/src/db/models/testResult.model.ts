// External imports with version specifications
import { 
    Entity, 
    Column, 
    PrimaryGeneratedColumn, 
    CreateDateColumn, 
    UpdateDateColumn 
} from 'typeorm'; // ^0.3.0

// Internal imports
import { ITestResult, TestResultStatus } from '../../types/db.types';

/**
 * TestResult Entity Model
 * Implements the test result storage requirements from system_design.database_design.results_storage
 * Represents a single test execution result with its associated metrics and status
 */
@Entity('test_results')
export class TestResultModel implements ITestResult {
    /**
     * Unique identifier for the test result
     * Uses UUID for global uniqueness and distributed systems compatibility
     */
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * Reference to the associated test flow
     * Foreign key relationship with test_flows table
     */
    @Column('uuid')
    flow_id: string;

    /**
     * Current status of the test result
     * Constrained by TestResultStatus enum values
     */
    @Column('varchar', { length: 50 })
    status: TestResultStatus;

    /**
     * Total execution duration in milliseconds
     * Used for performance tracking and reporting
     */
    @Column('integer')
    duration_ms: number;

    /**
     * Detailed error information if test fails
     * Stored as JSONB for flexible error structure
     */
    @Column('jsonb', { nullable: true })
    error: Record<string, any> | null;

    /**
     * Timestamp for result creation
     * Automatically managed by TypeORM
     */
    @CreateDateColumn()
    created_at: Date;

    /**
     * Timestamp for last result update
     * Automatically managed by TypeORM
     */
    @UpdateDateColumn()
    updated_at: Date;

    /**
     * Creates a new TestResult instance
     * Initializes with default values if not provided
     */
    constructor(
        id?: string,
        flow_id?: string,
        status: TestResultStatus = TestResultStatus.PENDING,
        duration_ms: number = 0,
        error: Record<string, any> | null = null,
        created_at?: Date,
        updated_at?: Date
    ) {
        this.id = id || '';
        this.flow_id = flow_id || '';
        this.status = status;
        this.duration_ms = duration_ms;
        this.error = error;
        
        if (created_at) {
            this.created_at = created_at;
        }
        
        if (updated_at) {
            this.updated_at = updated_at;
        }
    }

    /**
     * Converts the model instance to a plain JSON object
     * Ensures proper serialization of Date objects and error data
     */
    toJSON(): Record<string, any> {
        return {
            id: this.id,
            flow_id: this.flow_id,
            status: this.status,
            duration_ms: this.duration_ms,
            error: this.error,
            created_at: this.created_at?.toISOString(),
            updated_at: this.updated_at?.toISOString()
        };
    }
}