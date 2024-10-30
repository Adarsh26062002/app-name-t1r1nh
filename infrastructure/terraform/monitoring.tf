# AWS CloudWatch Monitoring Configuration for Test Automation Framework
# AWS Provider Version: >= 3.0

# SNS Topics for Alerting
resource "aws_sns_topic" "alerts" {
  count = var.enable_monitoring ? 1 : 0
  name  = "${var.project_name}-${var.environment}-alerts"

  tags = {
    Name        = "${var.project_name}-${var.environment}-alerts"
    Environment = var.environment
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "test_runners" {
  count             = var.enable_monitoring ? 1 : 0
  name              = "/aws/ecs/${var.project_name}-${var.environment}/test-runners"
  retention_in_days = var.cloudwatch_retention_days

  tags = {
    Name        = "${var.project_name}-test-runners-logs"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "api_integration" {
  count             = var.enable_monitoring ? 1 : 0
  name              = "/aws/ecs/${var.project_name}-${var.environment}/api-integration"
  retention_in_days = var.cloudwatch_retention_days

  tags = {
    Name        = "${var.project_name}-api-integration-logs"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "database" {
  count             = var.enable_monitoring ? 1 : 0
  name              = "/aws/rds/${var.project_name}-${var.environment}"
  retention_in_days = var.cloudwatch_retention_days

  tags = {
    Name        = "${var.project_name}-database-logs"
    Environment = var.environment
  }
}

# Metric Filters
resource "aws_cloudwatch_log_metric_filter" "api_errors" {
  count          = var.enable_monitoring ? 1 : 0
  name           = "api-integration-errors"
  pattern        = "[timestamp, requestId, errorType, errorMessage]"
  log_group_name = aws_cloudwatch_log_group.api_integration[0].name

  metric_transformation {
    name          = "APIErrorCount"
    namespace     = "${var.project_name}/${var.environment}"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "test_failures" {
  count          = var.enable_monitoring ? 1 : 0
  name           = "test-execution-failures"
  pattern        = "[timestamp, testId, status=FAILED]"
  log_group_name = aws_cloudwatch_log_group.test_runners[0].name

  metric_transformation {
    name          = "TestFailureCount"
    namespace     = "${var.project_name}/${var.environment}"
    value         = "1"
    default_value = "0"
  }
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "api_error_rate" {
  count               = var.enable_monitoring ? 1 : 0
  alarm_name          = "${var.project_name}-${var.environment}-api-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "APIErrorCount"
  namespace           = "${var.project_name}/${var.environment}"
  period             = "300"
  statistic          = "Sum"
  threshold          = "10"
  alarm_description  = "API Integration error rate exceeded threshold"
  alarm_actions      = [aws_sns_topic.alerts[0].arn]

  tags = {
    Name        = "${var.project_name}-api-error-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "test_failure_rate" {
  count               = var.enable_monitoring ? 1 : 0
  alarm_name          = "${var.project_name}-${var.environment}-test-failure-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TestFailureCount"
  namespace           = "${var.project_name}/${var.environment}"
  period             = "300"
  statistic          = "Sum"
  threshold          = "5"
  alarm_description  = "Test execution failure rate exceeded threshold"
  alarm_actions      = [aws_sns_topic.alerts[0].arn]

  tags = {
    Name        = "${var.project_name}-test-failure-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  count               = var.enable_monitoring ? 1 : 0
  alarm_name          = "${var.project_name}-${var.environment}-db-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period             = "300"
  statistic          = "Average"
  threshold          = "100"
  alarm_description  = "Database connection count exceeded threshold"
  alarm_actions      = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    DBInstanceIdentifier = "${var.project_name}-${var.environment}"
  }

  tags = {
    Name        = "${var.project_name}-db-connections-alarm"
    Environment = var.environment
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  count          = var.enable_monitoring ? 1 : 0
  dashboard_name = "${var.project_name}-${var.environment}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["${var.project_name}/${var.environment}", "APIErrorCount", { "stat": "Sum" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Integration Errors"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["${var.project_name}/${var.environment}", "TestFailureCount", { "stat": "Sum" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Test Execution Failures"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", "${var.project_name}-${var.environment}"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Database Connections"
        }
      },
      {
        type   = "log"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          query   = "SOURCE '${aws_cloudwatch_log_group.test_runners[0].name}' | fields @timestamp, @message | sort @timestamp desc | limit 100"
          region  = var.aws_region
          title   = "Recent Test Runner Logs"
          view    = "table"
        }
      }
    ]
  })
}

# CloudWatch Composite Alarms
resource "aws_cloudwatch_composite_alarm" "system_health" {
  count             = var.enable_monitoring ? 1 : 0
  alarm_name        = "${var.project_name}-${var.environment}-system-health"
  alarm_description = "Composite alarm for overall system health"

  alarm_rule = "ALARM(${aws_cloudwatch_metric_alarm.api_error_rate[0].alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.test_failure_rate[0].alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.database_connections[0].alarm_name})"

  alarm_actions = [aws_sns_topic.alerts[0].arn]

  tags = {
    Name        = "${var.project_name}-system-health-alarm"
    Environment = var.environment
  }
}