# Backend Configuration for Terraform State Management
# AWS Provider Version: ~> 4.0
# Purpose: Implements robust state management and locking mechanism using AWS S3 and DynamoDB

# Create S3 bucket for Terraform state storage
# Implements: Secure and versioned state storage for infrastructure management
resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project_name}-${var.environment}-terraform-state"

  # Prevent accidental deletion of state bucket
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-terraform-state"
    Environment = var.environment
  }
}

# Enable versioning for state bucket to maintain state history
# Implements: State version control for rollback capability
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable server-side encryption for state bucket
# Implements: Data security for state files at rest
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Create DynamoDB table for state locking
# Implements: Concurrent state access control
resource "aws_dynamodb_table" "terraform_state_lock" {
  name           = "${var.project_name}-${var.environment}-terraform-state-lock"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-terraform-state-lock"
    Environment = var.environment
  }
}

# Configure Terraform backend to use S3 and DynamoDB
# Implements: State management configuration for team collaboration
terraform {
  backend "s3" {
    # Bucket and DynamoDB table names will be configured during initialization
    # using -backend-config options to support multiple environments
    key            = "terraform.tfstate"
    encrypt        = true
    
    # Enable DynamoDB state locking
    dynamodb_table = "terraform_state_lock"
    
    # Additional backend configuration
    acl            = "private"
    
    # Configure backend to use the same region as the provider
    region         = var.aws_region
  }
}

# Configure bucket public access blocking for security
# Implements: Security measures for state storage
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Configure bucket lifecycle rules for state management
# Implements: State file lifecycle management
resource "aws_s3_bucket_lifecycle_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    id     = "state-lifecycle"
    status = "Enabled"

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 60
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# Configure bucket replication for DR scenarios
# Implements: Disaster recovery for state files
resource "aws_s3_bucket_replication_configuration" {
  count = var.environment == "production" ? 1 : 0

  bucket = aws_s3_bucket.terraform_state.id
  role   = aws_iam_role.replication.arn

  rule {
    id     = "state-replication"
    status = "Enabled"

    destination {
      bucket        = "arn:aws:s3:::${var.project_name}-dr-terraform-state"
      storage_class = "STANDARD_IA"
    }
  }
}

# Configure bucket logging for audit purposes
# Implements: Security monitoring and audit compliance
resource "aws_s3_bucket_logging" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  target_bucket = "${var.project_name}-${var.environment}-logs"
  target_prefix = "terraform-state-logs/"
}