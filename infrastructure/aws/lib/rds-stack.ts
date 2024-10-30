// AWS CDK Library v2.88.0
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs'; // v10.2.69
import * as rds from 'aws-cdk-lib/aws-rds'; // v2.88.0
import * as ec2 from 'aws-cdk-lib/aws-ec2'; // v2.88.0
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'; // v2.88.0
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'; // v2.88.0

// Import network stack for VPC and security group dependencies
import { NetworkStack } from './network-stack';

// Constants from globals
const DB_PORT = 5432;
const POSTGRES_ENGINE_VERSION = '13.7';
const BACKUP_RETENTION_DAYS = 7;
const INSTANCE_TYPE = 't3.medium';

/**
 * RDS Stack for managing PostgreSQL database instances
 * Implements requirements from system_architecture.database_integration_layer
 */
export class RdsStack extends cdk.Stack {
  public readonly eventsDb: rds.DatabaseInstance;
  public readonly inventoryDb: rds.DatabaseInstance;
  private readonly dbParameterGroup: rds.ParameterGroup;
  private readonly dbSubnetGroup: rds.SubnetGroup;

  constructor(scope: Construct, id: string, networkStack: NetworkStack, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DB subnet group using private subnets
    this.dbSubnetGroup = new rds.SubnetGroup(this, 'DBSubnetGroup', {
      description: 'Subnet group for RDS instances',
      vpc: networkStack.vpc,
      vpcSubnets: { subnets: networkStack.privateDbSubnets },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create PostgreSQL parameter group with optimized settings
    this.dbParameterGroup = new rds.ParameterGroup(this, 'DBParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_13_7,
      }),
      description: 'Custom parameter group for PostgreSQL RDS instances',
      parameters: {
        'max_connections': '100',
        'shared_buffers': '256MB',
        'effective_cache_size': '768MB',
        'maintenance_work_mem': '64MB',
        'checkpoint_completion_target': '0.9',
        'wal_buffers': '7864kB',
        'default_statistics_target': '100',
        'random_page_cost': '1.1',
        'effective_io_concurrency': '200',
        'work_mem': '2621kB',
        'min_wal_size': '1GB',
        'max_wal_size': '4GB',
      },
    });

