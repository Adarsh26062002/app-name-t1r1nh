# AWS Provider Configuration Variables
# AWS Provider Version >= 3.0
variable "aws_region" {
  description = "Primary AWS region for infrastructure deployment"
  type        = string
  default     = "us-west-2"  # Default region for primary deployment
}

variable "aws_secondary_region" {
  description = "Secondary AWS region for disaster recovery"
  type        = string
  default     = "us-east-1"  # Default region for DR setup
}

# Environment Configuration
variable "environment" {
  description = "Deployment environment (development, staging, production, dr)"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production", "dr"], var.environment)
    error_message = "Environment must be one of: development, staging, production, dr"
  }
}

variable "project_name" {
  description = "Name of the project for resource tagging and identification"
  type        = string
  default     = "test-automation-framework"
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets across availability zones"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets across availability zones"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

# RDS Configuration
variable "db_instance_class" {
  description = "Instance class for RDS PostgreSQL database"
  type        = string
  default     = "db.t3.medium"
}

variable "db_storage_size" {
  description = "Allocated storage size in GB for RDS instance"
  type        = number
  default     = 20
}

variable "db_backup_retention_period" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = true
}

# ECS Configuration
variable "ecs_container_insights" {
  description = "Enable CloudWatch Container Insights for ECS"
  type        = bool
  default     = true
}

variable "ecs_task_cpu" {
  description = "CPU units for ECS tasks (1 vCPU = 1024 CPU units)"
  type        = number
  default     = 256
}

variable "ecs_task_memory" {
  description = "Memory (in MiB) for ECS tasks"
  type        = number
  default     = 512
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks running"
  type        = number
  default     = 2
}

variable "ecs_max_capacity" {
  description = "Maximum number of ECS tasks for auto-scaling"
  type        = number
  default     = 4
}

# Monitoring Configuration
variable "cloudwatch_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
}

variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring and alerting"
  type        = bool
  default     = true
}

# Resource Tagging
variable "tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default = {
    Project     = "test-automation-framework"
    Terraform   = "true"
    Environment = "production"
  }
}