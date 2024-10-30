# AWS ECS Configuration for Test Automation Framework
# AWS Provider Version >= 3.0

# ECS Cluster
# Implements: Container orchestration for test framework components
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = var.ecs_container_insights ? "enabled" : "disabled"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-cluster"
    }
  )
}

# ECS Task Execution Role
# Implements: IAM permissions for ECS tasks
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-${var.environment}-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Attach AWS managed policy for ECS task execution
resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Task Role
# Implements: IAM permissions for container applications
resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-${var.environment}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Security Group for ECS Tasks
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.project_name}-${var.environment}-ecs-tasks-"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-ecs-tasks-sg"
    }
  )
}

# Test Runner Task Definition
# Implements: Container configuration for test execution
resource "aws_ecs_task_definition" "test_runner" {
  family                   = "${var.project_name}-${var.environment}-test-runner"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = var.ecs_task_cpu
  memory                  = var.ecs_task_memory
  execution_role_arn      = aws_iam_role.ecs_task_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "test-runner"
      image = "${var.project_name}/test-runner:latest"
      cpu   = var.ecs_task_cpu
      memory = var.ecs_task_memory
      essential = true
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.project_name}-${var.environment}/test-runner"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "test-runner"
        }
      }
      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        }
      ]
    }
  ])

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-test-runner"
    }
  )
}

# Report Generator Task Definition
# Implements: Container configuration for report generation
resource "aws_ecs_task_definition" "report_generator" {
  family                   = "${var.project_name}-${var.environment}-report-generator"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = var.ecs_task_cpu
  memory                  = var.ecs_task_memory
  execution_role_arn      = aws_iam_role.ecs_task_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "report-generator"
      image = "${var.project_name}/report-generator:latest"
      cpu   = var.ecs_task_cpu
      memory = var.ecs_task_memory
      essential = true
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.project_name}-${var.environment}/report-generator"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "report-generator"
        }
      }
      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        }
      ]
    }
  ])

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-report-generator"
    }
  )
}

# Test Runner Service
# Implements: Long-running service for test execution
resource "aws_ecs_service" "test_runner" {
  name            = "${var.project_name}-${var.environment}-test-runner"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.test_runner.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-test-runner-service"
    }
  )
}

# Report Generator Service
# Implements: Long-running service for report generation
resource "aws_ecs_service" "report_generator" {
  name            = "${var.project_name}-${var.environment}-report-generator"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.report_generator.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-report-generator-service"
    }
  )
}

# Auto Scaling Target for Test Runner
# Implements: Scalability for test execution service
resource "aws_appautoscaling_target" "test_runner" {
  max_capacity       = var.ecs_max_capacity
  min_capacity       = var.ecs_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.test_runner.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Auto Scaling Target for Report Generator
# Implements: Scalability for report generation service
resource "aws_appautoscaling_target" "report_generator" {
  max_capacity       = var.ecs_max_capacity
  min_capacity       = var.ecs_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.report_generator.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# CloudWatch Log Groups for ECS Services
resource "aws_cloudwatch_log_group" "test_runner" {
  name              = "/ecs/${var.project_name}-${var.environment}/test-runner"
  retention_in_days = 30

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-test-runner-logs"
    }
  )
}

resource "aws_cloudwatch_log_group" "report_generator" {
  name              = "/ecs/${var.project_name}-${var.environment}/report-generator"
  retention_in_days = 30

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-report-generator-logs"
    }
  )
}