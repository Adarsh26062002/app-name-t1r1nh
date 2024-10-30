# AWS RDS Configuration for Test Automation Framework
# Provider Version: hashicorp/aws >= 3.0

# DB Subnet Group for RDS instances
# Implements: Network isolation for database instances
resource "aws_db_subnet_group" "db_subnet_group" {
  name        = "${var.environment}-db-subnet-group"
  description = "Subnet group for ${var.environment} RDS instances"
  subnet_ids  = data.aws_subnets.private.ids

  tags = merge(var.tags, {
    Name = "${var.environment}-db-subnet-group"
  })
}

# PostgreSQL Parameter Group
# Implements: Database configuration optimization for test automation workloads
resource "aws_db_parameter_group" "db_parameter_group" {
  name        = "${var.environment}-postgresql13-params"
  family      = "postgres13"
  description = "Custom parameter group for ${var.environment} PostgreSQL 13"

  # Optimize for test automation workload
  parameter {
    name  = "max_connections"
    value = "200"
  }

  parameter {
    name  = "shared_buffers"
    value = "2097152"  # 2GB
  }

  parameter {
    name  = "work_mem"
    value = "32768"    # 32MB
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "262144"   # 256MB
  }

  parameter {
    name  = "effective_cache_size"
    value = "6291456"  # 6GB
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-postgresql13-params"
  })
}

# Events Database Instance
# Implements: Test results storage requirements from system_design.database_design.results_storage
resource "aws_db_instance" "events_db_instance" {
  identifier = "${var.environment}-events-db"
  
  # Engine Configuration
  engine                = "postgres"
  engine_version        = "13.7"
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_storage_size
  storage_type          = "gp3"
  storage_encrypted     = true

  # Database Configuration
  db_name  = "events_db"
  username = "events_admin"
  password = data.aws_secretsmanager_secret_version.events_db_password.secret_string
  port     = 5432

  # Network Configuration
  db_subnet_group_name   = aws_db_subnet_group.db_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  publicly_accessible    = false

  # High Availability Configuration
  multi_az               = var.db_multi_az
  availability_zone      = var.db_multi_az ? null : data.aws_availability_zones.available.names[0]

  # Backup Configuration
  backup_retention_period = var.db_backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # Parameter Group
  parameter_group_name = aws_db_parameter_group.db_parameter_group.name

  # Enhanced Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring_role.arn

  # Auto Minor Version Upgrade
  auto_minor_version_upgrade = true

  # Deletion Protection
  deletion_protection = var.environment == "production" ? true : false

  tags = merge(var.tags, {
    Name = "${var.environment}-events-db"
    DatabaseType = "events"
  })
}

# Inventory Database Instance
# Implements: Test data storage requirements from system_design.database_design.test_data_storage
resource "aws_db_instance" "inventory_db_instance" {
  identifier = "${var.environment}-inventory-db"
  
  # Engine Configuration
  engine                = "postgres"
  engine_version        = "13.7"
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_storage_size
  storage_type          = "gp3"
  storage_encrypted     = true

  # Database Configuration
  db_name  = "inventory_db"
  username = "inventory_admin"
  password = data.aws_secretsmanager_secret_version.inventory_db_password.secret_string
  port     = 5432

  # Network Configuration
  db_subnet_group_name   = aws_db_subnet_group.db_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  publicly_accessible    = false

  # High Availability Configuration
  multi_az               = var.db_multi_az
  availability_zone      = var.db_multi_az ? null : data.aws_availability_zones.available.names[0]

  # Backup Configuration
  backup_retention_period = var.db_backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # Parameter Group
  parameter_group_name = aws_db_parameter_group.db_parameter_group.name

  # Enhanced Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring_role.arn

  # Auto Minor Version Upgrade
  auto_minor_version_upgrade = true

  # Deletion Protection
  deletion_protection = var.environment == "production" ? true : false

  tags = merge(var.tags, {
    Name = "${var.environment}-inventory-db"
    DatabaseType = "inventory"
  })
}

# Security Group for RDS instances
resource "aws_security_group" "rds_sg" {
  name        = "${var.environment}-rds-security-group"
  description = "Security group for RDS instances"
  vpc_id      = data.aws_vpc.main.id

  # Allow inbound PostgreSQL traffic from private subnets
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    cidr_blocks     = data.aws_subnet.private[*].cidr_block
    description     = "PostgreSQL access from private subnets"
  }

  # Allow outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-rds-security-group"
  })
}

# IAM Role for RDS Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring_role" {
  name = "${var.environment}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.environment}-rds-monitoring-role"
  })
}

# Attach the AWS managed policy for RDS Enhanced Monitoring
resource "aws_iam_role_policy_attachment" "rds_monitoring_policy" {
  role       = aws_iam_role.rds_monitoring_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Data source for VPC information
data "aws_vpc" "main" {
  tags = {
    Environment = var.environment
  }
}

# Data source for private subnets
data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  tags = {
    Tier = "private"
  }
}

# Data source for available AZs
data "aws_availability_zones" "available" {
  state = "available"
}

# Data sources for database passwords from AWS Secrets Manager
data "aws_secretsmanager_secret_version" "events_db_password" {
  secret_id = "${var.environment}/rds/events-db/password"
}

data "aws_secretsmanager_secret_version" "inventory_db_password" {
  secret_id = "${var.environment}/rds/inventory-db/password"
}