#!/bin/bash

# AWS CLI Version: 2.0
# Bash Version: 5.0

# Function to validate environment name
validate_environment() {
    local env=$1
    case $env in
        development|staging|production|dr)
            return 0
            ;;
        *)
            echo "Error: Invalid environment. Must be one of: development, staging, production, dr"
            return 1
            ;;
    esac
}

# Function to load and validate AWS authentication settings
load_aws_auth() {
    local env=$1
    local aws_auth_file="infrastructure/config/aws-auth.json"
    
    if [[ ! -f $aws_auth_file ]]; then
        echo "Error: AWS authentication file not found at $aws_auth_file"
        return 1
    }

    # Load IAM roles based on environment
    # Implementation requirement: Configures environment-specific IAM roles and policies
    export ECS_TASK_EXECUTION_ROLE=$(jq -r '.iamRoles.ecsTaskExecutionRole.name' $aws_auth_file)
    export RDS_ACCESS_ROLE=$(jq -r '.iamRoles.rdsAccessRole.name' $aws_auth_file)
    export MONITORING_ROLE=$(jq -r '.iamRoles.monitoringRole.name' $aws_auth_file)
}

# Function to configure ECS task definitions
configure_ecs_tasks() {
    local env=$1
    local ecs_config_file="infrastructure/config/ecs-task-definition.json"
    
    if [[ ! -f $ecs_config_file ]]; then
        echo "Error: ECS task definition file not found at $ecs_config_file"
        return 1
    }

    # Implementation requirement: Configure ECS task definitions using ecs-task-definition.json
    export ECS_TASK_FAMILY=$(jq -r '.family' $ecs_config_file)
    export ECS_CPU=$(jq -r '.cpu' $ecs_config_file)
    export ECS_MEMORY=$(jq -r '.memory' $ecs_config_file)
    export CONTAINER_PORT=$(jq -r '.containerDefinitions[0].portMappings[0].containerPort' $ecs_config_file)
}

# Function to initialize CloudWatch monitoring
init_cloudwatch() {
    local env=$1
    local cloudwatch_config_file="infrastructure/config/cloudwatch-config.json"
    
    if [[ ! -f $cloudwatch_config_file ]]; then
        echo "Error: CloudWatch config file not found at $cloudwatch_config_file"
        return 1
    }

    # Implementation requirement: Initialize CloudWatch monitoring using cloudwatch-config.json
    export CLOUDWATCH_NAMESPACE="TestFramework"
    export ERROR_RATE_THRESHOLD=$(jq -r '.thresholds.errorRateThreshold' $cloudwatch_config_file)
    export EXECUTION_TIME_THRESHOLD=$(jq -r '.thresholds.executionTimeThreshold' $cloudwatch_config_file)
    export API_LATENCY_THRESHOLD=$(jq -r '.thresholds.apiLatencyThreshold' $cloudwatch_config_file)
    
    # Set log group names based on environment
    export CLOUDWATCH_LOG_GROUP="/test-framework/${env}"
    export TEST_EXECUTOR_LOG_GROUP=$(jq -r '.log_groups.testExecutor.name' $cloudwatch_config_file)
    export TEST_MANAGER_LOG_GROUP=$(jq -r '.log_groups.testManager.name' $cloudwatch_config_file)
}

# Function to configure RDS database settings
configure_rds() {
    local env=$1
    local rds_config_file="infrastructure/config/rds-config.json"
    
    if [[ ! -f $rds_config_file ]]; then
        echo "Error: RDS config file not found at $rds_config_file"
        return 1
    }

    # Implementation requirement: Configure RDS database settings from rds-config.json
    export DB_PORT=$(jq -r '.rdsConfig.networking.port' $rds_config_file)
    
    # Set database endpoints based on environment
    case $env in
        development)
            export DB_HOST="localhost"
            export EVENTS_DB_NAME="events_db_dev"
            export INVENTORY_DB_NAME="inventory_db_dev"
            ;;
        staging)
            export DB_HOST="${env}.events-db-instance.${AWS_REGION}.rds.amazonaws.com"
            export EVENTS_DB_NAME="events_db_staging"
            export INVENTORY_DB_NAME="inventory_db_staging"
            ;;
        production|dr)
            export DB_HOST="${env}.events-db-instance.${AWS_REGION}.rds.amazonaws.com"
            export EVENTS_DB_NAME="events_db_prod"
            export INVENTORY_DB_NAME="inventory_db_prod"
            ;;
    esac
}

# Function to setup test environment
setup_test_environment() {
    # Implementation requirement: Sets up the test environment configuration locally for development and testing purposes
    export TEST_FRAMEWORK_ENV="test"
    export TEST_DATA_PATH="./test/data"
    export TEST_RESULTS_PATH="./test/results"
    export TEST_REPORTS_PATH="./test/reports"
    
    # Configure local test database connections
    export TEST_DB_HOST="localhost"
    export TEST_DB_PORT="5432"
    export TEST_DB_NAME="test_db"
    
    # Setup local monitoring configurations
    export TEST_METRICS_ENABLED="true"
    export TEST_METRICS_PORT="9090"
    
    return 0
}

# Function to validate configurations
validate_configurations() {
    # Implementation requirement: Validates all required configuration files and environment variables are properly set
    local required_vars=(
        "AWS_REGION"
        "AWS_ACCOUNT_ID"
        "ENVIRONMENT"
        "DB_HOST"
        "DB_PORT"
        "CLOUDWATCH_LOG_GROUP"
        "ECS_TASK_FAMILY"
        "TEST_FRAMEWORK_ENV"
    )

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            echo "Error: Required environment variable $var is not set"
            return 1
        fi
    done

    # Validate AWS authentication settings
    if [[ -z "$ECS_TASK_EXECUTION_ROLE" ]] || [[ -z "$RDS_ACCESS_ROLE" ]]; then
        echo "Error: AWS IAM roles not properly configured"
        return 1
    fi

    return 0
}

# Main setup function
setupEnvironment() {
    local target_env=$1

    # Validate input environment
    if ! validate_environment "$target_env"; then
        return 1
    fi

    # Set base environment variables
    export ENVIRONMENT=$target_env
    
    # Set AWS region based on environment
    case $target_env in
        production|staging)
            export AWS_REGION="us-west-2"
            ;;
        dr)
            export AWS_REGION="us-east-1"
            ;;
        development)
            export AWS_REGION="us-west-2"
            ;;
    esac

    # Load AWS authentication settings
    if ! load_aws_auth "$target_env"; then
        return 1
    fi

    # Configure ECS tasks
    if ! configure_ecs_tasks "$target_env"; then
        return 1
    fi

    # Initialize CloudWatch monitoring
    if ! init_cloudwatch "$target_env"; then
        return 1
    fi

    # Configure RDS settings
    if ! configure_rds "$target_env"; then
        return 1
    fi

    # Setup Docker registry
    export DOCKER_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

    # Setup test framework environment
    if [[ "$target_env" == "development" ]]; then
        if ! setup_test_environment; then
            return 1
        fi
    fi

    # Validate all configurations
    if ! validate_configurations; then
        return 1
    fi

    return 0
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -ne 1 ]]; then
        echo "Usage: $0 <environment>"
        echo "Environments: development, staging, production, dr"
        exit 1
    fi

    if setupEnvironment "$1"; then
        echo "Environment setup completed successfully for $1"
        exit 0
    else
        echo "Environment setup failed for $1"
        exit 1
    fi
fi