// AWS CDK Library v2.88.0
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs'; // v10.2.69
import * as ec2 from 'aws-cdk-lib/aws-ec2'; // v2.88.0
import * as ecs from 'aws-cdk-lib/aws-ecs'; // v2.88.0
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns'; // v2.88.0
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery'; // v2.88.0
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'; // v2.88.0

// Import dependent stacks
import { MainStack } from './main-stack';
import { RdsStack } from './rds-stack';
import { MonitoringStack } from './monitoring-stack';

// Global constants from specification
const CONTAINER_PORT = 3000;
const CPU_UNITS = 512;
const MEMORY_LIMIT = 1024;
const MIN_CAPACITY = 1;
const MAX_CAPACITY = 10;
const AUTOSCALING_TARGET_CPU_UTILIZATION = 70;

/**
 * EcsStack class for deploying containerized test framework components
 * Implements requirements from system_architecture.deployment_architecture
 */
export class EcsStack extends cdk.Stack {
  public readonly ecsCluster: ecs.Cluster;
  public readonly testFrameworkService: ecs_patterns.ApplicationLoadBalancedFargateService;
  private readonly vpc: ec2.IVpc;
  private readonly securityGroup: ec2.ISecurityGroup;

  constructor(
    scope: Construct,
    id: string,
    mainStack: MainStack,
    rdsStack: RdsStack,
    monitoringStack: MonitoringStack,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    // Import VPC and security group from MainStack
    this.vpc = mainStack.vpc;
    this.securityGroup = mainStack.ecsSecurityGroup;

    // Create ECS cluster
    this.ecsCluster = this.createEcsCluster('TestFrameworkCluster', this.vpc, this.securityGroup);

    // Create service discovery namespace
    const namespace = new servicediscovery.PrivateDnsNamespace(this, 'ServiceDiscovery', {
      name: 'testframework.local',
      vpc: this.vpc,
      description: 'Private namespace for test framework services'
    });

    // Create task definitions for each component
    const testGeneratorTask = this.createTaskDefinition('TestGenerator', {
      image: 'test-generator:latest',
      containerPort: CONTAINER_PORT,
      environment: {
        EVENTS_DB_HOST: rdsStack.eventsDb.instanceEndpoint.hostname,
        INVENTORY_DB_HOST: rdsStack.inventoryDb.instanceEndpoint.hostname,
        NODE_ENV: 'production'
      }
    });

    const testExecutorTask = this.createTaskDefinition('TestExecutor', {
      image: 'test-executor:latest',
      containerPort: CONTAINER_PORT,
      environment: {
        EVENTS_DB_HOST: rdsStack.eventsDb.instanceEndpoint.hostname,
        INVENTORY_DB_HOST: rdsStack.inventoryDb.instanceEndpoint.hostname,
        NODE_ENV: 'production'
      }
    });

    const testManagerTask = this.createTaskDefinition('TestManager', {
      image: 'test-manager:latest',
      containerPort: CONTAINER_PORT,
      environment: {
        EVENTS_DB_HOST: rdsStack.eventsDb.instanceEndpoint.hostname,
        INVENTORY_DB_HOST: rdsStack.inventoryDb.instanceEndpoint.hostname,
        NODE_ENV: 'production'
      }
    });

    // Deploy services with load balancing and auto-scaling
    this.testFrameworkService = this.createFargateService('TestFramework', testManagerTask, {
      desiredCount: MIN_CAPACITY,
      namespace: namespace,
      serviceName: 'test-manager',
      healthCheckPath: '/health'
    });

    const testGeneratorService = this.createFargateService('TestGenerator', testGeneratorTask, {
      desiredCount: MIN_CAPACITY,
      namespace: namespace,
      serviceName: 'test-generator',
      healthCheckPath: '/health'
    });

    const testExecutorService = this.createFargateService('TestExecutor', testExecutorTask, {
      desiredCount: MIN_CAPACITY,
      namespace: namespace,
      serviceName: 'test-executor',
      healthCheckPath: '/health'
    });

    // Configure auto-scaling for each service
    this.configureAutoScaling(this.testFrameworkService, {
      minCapacity: MIN_CAPACITY,
      maxCapacity: MAX_CAPACITY,
      targetCpuUtilization: AUTOSCALING_TARGET_CPU_UTILIZATION
    });

    this.configureAutoScaling(testGeneratorService, {
      minCapacity: MIN_CAPACITY,
      maxCapacity: MAX_CAPACITY,
      targetCpuUtilization: AUTOSCALING_TARGET_CPU_UTILIZATION
    });

    this.configureAutoScaling(testExecutorService, {
      minCapacity: MIN_CAPACITY,
      maxCapacity: MAX_CAPACITY,
      targetCpuUtilization: AUTOSCALING_TARGET_CPU_UTILIZATION
    });

    // Add services to monitoring dashboard
    this.addServiceMonitoring(monitoringStack.mainDashboard, [
      this.testFrameworkService,
      testGeneratorService,
      testExecutorService
    ]);
  }

