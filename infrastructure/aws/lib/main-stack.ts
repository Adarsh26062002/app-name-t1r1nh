// AWS CDK Library v2.88.0
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs'; // v10.2.69
import * as ec2 from 'aws-cdk-lib/aws-ec2'; // v2.88.0
import * as ecs from 'aws-cdk-lib/aws-ecs'; // v2.88.0
import * as rds from 'aws-cdk-lib/aws-rds'; // v2.88.0
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'; // v2.88.0
import { NetworkStack } from './network-stack';

// Global constants from specification
const STACK_NAME = 'TestFrameworkStack';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

/**
 * MainStack class for orchestrating AWS infrastructure deployment
 * Implements requirements from system_architecture.deployment_architecture
 */
export class MainStack extends cdk.Stack {
  public readonly networkStack: NetworkStack;
  public readonly stackOutputs: cdk.CfnOutput[];
  public readonly vpc: ec2.IVpc;
  public readonly ecsSecurityGroup: ec2.ISecurityGroup;
  public readonly rdsSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      ...props,
      description: 'Main stack for Test Framework infrastructure',
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
      },
      tags: {
        Environment: ENVIRONMENT,
        Project: STACK_NAME,
        ManagedBy: 'AWS-CDK',
      },
    });

    // Initialize NetworkStack for base infrastructure
    // Implements requirements from system_architecture.component_dependencies
    this.networkStack = new NetworkStack(this, 'NetworkStack', {
      env: props?.env,
    });

    // Store references to network resources
    this.vpc = this.networkStack.vpc;
    this.ecsSecurityGroup = this.networkStack.ecsSecurityGroup;
    this.rdsSecurityGroup = this.networkStack.rdsSecurityGroup;

    // Create stack outputs
    this.createStackOutputs();

    // Configure stack dependencies
    this.configureStackDependencies();

    // Set up monitoring configurations
    this.setupMonitoring();
  }

  /**
   * Creates and exports stack outputs for network resources
   * Implements requirements from system_architecture.deployment_architecture
   */
  private createStackOutputs(): void {
    // VPC Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${STACK_NAME}-vpc-id`,
    });

    new cdk.CfnOutput(this, 'VpcArn', {
      value: this.vpc.vpcArn,
      description: 'VPC ARN',
      exportName: `${STACK_NAME}-vpc-arn`,
    });

    // Subnet Outputs
    this.networkStack.publicSubnets.forEach((subnet, index) => {
      new cdk.CfnOutput(this, `PublicSubnet${index + 1}Id`, {
        value: subnet.subnetId,
        description: `Public Subnet ${index + 1} ID`,
        exportName: `${STACK_NAME}-public-subnet-${index + 1}`,
      });
    });

    this.networkStack.privateAppSubnets.forEach((subnet, index) => {
      new cdk.CfnOutput(this, `PrivateAppSubnet${index + 1}Id`, {
        value: subnet.subnetId,
        description: `Private App Subnet ${index + 1} ID`,
        exportName: `${STACK_NAME}-private-app-subnet-${index + 1}`,
      });
    });

    this.networkStack.privateDbSubnets.forEach((subnet, index) => {
      new cdk.CfnOutput(this, `PrivateDbSubnet${index + 1}Id`, {
        value: subnet.subnetId,
        description: `Private DB Subnet ${index + 1} ID`,
        exportName: `${STACK_NAME}-private-db-subnet-${index + 1}`,
      });
    });

    // Security Group Outputs
    new cdk.CfnOutput(this, 'EcsSecurityGroupId', {
      value: this.ecsSecurityGroup.securityGroupId,
      description: 'ECS Security Group ID',
      exportName: `${STACK_NAME}-ecs-sg-id`,
    });

    new cdk.CfnOutput(this, 'RdsSecurityGroupId', {
      value: this.rdsSecurityGroup.securityGroupId,
      description: 'RDS Security Group ID',
      exportName: `${STACK_NAME}-rds-sg-id`,
    });
  }

  /**
   * Configures dependencies between different stacks
   * Implements requirements from system_architecture.component_dependencies
   */
  private configureStackDependencies(): void {
    // Add explicit dependencies on NetworkStack
    this.addDependency(this.networkStack);

    // Add dependency conditions for cross-stack references
    const vpcAvailable = new cdk.CfnCondition(this, 'VpcAvailable', {
      expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(this.vpc.vpcId, '')),
    });

    const securityGroupsAvailable = new cdk.CfnCondition(this, 'SecurityGroupsAvailable', {
      expression: cdk.Fn.conditionAnd(
        cdk.Fn.conditionNot(cdk.Fn.conditionEquals(this.ecsSecurityGroup.securityGroupId, '')),
        cdk.Fn.conditionNot(cdk.Fn.conditionEquals(this.rdsSecurityGroup.securityGroupId, ''))
      ),
    });

    // Add conditions to relevant resources
    Object.values(this.node.findAll()).forEach(node => {
      if (node instanceof cdk.CfnResource) {
        node.cfnOptions.condition = cdk.Fn.conditionAnd(vpcAvailable, securityGroupsAvailable);
      }
    });
  }

  /**
   * Sets up monitoring configurations for the stack
   * Implements requirements from infrastructure.infrastructure_monitoring
   */
  private setupMonitoring(): void {
    // Create CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'TestFrameworkDashboard', {
      dashboardName: `${STACK_NAME}-${ENVIRONMENT}-dashboard`,
    });

    // Add VPC Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'VPC Network Traffic',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/VPC',
            metricName: 'BytesIn',
            dimensionsMap: { VpcId: this.vpc.vpcId },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/VPC',
            metricName: 'BytesOut',
            dimensionsMap: { VpcId: this.vpc.vpcId },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
      })
    );

    // Set up CloudWatch Alarms
    new cloudwatch.Alarm(this, 'VpcFlowLogsAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/VPC',
        metricName: 'RejectedConnectionCount',
        dimensionsMap: { VpcId: this.vpc.vpcId },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 100,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Alert on high number of rejected VPC connections',
    });
  }
}