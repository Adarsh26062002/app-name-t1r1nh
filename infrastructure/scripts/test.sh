#!/bin/bash

# Required external dependencies:
# - bash v5.0
# - node v18.x
# - docker v20.x

# Source environment setup script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/setup-env.sh"

# Implementation requirement: Validates that all required environment variables and configurations are properly set
validateEnvironment() {
    local required_vars=(
        "TEST_ENV"
        "LOG_LEVEL"
        "TEST_FRAMEWORK_PATH"
        "MAX_PARALLEL_TESTS"
        "TEST_TIMEOUT"
        "REPORT_OUTPUT_DIR"
        "DB_HOST"
        "DB_PORT"
    )

    # Check if setup-env.sh exists and is executable
    if [[ ! -x "${SCRIPT_DIR}/setup-env.sh" ]]; then
        echo "Error: setup-env.sh not found or not executable"
        return 1
    }

    # Verify all required environment variables are set
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            echo "Error: Required environment variable $var is not set"
            return 1
        fi
    done

    # Validate database connection settings
    if ! nc -z "$DB_HOST" "$DB_PORT" &>/dev/null; then
        echo "Error: Database connection failed - $DB_HOST:$DB_PORT"
        return 1
    fi

    # Check test framework binary exists and is executable
    if [[ ! -x "$TEST_FRAMEWORK_PATH" ]]; then
        echo "Error: Test framework binary not found or not executable at $TEST_FRAMEWORK_PATH"
        return 1
    fi

    # Verify report output directory exists and is writable
    if [[ ! -d "$REPORT_OUTPUT_DIR" ]]; then
        mkdir -p "$REPORT_OUTPUT_DIR" || {
            echo "Error: Failed to create report output directory"
            return 1
        }
    fi
    if [[ ! -w "$REPORT_OUTPUT_DIR" ]]; then
        echo "Error: Report output directory is not writable"
        return 1
    }

    return 0
}

# Implementation requirement: Prepares the test environment by initializing required services and configurations
setupTestEnvironment() {
    echo "Setting up test environment..."
    
    # Source setup-env.sh to load environment variables
    if ! source "${SCRIPT_DIR}/setup-env.sh"; then
        echo "Error: Failed to source environment variables"
        return 1
    fi

    # Initialize test database connections
    echo "Initializing database connections..."
    if ! docker-compose up -d db; then
        echo "Error: Failed to start database container"
        return 1
    fi

    # Start required Docker containers
    echo "Starting test containers..."
    local containers=("test-framework" "test-api" "test-db")
    for container in "${containers[@]}"; do
        if ! docker-compose up -d "$container"; then
            echo "Error: Failed to start container $container"
            return 1
        fi
    done

    # Create temporary directories for test artifacts
    echo "Creating temporary directories..."
    local temp_dirs=("${REPORT_OUTPUT_DIR}/temp" "${REPORT_OUTPUT_DIR}/artifacts" "${REPORT_OUTPUT_DIR}/logs")
    for dir in "${temp_dirs[@]}"; do
        mkdir -p "$dir" || {
            echo "Error: Failed to create temporary directory $dir"
            return 1
        }
    done

    # Configure logging settings
    echo "Configuring logging..."
    local log_file="${REPORT_OUTPUT_DIR}/logs/test-execution.log"
    if [[ "$LOG_LEVEL" == "debug" ]]; then
        export DEBUG=true
        set -x
    fi
    exec 1> >(tee -a "$log_file")
    exec 2> >(tee -a "$log_file" >&2)

    return 0
}

# Implementation requirement: Executes the test suite with proper resource management and result collection
runTests() {
    echo "Starting test execution..."
    local exit_code=0

    # Validate environment configuration
    if ! validateEnvironment; then
        echo "Error: Environment validation failed"
        return 1
    fi

    # Setup test environment
    if ! setupTestEnvironment; then
        echo "Error: Test environment setup failed"
        return 1
    }

    # Initialize test framework with configuration
    echo "Initializing test framework..."
    local config_file="${REPORT_OUTPUT_DIR}/temp/test-config.json"
    cat > "$config_file" << EOF
{
    "parallelExecutions": $MAX_PARALLEL_TESTS,
    "timeout": $TEST_TIMEOUT,
    "reportDir": "$REPORT_OUTPUT_DIR",
    "dbConfig": {
        "host": "$DB_HOST",
        "port": $DB_PORT
    },
    "logLevel": "$LOG_LEVEL"
}
EOF

    # Execute test suites with parallel execution support
    echo "Executing test suites..."
    local test_command="node $TEST_FRAMEWORK_PATH"
    if [[ $MAX_PARALLEL_TESTS -gt 1 ]]; then
        test_command+=" --parallel $MAX_PARALLEL_TESTS"
    fi
    test_command+=" --config $config_file"
    
    # Monitor test execution progress
    local start_time=$(date +%s)
    if ! $test_command; then
        exit_code=1
    fi
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Collect and aggregate test results
    echo "Collecting test results..."
    local results_file="${REPORT_OUTPUT_DIR}/test-results.json"
    find "${REPORT_OUTPUT_DIR}/temp" -name "*.result.json" -exec jq -s 'add' {} > "$results_file" \;

    # Generate test reports
    echo "Generating test reports..."
    if ! node "$TEST_FRAMEWORK_PATH" --report --input "$results_file" --output "$REPORT_OUTPUT_DIR"; then
        echo "Warning: Report generation failed"
    fi

    # Export test results to specified output directory
    echo "Exporting test results..."
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local archive_name="test-results_${timestamp}.tar.gz"
    tar -czf "${REPORT_OUTPUT_DIR}/${archive_name}" \
        -C "$REPORT_OUTPUT_DIR" \
        --exclude="temp" \
        --exclude="*.tar.gz" \
        .

    # Cleanup test environment
    cleanup

    echo "Test execution completed in ${duration} seconds"
    return $exit_code
}

# Implementation requirement: Performs cleanup of test environment and resources
cleanup() {
    echo "Performing cleanup..."

    # Stop and remove test containers
    echo "Stopping containers..."
    docker-compose down --remove-orphans

    # Clean up temporary files and directories
    echo "Cleaning up temporary files..."
    rm -rf "${REPORT_OUTPUT_DIR}/temp"

    # Reset database state if required
    if [[ "$TEST_ENV" != "production" ]]; then
        echo "Resetting database state..."
        docker-compose run --rm test-db psql -h "$DB_HOST" -p "$DB_PORT" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    fi

    # Remove test artifacts
    echo "Removing test artifacts..."
    find "${REPORT_OUTPUT_DIR}" -name "*.tmp" -delete
    find "${REPORT_OUTPUT_DIR}" -name "*.lock" -delete
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Set up error handling
    set -euo pipefail
    trap cleanup EXIT

    # Execute tests
    if runTests; then
        echo "Test execution completed successfully"
        exit 0
    else
        echo "Test execution failed"
        exit 1
    fi
fi