  /**
   * Creates an ECS cluster with Fargate capacity providers
   * Implements requirements from system_architecture.deployment_architecture
   */
  private createEcsCluster(
    clusterName: string,
    vpc: ec2.IVpc,
    securityGroup: ec2.ISecurityGroup
  ): ecs.Cluster {
    const cluster = new ecs.Cluster(this, clusterName, {
      vpc,
      containerInsights: true,
      enableFargateCapacityProviders: true
    });

    // Configure default capacity provider strategy
    cluster.addDefaultCapacityProviderStrategy([
      {
        capacityProvider: 'FARGATE',
        weight: 1,
        base: 1
      },
      {
        capacityProvider: 'FARGATE_SPOT',
        weight: 4
      }
    ]);

    return cluster;
  }

  /**
   * Creates a Fargate task definition for a service
   * Implements requirements from system_architecture.core_components
   */
  private createTaskDefinition(
    serviceName: string,
    containerConfig: {
      image: string;
      containerPort: number;
      environment: { [key: string]: string };
    }
  ): ecs.FargateTaskDefinition {
    const taskDefinition = new ecs.FargateTaskDefinition(this, `${serviceName}TaskDef`, {
      memoryLimitMiB: MEMORY_LIMIT,
      cpu: CPU_UNITS,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.X86_64
      }
    });

    taskDefinition.addContainer(`${serviceName}Container`, {
      image: ecs.ContainerImage.fromRegistry(containerConfig.image),
      memoryLimitMiB: MEMORY_LIMIT,
      cpu: CPU_UNITS,
      environment: containerConfig.environment,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: serviceName.toLowerCase(),
        logRetention: cdk.aws_logs.RetentionDays.ONE_MONTH
      }),
      portMappings: [{
        containerPort: containerConfig.containerPort,
        protocol: ecs.Protocol.TCP
      }],
      healthCheck: {
        command: ['CMD-SHELL', `curl -f http://localhost:${containerConfig.containerPort}/health || exit 1`],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60)
      }
    });

    return taskDefinition;
  }

  /**
   * Creates a Fargate service with load balancing and service discovery
   * Implements requirements from system_architecture.deployment_architecture
   */
  private createFargateService(
    serviceName: string,
    taskDefinition: ecs.FargateTaskDefinition,
    config: {
      desiredCount: number;
      namespace: servicediscovery.INamespace;
      serviceName: string;
      healthCheckPath: string;
    }
  ): ecs_patterns.ApplicationLoadBalancedFargateService {
    return new ecs_patterns.ApplicationLoadBalancedFargateService(this, `${serviceName}Service`, {
      cluster: this.ecsCluster,
      taskDefinition,
      desiredCount: config.desiredCount,
      publicLoadBalancer: true,
      assignPublicIp: true,
      cloudMapOptions: {
        name: config.serviceName,
        cloudMapNamespace: config.namespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: cdk.Duration.seconds(60)
      },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      targetProtocol: ecs.Protocol.TCP,
      listenerPort: 80,
      taskSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      },
      securityGroups: [this.securityGroup],
      circuitBreaker: {
        rollback: true
      }
    });
  }

  /**
   * Configures auto-scaling policies for Fargate services
   * Implements requirements from system_architecture.component_scalability
   */
  private configureAutoScaling(
    service: ecs_patterns.ApplicationLoadBalancedFargateService,
    config: {
      minCapacity: number;
      maxCapacity: number;
      targetCpuUtilization: number;
    }
  ): void {
    const scaling = service.service.autoScaleTaskCount({
      minCapacity: config.minCapacity,
      maxCapacity: config.maxCapacity
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: config.targetCpuUtilization,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });

    scaling.scaleOnRequestCount('RequestCountScaling', {
      requestsPerTarget: 1000,
      targetGroup: service.targetGroup,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });
  }

  /**
   * Adds service metrics to the monitoring dashboard
   * Implements requirements from infrastructure.infrastructure_monitoring
   */
  private addServiceMonitoring(
    dashboard: cloudwatch.Dashboard,
    services: ecs_patterns.ApplicationLoadBalancedFargateService[]
  ): void {
    services.forEach(service => {
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: `${service.service.serviceName} Metrics`,
          left: [
            service.service.metricCpuUtilization(),
            service.service.metricMemoryUtilization()
          ],
          width: 12
        }),
        new cloudwatch.GraphWidget({
          title: `${service.service.serviceName} Request Metrics`,
          left: [
            service.targetGroup.metricRequestCount(),
            service.targetGroup.metricTargetResponseTime()
          ],
          width: 12
        })
      );
    });
  }
}