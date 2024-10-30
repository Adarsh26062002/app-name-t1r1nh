# Main Terraform Configuration for Test Automation Framework Infrastructure
# AWS Provider Version: >= 3.0
# Purpose: Orchestrates the setup and management of AWS infrastructure components

# Configure Terraform settings and required providers
terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 3.0"
    }
  }
}

# Import provider configuration
provider "aws" {
  region = var.aws_region
}

# Define local variables for resource naming and tagging
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  # Environment-specific configurations
  is_production = var.environment == "production"
  is_dr         = var.environment == "dr"
  
  # Resource naming convention
  name_prefix = "${var.project_name}-${var.environment}"
}

# VPC and Network Configuration
# Implements: Network isolation and security requirements
module "vpc" {
  source = "./vpc"
  
  project_name         = var.project_name
  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  public_subnet_cidrs = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  aws_region         = var.aws_region
  
  tags = local.common_tags
}

# RDS Database Configuration
# Implements: Persistent storage for test data and results
module "rds" {
  source = "./rds"
  
  project_name    = var.project_name
  environment    = var.environment
  vpc_id        = module.vpc.vpc_id
  subnet_ids    = module.vpc.private_subnet_ids
  
  db_instance_class = var.db_instance_class
  db_storage_size  = var.db_storage_size
  db_multi_az      = local.is_production
  db_backup_retention_period = local.is_production ? 30 : 7
  
  tags = local.common_tags
  
  depends_on = [module.vpc]
}

# ECS Cluster and Services Configuration
# Implements: Container orchestration for test execution
module "ecs" {
  source = "./ecs"
  
  project_name       = var.project_name
  environment       = var.environment
  vpc_id           = module.vpc.vpc_id
  subnet_ids       = module.vpc.private_subnet_ids
  
  ecs_task_cpu     = var.ecs_task_cpu
  ecs_task_memory  = var.ecs_task_memory
  ecs_desired_count = var.ecs_desired_count
  ecs_max_capacity = var.ecs_max_capacity
  
  container_insights = local.is_production
  
  tags = local.common_tags
  
  depends_on = [module.vpc, module.rds]
}

# Monitoring and Alerting Configuration
# Implements: Infrastructure monitoring and alerting
module "monitoring" {
  source = "./monitoring"
  
  project_name    = var.project_name
  environment    = var.environment
  
  # Resource references for monitoring
  vpc_id         = module.vpc.vpc_id
  rds_instances  = module.rds.db_instances
  ecs_cluster    = module.ecs.cluster_arn
  
  # Alert configurations
  enable_alerts  = true
  alert_endpoints = var.alert_endpoints
  
  tags = local.common_tags
  
  depends_on = [module.vpc, module.rds, module.ecs]
}

# Backend State Configuration
# Implements: Terraform state management
module "backend" {
  source = "./backend"
  
  project_name = var.project_name
  environment = var.environment
  
  # Enable replication for production environment
  enable_replication = local.is_production
  
  tags = local.common_tags
}

# Output the created infrastructure resources
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "ecs_cluster_id" {
  description = "The ID of the ECS cluster"
  value       = module.ecs.cluster_id
}

output "rds_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "cloudwatch_log_group" {
  description = "The CloudWatch log group for application logs"
  value       = module.monitoring.log_group_name
}

# Data source for AWS account ID
data "aws_caller_identity" "current" {}

# Data source for AWS region
data "aws_region" "current" {}

# Validate environment name
resource "null_resource" "validate_environment" {
  count = contains(["development", "staging", "production", "dr"], var.environment) ? 0 : "Environment must be one of: development, staging, production, dr"
}

# Configure default KMS key for encryption
resource "aws_kms_key" "main" {
  description             = "${local.name_prefix}-encryption-key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  
  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-encryption-key"
    }
  )
}

# Configure AWS Backup for critical resources
resource "aws_backup_vault" "main" {
  count = local.is_production ? 1 : 0
  name  = "${local.name_prefix}-backup-vault"
  kms_key_arn = aws_kms_key.main.arn
  
  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-backup-vault"
    }
  )
}

resource "aws_backup_plan" "main" {
  count = local.is_production ? 1 : 0
  name  = "${local.name_prefix}-backup-plan"

  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.main[0].name
    schedule          = "cron(0 5 ? * * *)"
    
    lifecycle {
      delete_after = 30
    }
  }
  
  tags = local.common_tags
}

# Configure AWS Config for resource compliance
resource "aws_config_configuration_recorder" "main" {
  count = local.is_production ? 1 : 0
  name  = "${local.name_prefix}-config-recorder"
  
  recording_group {
    all_supported = true
    include_global_resources = true
  }
  
  role_arn = aws_iam_role.config_role[0].arn
}

resource "aws_iam_role" "config_role" {
  count = local.is_production ? 1 : 0
  name  = "${local.name_prefix}-config-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

# Configure AWS Systems Manager for resource management
resource "aws_ssm_parameter" "environment_config" {
  name  = "/${var.project_name}/${var.environment}/config"
  type  = "SecureString"
  value = jsonencode({
    vpc_id         = module.vpc.vpc_id
    ecs_cluster_id = module.ecs.cluster_id
    rds_endpoint   = module.rds.db_endpoint
  })
  
  tags = local.common_tags
}

# Configure resource access policies
resource "aws_iam_policy" "resource_access" {
  name        = "${local.name_prefix}-resource-access"
  description = "Policy for accessing ${var.environment} environment resources"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeClusters",
          "ecs:ListServices",
          "rds:DescribeDBInstances",
          "cloudwatch:GetMetricData"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion": var.aws_region
          }
        }
      }
    ]
  })
}