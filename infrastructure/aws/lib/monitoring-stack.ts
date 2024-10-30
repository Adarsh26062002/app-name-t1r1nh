// AWS CDK Library v2.88.0
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs'; // v10.2.69
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'; // v2.88.0
import * as sns from 'aws-cdk-lib/aws-sns'; // v2.88.0
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions'; // v2.88.0
import { MainStack } from './main-stack';

// Default metrics for monitoring test framework components
const DEFAULT_METRICS = ['TestExecutionTime', 'TestSuccessRate', 'ResourceUtilization', 'DatabaseConnections', 'APILatency', 'ErrorRate'];

// Default thresholds for alerting
const DEFAULT_THRESHOLDS = {
  errorRateThreshold: 5,
  executionTimeThreshold: 300,
  resourceUtilizationThreshold: 80,
  apiLatencyThreshold: 2000
};

// Dashboard widget configurations
const DASHBOARD_WIDGETS = ['TestExecutionMetrics', 'ResourceUtilization', 'ErrorRates', 'APIPerformance'];

// Alarm configurations for different scenarios
const ALARM_CONFIGURATIONS = {
  highErrorRate: { threshold: 5, evaluationPeriods: 3 },
  highLatency: { threshold: 2000, evaluationPeriods: 2 }
};

// Dashboard refresh and layout configurations
const DASHBOARD_CONFIGURATIONS = {
  mainDashboard: {
    widgets: ['metrics', 'alarms', 'logs'],
    refreshInterval: 300
  }
};

/**
 * MonitoringStack class for implementing AWS CloudWatch monitoring infrastructure
 * Implements requirements from system_architecture.deployment_architecture
 */
