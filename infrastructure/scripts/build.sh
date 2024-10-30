#!/bin/bash

# Docker Version: 20.10
# Docker Compose Version: 1.29.2
# Bash Version: 5.0

# Source environment setup script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/setup-env.sh"

# Implementation requirement: Builds Docker images for both production and development environments
buildDockerImages() {
    local environment=$1
    echo "Building Docker images for ${environment} environment..."

    # Validate environment
    case ${environment} in
        development|staging|production|dr)
            ;;
        *)
            echo "Error: Invalid environment. Must be one of: development, staging, production, dr"
            return 1
            ;;
    esac

    # Setup environment variables
    if ! setupEnvironment "${environment}"; then
        echo "Error: Failed to setup environment variables"
        return 1
    }

    # Set build arguments
    BUILD_ARGS=(
        "--build-arg NODE_ENV=${environment}"
        "--build-arg BUILD_VERSION=${IMAGE_TAG:-latest}"
        "--build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    )

    # Implementation requirement: Build production Docker image using multi-stage builds
    echo "Building production image..."
    if ! docker build \
        ${BUILD_ARGS[@]} \
        --file infrastructure/docker/Dockerfile \
        --tag "${DOCKER_REGISTRY}/test-framework:${IMAGE_TAG}" \
        --tag "${DOCKER_REGISTRY}/test-framework:latest" \
        --cache-from "${DOCKER_REGISTRY}/test-framework:latest" \
        --target production .; then
        echo "Error: Production image build failed"
        return 1
    fi

    # Implementation requirement: Build development image if needed
    if [[ "${environment}" == "development" ]]; then
        echo "Building development image..."
        if ! docker build \
            ${BUILD_ARGS[@]} \
            --file infrastructure/docker/Dockerfile.dev \
            --tag "${DOCKER_REGISTRY}/test-framework:${IMAGE_TAG}-dev" \
            --cache-from "${DOCKER_REGISTRY}/test-framework:latest" \
            .; then
            echo "Error: Development image build failed"
            return 1
        fi
    fi

    return 0
}

# Implementation requirement: Prepares the environment for deployment
prepareEnvironment() {
    local environment=$1
    echo "Preparing environment for ${environment}..."

    # Verify Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        echo "Error: Docker daemon is not running"
        return 1
    fi

    # Check Docker Compose installation
    if ! docker-compose version >/dev/null 2>&1; then
        echo "Error: Docker Compose is not installed"
        return 1
    }

    # Validate required files exist
    local required_files=(
        "infrastructure/docker/Dockerfile"
        "infrastructure/docker/Dockerfile.dev"
        "infrastructure/docker/docker-compose.yml"
        "infrastructure/docker/docker-compose.dev.yml"
    )

    for file in "${required_files[@]}"; do
        if [[ ! -f "${file}" ]]; then
            echo "Error: Required file ${file} not found"
            return 1
        fi
    done

    # Setup environment-specific variables
    case ${environment} in
        development)
            export COMPOSE_FILE="infrastructure/docker/docker-compose.dev.yml"
            export NODE_ENV="development"
            ;;
        staging)
            export COMPOSE_FILE="infrastructure/docker/docker-compose.yml"
            export NODE_ENV="staging"
            ;;
        production|dr)
            export COMPOSE_FILE="infrastructure/docker/docker-compose.yml"
            export NODE_ENV="production"
            ;;
    esac

    # Initialize logging
    mkdir -p logs/${environment}
    export LOG_PATH="./logs/${environment}"

    return 0
}

# Implementation requirement: Validates the built Docker images
validateBuild() {
    local imageTag=$1
    echo "Validating build for image tag: ${imageTag}..."

    # Run container security scanning
    echo "Running security scan..."
    if ! docker scan "${DOCKER_REGISTRY}/test-framework:${imageTag}"; then
        echo "Warning: Security vulnerabilities detected"
    fi

    # Verify image size and layers
    echo "Checking image size and layers..."
    local image_size=$(docker image inspect "${DOCKER_REGISTRY}/test-framework:${imageTag}" --format='{{.Size}}')
    if (( image_size > 1000000000 )); then  # 1GB limit
        echo "Warning: Image size exceeds 1GB"
    fi

    # Validate image configuration
    echo "Validating image configuration..."
    if ! docker image inspect "${DOCKER_REGISTRY}/test-framework:${imageTag}" >/dev/null 2>&1; then
        echo "Error: Image validation failed"
        return 1
    fi

    # Run smoke tests
    echo "Running smoke tests..."
    if ! docker run --rm "${DOCKER_REGISTRY}/test-framework:${imageTag}" npm run test:smoke; then
        echo "Error: Smoke tests failed"
        return 1
    fi

    # Verify resource constraints
    echo "Verifying resource constraints..."
    if ! docker run --rm \
        --memory=512m \
        --cpus=0.5 \
        "${DOCKER_REGISTRY}/test-framework:${imageTag}" \
        node -e 'console.log("Resource constraints test passed")'; then
        echo "Error: Resource constraints validation failed"
        return 1
    fi

    return 0
}

# Main execution
main() {
    # Validate input
    if [[ $# -lt 1 ]]; then
        echo "Usage: $0 <environment> [image_tag]"
        echo "Environments: development, staging, production, dr"
        exit 1
    fi

    local environment=$1
    export IMAGE_TAG=${2:-$(date +%Y%m%d-%H%M%S)}

    # Prepare environment
    if ! prepareEnvironment "${environment}"; then
        echo "Environment preparation failed"
        exit 1
    fi

    # Build images
    if ! buildDockerImages "${environment}"; then
        echo "Docker image build failed"
        exit 1
    fi

    # Validate builds
    if ! validateBuild "${IMAGE_TAG}"; then
        echo "Build validation failed"
        exit 1
    fi

    echo "Build completed successfully for ${environment} environment"
    echo "Image tag: ${IMAGE_TAG}"
    exit 0
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi