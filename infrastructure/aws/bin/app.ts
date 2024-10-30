// AWS CDK Library v2.88.0
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs'; // v10.2.69

// Import stack definitions
import { MainStack } from '../lib/main-stack';
import { EcsStack } from '../lib/ecs-stack';
import { RdsStack } from '../lib/rds-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

// Global constants from specification
const APP_NAME = 'TestFrameworkInfrastructure';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

/**
 * Initializes and configures the AWS CDK application with all required infrastructure stacks
 * Implements requirements from:
 * - system_architecture.deployment_architecture
 * - system_architecture.component_dependencies
 */
function initializeApp(): cdk.App {
  const app = new cdk.App();

  // Environment configuration
  const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  };

  // Stack configuration
  const stackConfig: cdk.StackProps = {
    env,
    description: 'Test Framework Infrastructure Stack',
    tags: {
      Project: APP_NAME,
      Environment: ENVIRONMENT,
      ManagedBy: 'AWS-CDK',
    },
  };

  // Initialize MainStack with network infrastructure
  // Implements system_architecture.high-level_architecture_overview
  const mainStack = new MainStack(app, `${APP_NAME}-Main`, stackConfig);

  // Initialize RDS stack with database instances
  // Implements system_architecture.database_integration_layer
  const rdsStack = new RdsStack(app, `${APP_NAME}-RDS`, mainStack, {
    ...stackConfig,
    description: 'Test Framework RDS Infrastructure',
  });

  // Add explicit dependency on MainStack for networking resources
  rdsStack.addDependency(mainStack);

  // Initialize ECS stack with container services
  // Implements system_architecture.deployment_architecture
  const ecsStack = new EcsStack(app, `${APP_NAME}-ECS`, mainStack, rdsStack, monitoringStack, {
    ...stackConfig,
    description: 'Test Framework ECS Infrastructure',
  });

  // Add dependencies for proper deployment order
  ecsStack.addDependency(mainStack);
  ecsStack.addDependency(rdsStack);

  // Initialize monitoring stack with CloudWatch resources
  // Implements infrastructure.infrastructure_monitoring
  const monitoringStack = new MonitoringStack(app, `${APP_NAME}-Monitoring`, {
    ...stackConfig,
    description: 'Test Framework Monitoring Infrastructure',
  });

  // Add dependencies for monitoring resources
  monitoringStack.addDependency(mainStack);
  monitoringStack.addDependency(ecsStack);
  monitoringStack.addDependency(rdsStack);

  // Configure cross-stack references
  configureCrossStackReferences(mainStack, ecsStack, rdsStack, monitoringStack);

  return app;
}

/**
 * Configures cross-stack references and dependencies between infrastructure components
 * Implements requirements from system_architecture.component_dependencies
 */
function configureCrossStackReferences(
  mainStack: MainStack,
  ecsStack: EcsStack,
  rdsStack: RdsStack,
  monitoringStack: MonitoringStack
): void {
  // Export VPC and security group references
  new cdk.CfnOutput(mainStack, 'VpcId', {
    value: mainStack.vpc.vpcId,
    description: 'VPC ID for Test Framework infrastructure',
    exportName: `${APP_NAME}-vpc-id`,
  });

  // Export ECS cluster reference
  new cdk.CfnOutput(ecsStack, 'EcsClusterId', {
    value: ecsStack.ecsCluster.clusterArn,
    description: 'ECS Cluster ARN for Test Framework services',
    exportName: `${APP_NAME}-ecs-cluster-arn`,
  });

  // Export RDS endpoint references
  new cdk.CfnOutput(rdsStack, 'EventsDbEndpoint', {
    value: rdsStack.eventsDb.instanceEndpoint.hostname,
    description: 'Events database endpoint',
    exportName: `${APP_NAME}-events-db-endpoint`,
  });

  new cdk.CfnOutput(rdsStack, 'InventoryDbEndpoint', {
    value: rdsStack.inventoryDb.instanceEndpoint.hostname,
    description: 'Inventory database endpoint',
    exportName: `${APP_NAME}-inventory-db-endpoint`,
  });

  // Export monitoring dashboard reference
  new cdk.CfnOutput(monitoringStack, 'MonitoringDashboardName', {
    value: monitoringStack.mainDashboard.dashboardName,
    description: 'CloudWatch dashboard name for Test Framework monitoring',
    exportName: `${APP_NAME}-dashboard-name`,
  });
}

// Initialize and export the CDK app instance
const app = initializeApp();
app.synth();

export default app;