export class MonitoringStack extends cdk.Stack {
  public readonly mainDashboard: cloudwatch.Dashboard;
  public readonly criticalAlertTopic: sns.Topic;
  public readonly warningAlertTopic: sns.Topic;
  private readonly metricWidgets: cloudwatch.MetricWidget[] = [];

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      ...props,
      description: 'CloudWatch monitoring stack for Test Framework',
    });

    // Create SNS topics for different alert severities
    this.criticalAlertTopic = new sns.Topic(this, 'CriticalAlertTopic', {
      displayName: 'Test Framework Critical Alerts',
      topicName: 'test-framework-critical-alerts'
    });

    this.warningAlertTopic = new sns.Topic(this, 'WarningAlertTopic', {
      displayName: 'Test Framework Warning Alerts',
      topicName: 'test-framework-warning-alerts'
    });

    // Create main CloudWatch dashboard
    this.mainDashboard = new cloudwatch.Dashboard(this, 'TestFrameworkDashboard', {
      dashboardName: 'test-framework-monitoring',
      periodOverride: cloudwatch.PeriodOverride.AUTO,
      start: '-P1D' // Default to last 24 hours
    });

    // Create dashboard widgets
    this.createDashboardWidgets(DASHBOARD_CONFIGURATIONS.mainDashboard);

    // Configure alarms
    this.configureAlarms(ALARM_CONFIGURATIONS);
  }

  /**
   * Creates CloudWatch dashboard widgets for different metrics
   * Implements requirements from infrastructure.infrastructure_monitoring
   */
  private createDashboardWidgets(widgetConfig: any): cloudwatch.MetricWidget[] {
    // Test Execution Metrics Widget
    const executionMetricsWidget = new cloudwatch.GraphWidget({
      title: 'Test Execution Metrics',
      left: [
        new cloudwatch.Metric({
          namespace: 'TestFramework',
          metricName: 'TestExecutionTime',
          statistic: 'Average',
          period: cdk.Duration.minutes(5)
        }),
        new cloudwatch.Metric({
          namespace: 'TestFramework',
          metricName: 'TestSuccessRate',
          statistic: 'Average',
          period: cdk.Duration.minutes(5)
        })
      ],
      width: 12,
      height: 6
    });

    // Resource Utilization Widget
    const resourceUtilizationWidget = new cloudwatch.GraphWidget({
      title: 'Resource Utilization',
      left: [
        new cloudwatch.Metric({
          namespace: 'TestFramework',
          metricName: 'CPUUtilization',
          statistic: 'Average',
          period: cdk.Duration.minutes(5)
        }),
        new cloudwatch.Metric({
          namespace: 'TestFramework',
          metricName: 'MemoryUtilization',
          statistic: 'Average',
          period: cdk.Duration.minutes(5)
        })
      ],
      width: 12,
      height: 6
    });

    // API Performance Widget
    const apiPerformanceWidget = new cloudwatch.GraphWidget({
      title: 'API Performance',
      left: [
        new cloudwatch.Metric({
          namespace: 'TestFramework',
          metricName: 'APILatency',
          statistic: 'Average',
          period: cdk.Duration.minutes(1)
        }),
        new cloudwatch.Metric({
          namespace: 'TestFramework',
          metricName: 'APIErrorRate',
          statistic: 'Sum',
          period: cdk.Duration.minutes(1)
        })
      ],
      width: 12,
      height: 6
    });

    // Database Connections Widget
    const dbConnectionsWidget = new cloudwatch.GraphWidget({
      title: 'Database Connections',
      left: [
        new cloudwatch.Metric({
          namespace: 'TestFramework',
          metricName: 'DatabaseConnections',
          statistic: 'Average',
          period: cdk.Duration.minutes(5)
        }),
        new cloudwatch.Metric({
          namespace: 'TestFramework',
          metricName: 'DatabaseLatency',
          statistic: 'Average',
          period: cdk.Duration.minutes(5)
        })
      ],
      width: 12,
      height: 6
    });

    // Add widgets to dashboard
    this.mainDashboard.addWidgets(
      executionMetricsWidget,
      resourceUtilizationWidget,
      apiPerformanceWidget,
      dbConnectionsWidget
    );

    return [executionMetricsWidget, resourceUtilizationWidget, apiPerformanceWidget, dbConnectionsWidget];
  }

  /**
   * Configures CloudWatch alarms with thresholds and actions
   * Implements requirements from infrastructure.infrastructure_monitoring
   */
  private configureAlarms(alarmConfig: any): void {
    // High Error Rate Alarm
    const highErrorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'TestFramework',
        metricName: 'ErrorRate',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5)
      }),
      threshold: alarmConfig.highErrorRate.threshold,
      evaluationPeriods: alarmConfig.highErrorRate.evaluationPeriods,
      alarmDescription: 'Alert when error rate exceeds threshold',
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // High API Latency Alarm
    const highLatencyAlarm = new cloudwatch.Alarm(this, 'HighLatencyAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'TestFramework',
        metricName: 'APILatency',
        statistic: 'Average',
        period: cdk.Duration.minutes(1)
      }),
      threshold: alarmConfig.highLatency.threshold,
      evaluationPeriods: alarmConfig.highLatency.evaluationPeriods,
      alarmDescription: 'Alert when API latency exceeds threshold',
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // Resource Utilization Alarm
    const highResourceUtilizationAlarm = new cloudwatch.Alarm(this, 'HighResourceUtilizationAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'TestFramework',
        metricName: 'ResourceUtilization',
        statistic: 'Average',
        period: cdk.Duration.minutes(5)
      }),
      threshold: DEFAULT_THRESHOLDS.resourceUtilizationThreshold,
      evaluationPeriods: 3,
      alarmDescription: 'Alert when resource utilization is high',
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // Configure alarm actions
    highErrorRateAlarm.addAlarmAction(new actions.SnsAction(this.criticalAlertTopic));
    highLatencyAlarm.addAlarmAction(new actions.SnsAction(this.warningAlertTopic));
    highResourceUtilizationAlarm.addAlarmAction(new actions.SnsAction(this.warningAlertTopic));
  }
}