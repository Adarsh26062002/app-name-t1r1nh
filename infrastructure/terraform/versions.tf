# This file defines version constraints for Terraform and required providers
# Implements: Infrastructure deployment version control across all environments
# Required Provider Versions: Terraform ~> 1.5.0, AWS Provider ~> 4.67.0

terraform {
  # Specify the required Terraform version
  # Implements: Consistent Terraform version across CI/CD pipeline
  required_version = "~> 1.5.0"

  # Define required providers with strict version constraints
  # Implements: Provider version compatibility across development, staging, production, and DR
  required_providers {
    # AWS Provider configuration with version constraint
    # Version 4.67.0 provides stability and necessary features for our infrastructure
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.67.0"
      
      # Configuration ensures compatibility with:
      # - ECS container deployments
      # - RDS PostgreSQL instances
      # - VPC networking
      # - CloudWatch monitoring
    }
  }
}

# Version Constraints Explanation:
# ~> 1.5.0 means >= 1.5.0 and < 1.6.0 (allowing only patch updates)
# This ensures:
# - Consistent behavior across different environments
# - Predictable infrastructure deployments
# - Stable CI/CD pipeline execution
# - Compatible provider interactions

# Note: These versions have been tested and verified to work with:
# - Development environment (local Docker containers)
# - Staging environment (AWS infrastructure)
# - Production environment (AWS production)
# - DR environment (AWS secondary region)