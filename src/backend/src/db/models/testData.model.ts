/**
 * testData.model.ts
 * Implements the TestData model for managing test data entities in the database.
 * This model handles validation, serialization, and data integrity for test data records.
 * 
 * Implements requirements from:
 * - Test Data Storage (system_design/database_design/test_data_storage)
 */

// External dependencies
import { v4 as uuidv4 } from 'uuid'; // ^8.3.2

// Internal dependencies
import { BAD_REQUEST } from '../../constants/errors';

/**
 * Interface defining the structure of test data entities
 */
export interface ITestData {
    id: string;
    name: string;
    scope: string;
    schema: object;
    valid_from: Date;
    valid_to: Date;
    created_at: Date;
    updated_at: Date;
}

/**
 * Interface defining the required fields for creating test data
 */
export interface TestDataSchema {
    name: string;
    scope: string;
    schema: object;
    valid_from: Date;
    valid_to: Date;
    created_at: Date;
    updated_at: Date;
}

/**
 * TestDataModel class implementing the ITestData interface
 * Manages test data entities with validation and serialization capabilities
 */
export class TestDataModel implements ITestData {
    public id: string;
    public name: string;
    public scope: string;
    public schema: object;
    public valid_from: Date;
    public valid_to: Date;
    public created_at: Date;
    public updated_at: Date;

    /**
     * Creates a new instance of TestDataModel
     * Generates UUID if not provided and sets timestamps
     */
    constructor(
        id?: string,
        name?: string,
        scope?: string,
        schema?: object,
        valid_from?: Date,
        valid_to?: Date
    ) {
        this.id = id || uuidv4();
        this.name = name || '';
        this.scope = scope || '';
        this.schema = schema || {};
        this.valid_from = valid_from || new Date();
        this.valid_to = valid_to || null;
        this.created_at = new Date();
        this.updated_at = new Date();

        // Validate schema structure upon initialization
        if (schema) {
            this.validateSchema(schema);
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
            scope: this.scope,
            schema: this.schema,
            valid_from: this.valid_from.toISOString(),
            valid_to: this.valid_to ? this.valid_to.toISOString() : null,
            created_at: this.created_at.toISOString(),
            updated_at: this.updated_at.toISOString()
        };
    }

    /**
     * Internal method to validate the test data schema structure
     * Ensures schema meets required format and constraints
     */
    private validateSchema(schema: object): boolean {
        if (!schema || typeof schema !== 'object') {
            throw new Error(`${BAD_REQUEST}: Invalid schema format - must be an object`);
        }

        // Validate schema has required properties
        const requiredProperties = ['fields', 'constraints'];
        for (const prop of requiredProperties) {
            if (!Object.prototype.hasOwnProperty.call(schema, prop)) {
                throw new Error(`${BAD_REQUEST}: Schema missing required property: ${prop}`);
            }
        }

        // Validate schema fields structure
        const { fields, constraints } = schema as any;
        if (!Array.isArray(fields)) {
            throw new Error(`${BAD_REQUEST}: Schema fields must be an array`);
        }

        // Validate each field has required properties
        fields.forEach((field: any) => {
            if (!field.name || !field.type) {
                throw new Error(`${BAD_REQUEST}: Each schema field must have name and type properties`);
            }
        });

        // Validate constraints object
        if (typeof constraints !== 'object') {
            throw new Error(`${BAD_REQUEST}: Schema constraints must be an object`);
        }

        return true;
    }

    /**
     * Validates all model properties
     * Ensures data integrity before database operations
     */
    public validate(): boolean {
        // Validate required fields
        if (!this.name || !this.scope) {
            throw new Error(`${BAD_REQUEST}: Name and scope are required fields`);
        }

        // Validate name format
        if (typeof this.name !== 'string' || this.name.length < 3) {
            throw new Error(`${BAD_REQUEST}: Name must be a string with minimum length of 3`);
        }

        // Validate scope format
        if (typeof this.scope !== 'string' || this.scope.length < 2) {
            throw new Error(`${BAD_REQUEST}: Scope must be a string with minimum length of 2`);
        }

        // Validate schema
        this.validateSchema(this.schema);

        // Validate date ranges
        if (this.valid_to && this.valid_from > this.valid_to) {
            throw new Error(`${BAD_REQUEST}: valid_from date must be before valid_to date`);
        }

        return true;
    }

    /**
     * Checks if the test data is currently valid based on date range
     */
    public isValid(): boolean {
        const now = new Date();
        const isAfterStart = now >= this.valid_from;
        const isBeforeEnd = !this.valid_to || now <= this.valid_to;
        
        return isAfterStart && isBeforeEnd;
    }
}