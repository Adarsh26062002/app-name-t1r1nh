#!/bin/bash

# AWS CDK Version: 2.0.0
# AWS CLI Version: 2.0
# Docker Version: 20.10.0
# Bash Version: 5.0

# Source the environment setup script
source "$(dirname "$0")/setup-env.sh"

# Implementation requirement: Validates all prerequisites are met before starting deployment
validatePrerequisites() {
    echo "Validating deployment prerequisites..."
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        echo "Error: AWS credentials not configured"
        return 1
    fi

    # Verify AWS CDK installation
    if ! cdk --version &>/dev/null; then
        echo "Error: AWS CDK not installed"
        return 1
    }

    # Check Docker daemon
    if ! docker info &>/dev/null; then
        echo "Error: Docker daemon not running"
        return 1
    }

    # Verify required configuration files
    local required_files=(
        "infrastructure/config/aws-auth.json"
        "infrastructure/config/ecs-task-definition.json"
        "infrastructure/config/cloudwatch-config.json"
        "infrastructure/config/rds-config.json"
    )

    for file in "${required_files[@]}"; do
        if [[ ! -f $file ]]; then
            echo "Error: Required configuration file not found: $file"
            return 1
        fi
    done

    # Verify environment variables
    local required_vars=(
        "DEPLOY_ENV"
        "AWS_REGION"
        "AWS_ACCOUNT_ID"
        "DOCKER_REGISTRY"
    )

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            echo "Error: Required environment variable not set: $var"
            return 1
        fi
    done

    return 0
}

# Implementation requirement: Builds and pushes Docker images to ECR
buildDockerImages() {
    echo "Building and pushing Docker images..."

    # Login to AWS ECR
    if ! aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${DOCKER_REGISTRY}"; then
        echo "Error: Failed to authenticate with ECR"
        return 1
    fi

    # Create ECR repositories if they don't exist
    local repos=("test-framework" "test-executor" "test-manager")
    for repo in "${repos[@]}"; do
        aws ecr describe-repositories --repository-names "${repo}" &>/dev/null || \
        aws ecr create-repository --repository-name "${repo}" --image-scanning-configuration scanOnPush=true
    }

    # Build Docker images
    local build_args=(
        "--build-arg ENVIRONMENT=${DEPLOY_ENV}"
        "--build-arg NODE_ENV=${DEPLOY_ENV}"
        "--build-arg AWS_REGION=${AWS_REGION}"
    )

    if ! docker build ${build_args[@]} -t "${DOCKER_REGISTRY}/test-framework:${DEPLOY_ENV}" -f infrastructure/docker/Dockerfile .; then
        echo "Error: Failed to build test framework image"
        return 1
    fi

    # Tag images
    docker tag "${DOCKER_REGISTRY}/test-framework:${DEPLOY_ENV}" "${DOCKER_REGISTRY}/test-framework:latest"

    # Push images to ECR
    if ! docker push "${DOCKER_REGISTRY}/test-framework:${DEPLOY_ENV}"; then
        echo "Error: Failed to push test framework image"
        return 1
    }
    
    if ! docker push "${DOCKER_REGISTRY}/test-framework:latest"; then
        echo "Error: Failed to push test framework latest tag"
        return 1
    }

    return 0
}

# Implementation requirement: Deploys the AWS infrastructure using AWS CDK
deployInfrastructure() {
    echo "Deploying AWS infrastructure..."

    # Source environment setup
    if ! setupEnvironment "${DEPLOY_ENV}"; then
        echo "Error: Failed to setup environment"
        return 1
    }

    # Bootstrap CDK if needed
    if ! cdk bootstrap "aws://${AWS_ACCOUNT_ID}/${AWS_REGION}"; then
        echo "Error: Failed to bootstrap CDK"
        return 1
    }

    # Deploy stacks
    local stacks=(
        "NetworkStack"
        "RdsStack"
        "EcsStack"
        "MonitoringStack"
    )

    for stack in "${stacks[@]}"; do
        echo "Deploying ${stack}..."
        if ! cdk deploy "${stack}" --require-approval never; then
            echo "Error: Failed to deploy ${stack}"
            return 1
        fi
    done

    # Run post-deployment health checks
    echo "Running health checks..."
    
    # Check VPC endpoints
    if ! aws ec2 describe-vpc-endpoints --filters "Name=vpc-id,Values=$(aws cloudformation describe-stacks --stack-name NetworkStack --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' --output text)" &>/dev/null; then
        echo "Warning: VPC endpoints validation failed"
    fi

    # Verify RDS instance status
    if ! aws rds describe-db-instances --query 'DBInstances[?DBInstanceStatus==`available`]' &>/dev/null; then
        echo "Warning: RDS instance not available"
    fi

    # Check ECS cluster status
    if ! aws ecs describe-clusters --clusters test-framework-cluster --query 'clusters[?status==`ACTIVE`]' &>/dev/null; then
        echo "Warning: ECS cluster not active"
    fi

    return 0
}

# Implementation requirement: Handles rollback in case of deployment failure
rollback() {
    echo "Initiating rollback procedure..."
    local failed_stack=$1

    # Destroy failed stack
    if [[ -n "${failed_stack}" ]]; then
        echo "Rolling back ${failed_stack}..."
        cdk destroy "${failed_stack}" --force
    fi

    # Revert to previous ECR image tags
    local previous_tag=$(aws ecr describe-images \
        --repository-name test-framework \
        --query 'imageDetails[?imageTags[0]!=`latest`]|[0].imageTags[0]' \
        --output text)

    if [[ -n "${previous_tag}" ]]; then
        aws ecr batch-delete-image \
            --repository-name test-framework \
            --image-ids imageTag="${DEPLOY_ENV}"
    fi

    # Clean up resources
    echo "Cleaning up resources..."
    aws cloudformation list-stack-resources --stack-name "${failed_stack}" \
        --query 'StackResourceSummaries[?ResourceStatus==`CREATE_FAILED`].LogicalResourceId' \
        --output text | xargs -I {} aws cloudformation delete-stack --stack-name {}

    # Notify deployment failure
    aws sns publish \
        --topic-arn "arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:deployment-notifications" \
        --message "Deployment failed for ${failed_stack} in ${DEPLOY_ENV} environment. Rollback completed."

    return 0
}

# Main execution
main() {
    # Validate input
    if [[ $# -ne 1 ]]; then
        echo "Usage: $0 <environment>"
        echo "Environments: development, staging, production, dr"
        exit 1
    fi

    export DEPLOY_ENV=$1

    # Execute deployment steps
    if ! validatePrerequisites; then
        echo "Prerequisite validation failed"
        exit 1
    fi

    if ! buildDockerImages; then
        echo "Docker image build failed"
        rollback
        exit 1
    fi

    if ! deployInfrastructure; then
        echo "Infrastructure deployment failed"
        rollback "MainStack"
        exit 1
    fi

    echo "Deployment completed successfully"
    exit 0
}

# Execute main function
main "$@"