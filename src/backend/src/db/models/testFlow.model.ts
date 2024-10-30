/**
 * testFlow.model.ts
 * Defines the TestFlow model for managing test flow configurations and executions in the database.
 * Implements requirements from:
 * - Test Flow Management (system_design/database_design.test_data_storage)
 */

// External dependencies
import { v4 as uuidv4 } from 'uuid'; // ^8.3.2

// Internal dependencies
import { ITestData } from '../models/testData.model';

/**
 * Interface defining the structure of a test flow entity
 */
export interface ITestFlow {
    id: string;
    name: string;
    description: string;
    flow_type: string;
    config: TestFlowConfig;
    test_data_id: string;
    status: string;
    created_at: Date;
    updated_at: Date;
}

/**
 * Interface defining the structure of test flow configuration
 */
export interface TestFlowConfig {
    steps: Array<{
        name: string;
        type: string;
        action: string;
        input?: any;
        expected?: any;
        timeout?: number;
    }>;
    parameters: {
        [key: string]: any;
    };
    environment: {
        name: string;
        variables: { [key: string]: string };
    };
    timeout: number;
    retries: number;
}

/**
 * TestFlowModel class implementing the ITestFlow interface
 * Manages test flow entities with validation and serialization capabilities
 */
export default class TestFlowModel implements ITestFlow {
    public id: string;
    public name: string;
    public description: string;
    public flow_type: string;
    public config: TestFlowConfig;
    public test_data_id: string;
    public status: string;
    public created_at: Date;
    public updated_at: Date;

    /**
     * Creates a new instance of TestFlowModel
     * Generates UUID if not provided and sets timestamps
     */
    constructor(
        id?: string,
        name?: string,
        description?: string,
        flow_type?: string,
        config?: TestFlowConfig,
        test_data_id?: string,
        status?: string
    ) {
        this.id = id || uuidv4();
        this.name = name || '';
        this.description = description || '';
        this.flow_type = flow_type || '';
        this.config = config || {
            steps: [],
            parameters: {},
            environment: {
                name: 'default',
                variables: {}
            },
            timeout: 30000, // Default timeout of 30 seconds
            retries: 0
        };
        this.test_data_id = test_data_id || '';
        this.status = status || 'pending';
        this.created_at = new Date();
        this.updated_at = new Date();

        // Validate config if provided
        if (config) {
            this.validateConfig(config);
        }
    }

    /**
     * Converts the model instance to a plain JSON object
     * Handles date serialization for API responses
     */
    public toJSON(): object {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            flow_type: this.flow_type,
            config: this.config,
            test_data_id: this.test_data_id,
            status: this.status,
            created_at: this.created_at.toISOString(),
            updated_at: this.updated_at.toISOString()
        };
    }

    /**
     * Internal method to validate the test flow configuration structure
     * Ensures config meets required format and constraints
     */
    private validateConfig(config: TestFlowConfig): boolean {
        if (!config || typeof config !== 'object') {
            throw new Error('Invalid config format - must be an object');
        }

        // Validate steps array
        if (!Array.isArray(config.steps)) {
            throw new Error('Config steps must be an array');
        }

        // Validate each step structure
        config.steps.forEach((step, index) => {
            if (!step.name || !step.type || !step.action) {
                throw new Error(`Step ${index} missing required properties (name, type, action)`);
            }

            // Validate step type
            const validTypes = ['api', 'database', 'validation', 'transformation'];
            if (!validTypes.includes(step.type)) {
                throw new Error(`Invalid step type at index ${index}: ${step.type}`);
            }
        });

        // Validate parameters object
        if (typeof config.parameters !== 'object') {
            throw new Error('Config parameters must be an object');
        }

        // Validate environment configuration
        if (!config.environment || typeof config.environment !== 'object') {
            throw new Error('Config environment must be an object');
        }

        if (!config.environment.name || typeof config.environment.variables !== 'object') {
            throw new Error('Environment must have name and variables object');
        }

        // Validate timeout
        if (typeof config.timeout !== 'number' || config.timeout <= 0) {
            throw new Error('Config timeout must be a positive number');
        }

        // Validate retries
        if (typeof config.retries !== 'number' || config.retries < 0) {
            throw new Error('Config retries must be a non-negative number');
        }

        return true;
    }

    /**
     * Validates all model properties
     * Ensures data integrity before database operations
     */
    public validate(): boolean {
        // Validate required fields
        if (!this.name || !this.flow_type) {
            throw new Error('Name and flow_type are required fields');
        }

        // Validate name format
        if (typeof this.name !== 'string' || this.name.length < 3) {
            throw new Error('Name must be a string with minimum length of 3');
        }

        // Validate flow type
        const validFlowTypes = ['api', 'database', 'integration', 'e2e'];
        if (!validFlowTypes.includes(this.flow_type)) {
            throw new Error(`Invalid flow_type: ${this.flow_type}`);
        }

        // Validate config
        this.validateConfig(this.config);

        // Validate test_data_id
        if (!this.test_data_id) {
            throw new Error('test_data_id is required');
        }

        // Validate status
        const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
        if (!validStatuses.includes(this.status)) {
            throw new Error(`Invalid status: ${this.status}`);
        }

        return true;
    }
}