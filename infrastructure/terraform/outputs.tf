# Terraform Outputs Configuration
# AWS Provider Version: >= 3.0
# Purpose: Defines output values for infrastructure verification, integration, and monitoring

# Network Outputs
output "vpc_id" {
  description = "The ID of the VPC where resources are deployed"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for internal resources"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for internet-facing resources"
  value       = module.vpc.public_subnet_ids
}

# ECS Cluster Outputs
output "ecs_cluster_id" {
  description = "The ID of the ECS cluster for container orchestration"
  value       = module.ecs.cluster_id
}

output "ecs_service_name" {
  description = "The name of the ECS service running the test automation containers"
  value       = module.ecs.service_name
}

output "ecs_task_definition_arn" {
  description = "ARN of the ECS task definition for test automation"
  value       = module.ecs.task_definition_arn
}

# Database Outputs
output "db_instance_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "db_instance_address" {
  description = "The hostname of the RDS instance"
  value       = module.rds.db_address
}

output "db_instance_port" {
  description = "The port number the RDS instance is listening on"
  value       = module.rds.db_port
}

# Monitoring Outputs
output "cloudwatch_dashboard_url" {
  description = "URL of the CloudWatch dashboard for infrastructure monitoring"
  value       = module.monitoring.dashboard_url
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for application logs"
  value       = module.monitoring.log_group_name
}

output "cloudwatch_alarm_arns" {
  description = "List of ARNs for CloudWatch alarms monitoring critical metrics"
  value       = module.monitoring.alarm_arns
}

# Environment Information
output "environment_name" {
  description = "Name of the current deployment environment"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region where the infrastructure is deployed"
  value       = var.aws_region
}

# Add sensitive flag to outputs containing potentially sensitive information
locals {
  sensitive_outputs = {
    db_instance_endpoint = true
    cloudwatch_alarm_arns = true
  }
}

# Validation to ensure environment-specific outputs are consistent
resource "null_resource" "output_validation" {
  lifecycle {
    precondition {
      condition     = var.environment != "" && contains(["development", "staging", "production", "dr"], var.environment)
      error_message = "Environment must be one of: development, staging, production, dr"
    }
  }
}

# Add descriptions to outputs for better documentation
locals {
  output_descriptions = {
    vpc_id                   = "VPC ID for network isolation and security",
    private_subnet_ids       = "Private subnet IDs for internal resources",
    public_subnet_ids        = "Public subnet IDs for internet-facing resources",
    ecs_cluster_id          = "ECS cluster ID for container orchestration",
    ecs_service_name        = "ECS service name for test automation",
    ecs_task_definition_arn = "ECS task definition ARN for container configuration",
    db_instance_endpoint    = "RDS instance endpoint for database connections",
    db_instance_address     = "RDS instance hostname for DNS resolution",
    db_instance_port        = "RDS instance port for database access",
    cloudwatch_dashboard_url = "CloudWatch dashboard URL for monitoring",
    cloudwatch_log_group_name = "CloudWatch log group for application logs",
    cloudwatch_alarm_arns    = "CloudWatch alarm ARNs for notifications",
    environment_name        = "Current deployment environment name",
    aws_region             = "AWS region of deployment"
  }
}