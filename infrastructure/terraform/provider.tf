# AWS Provider Configuration for Test Automation Framework
# AWS Provider Version >= 3.0

# Define required providers with version constraints
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 3.0"
    }
  }
}

# Primary AWS Provider Configuration
# Implements: Infrastructure deployment for primary region
provider "aws" {
  region = var.aws_region

  # Default tags applied to all resources
  default_tags {
    tags = {
      Environment = var.environment
      Project     = "test-automation-framework"
      ManagedBy   = "terraform"
      # Add environment-specific tag based on the deployment environment
      DeploymentTier = var.environment == "production" ? "prod" : (
        var.environment == "staging" ? "staging" : (
          var.environment == "dr" ? "dr" : "dev"
        )
      )
    }
  }

  # Enable AWS API retry logic for better reliability
  retry_mode = "standard"
  
  # Configure maximum API retries for better resilience
  max_retries = 3
}

# Secondary AWS Provider Configuration for DR
# Implements: Disaster recovery infrastructure in secondary region
provider "aws" {
  alias  = "secondary"
  region = var.aws_secondary_region

  # Default tags for secondary region resources
  default_tags {
    tags = {
      Environment = "dr"
      Project     = "test-automation-framework"
      ManagedBy   = "terraform"
      DeploymentTier = "dr"
      PrimaryRegion = var.aws_region
    }
  }

  # Enable AWS API retry logic for better reliability
  retry_mode = "standard"
  
  # Configure maximum API retries for better resilience
  max_retries = 3
}

# Configure AWS provider assume role for cross-account access if needed
# This is commented out by default and can be uncommented when needed
# provider "aws" {
#   assume_role {
#     role_arn = "arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME"
#     session_name = "terraform-session"
#   }
# }

# Configure provider features and behaviors
provider "aws" {
  # Enable EC2 metadata tokens for enhanced security
  ec2_metadata_service_endpoint_mode = "IPv4"
  
  # Configure S3 to use path-style addressing for compatibility
  s3_force_path_style = false
  
  # Configure to use FIPS endpoints where available for compliance
  use_fips_endpoint = var.environment == "production" ? true : false
}