    // Create Events database instance
    this.eventsDb = this.createRdsInstance(
      'EventsDB',
      networkStack.vpc,
      networkStack.rdsSecurityGroup,
      {
        databaseName: 'events_db',
        port: DB_PORT,
        allocatedStorage: 20,
        maxAllocatedStorage: 100,
        backupRetention: cdk.Duration.days(BACKUP_RETENTION_DAYS),
        deleteAutomatedBackups: false,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MEDIUM
        ),
      }
    );

    // Create Inventory database instance
    this.inventoryDb = this.createRdsInstance(
      'InventoryDB',
      networkStack.vpc,
      networkStack.rdsSecurityGroup,
      {
        databaseName: 'inventory_db',
        port: DB_PORT,
        allocatedStorage: 20,
        maxAllocatedStorage: 100,
        backupRetention: cdk.Duration.days(BACKUP_RETENTION_DAYS),
        deleteAutomatedBackups: false,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MEDIUM
        ),
      }
    );

    // Configure monitoring for both instances
    this.configureMonitoring(this.eventsDb, {
      cpuUtilizationThreshold: 80,
      freeStorageSpaceThreshold: 10,
      databaseConnectionsThreshold: 80,
      readLatencyThreshold: 20,
      writeLatencyThreshold: 20,
    });

    this.configureMonitoring(this.inventoryDb, {
      cpuUtilizationThreshold: 80,
      freeStorageSpaceThreshold: 10,
      databaseConnectionsThreshold: 80,
      readLatencyThreshold: 20,
      writeLatencyThreshold: 20,
    });

    // Configure backup settings
    this.configureBackup(this.eventsDb, BACKUP_RETENTION_DAYS);
    this.configureBackup(this.inventoryDb, BACKUP_RETENTION_DAYS);

    // Add tags for cost allocation
    cdk.Tags.of(this).add('Project', 'TestFramework');
    cdk.Tags.of(this).add('Environment', props?.env?.region || 'unknown');
  }

  /**
   * Creates a highly available RDS PostgreSQL instance
   * Implements requirements from system_architecture.deployment_architecture
   */
  private createRdsInstance(
    instanceIdentifier: string,
    vpc: ec2.IVpc,
    securityGroup: ec2.ISecurityGroup,
    props: Partial<rds.DatabaseInstanceProps>
  ): rds.DatabaseInstance {
    // Create credentials secret
    const credentials = new secretsmanager.Secret(this, `${instanceIdentifier}Credentials`, {
      secretName: `${instanceIdentifier.toLowerCase()}-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 16,
      },
    });

    return new rds.DatabaseInstance(this, instanceIdentifier, {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_13_7,
      }),
      credentials: rds.Credentials.fromSecret(credentials),
      vpc,
      vpcSubnets: { subnets: vpc.isolatedSubnets },
      securityGroups: [securityGroup],
      parameterGroup: this.dbParameterGroup,
      subnetGroup: this.dbSubnetGroup,
      multiAz: true,
      storageEncrypted: true,
      monitoringInterval: cdk.Duration.seconds(60),
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
      cloudwatchLogsExports: ['postgresql', 'upgrade'],
      autoMinorVersionUpgrade: true,
      ...props,
    });
  }

  /**
   * Configures backup and snapshot settings for RDS instances
   */
  private configureBackup(instance: rds.DatabaseInstance, retentionDays: number): void {
    // Backup window is set during off-peak hours (UTC)
    instance.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    
    // Add snapshot export configuration
    const cfnDBInstance = instance.node.defaultChild as rds.CfnDBInstance;
    cfnDBInstance.addPropertyOverride('BackupRetentionPeriod', retentionDays);
    cfnDBInstance.addPropertyOverride('PreferredBackupWindow', '03:00-04:00');
    cfnDBInstance.addPropertyOverride('PreferredMaintenanceWindow', 'mon:04:00-mon:05:00');
  }

  /**
   * Sets up enhanced monitoring and CloudWatch alarms for RDS instances
   */
  private configureMonitoring(
    instance: rds.DatabaseInstance,
    config: {
      cpuUtilizationThreshold: number;
      freeStorageSpaceThreshold: number;
      databaseConnectionsThreshold: number;
      readLatencyThreshold: number;
      writeLatencyThreshold: number;
    }
  ): void {
    // CPU Utilization Alarm
    new cloudwatch.Alarm(this, `${instance.instanceIdentifier}CPUUtilizationAlarm`, {
      metric: instance.metricCPUUtilization(),
      threshold: config.cpuUtilizationThreshold,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    // Free Storage Space Alarm
    new cloudwatch.Alarm(this, `${instance.instanceIdentifier}FreeStorageSpaceAlarm`, {
      metric: instance.metricFreeStorageSpace(),
      threshold: config.freeStorageSpaceThreshold,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    });

    // Database Connections Alarm
    new cloudwatch.Alarm(this, `${instance.instanceIdentifier}DatabaseConnectionsAlarm`, {
      metric: instance.metricDatabaseConnections(),
      threshold: config.databaseConnectionsThreshold,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    // Read Latency Alarm
    new cloudwatch.Alarm(this, `${instance.instanceIdentifier}ReadLatencyAlarm`, {
      metric: instance.metricReadLatency(),
      threshold: config.readLatencyThreshold,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    // Write Latency Alarm
    new cloudwatch.Alarm(this, `${instance.instanceIdentifier}WriteLatencyAlarm`, {
      metric: instance.metricWriteLatency(),
      threshold: config.writeLatencyThreshold,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
  }
}