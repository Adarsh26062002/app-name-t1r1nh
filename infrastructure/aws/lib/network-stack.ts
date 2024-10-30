// AWS CDK Library v2.88.0
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs'; // v10.2.69
import * as ec2 from 'aws-cdk-lib/aws-ec2'; // v2.88.0
import * as logs from 'aws-cdk-lib/aws-logs'; // v2.88.0

// Network configuration constants
const DEFAULT_VPC_CIDR = '10.0.0.0/16';
const PUBLIC_SUBNET_CIDR = ['10.0.1.0/24', '10.0.2.0/24'];
const PRIVATE_APP_SUBNET_CIDR = ['10.0.3.0/24', '10.0.4.0/24'];
const PRIVATE_DB_SUBNET_CIDR = ['10.0.5.0/24', '10.0.6.0/24'];
const AVAILABILITY_ZONES = ['us-west-2a', 'us-west-2b'];

/**
 * Creates a VPC with public and private subnets across multiple availability zones
 * Implements requirements from system_architecture.deployment_architecture
 */
function createVpc(scope: Construct, id: string, props?: ec2.VpcProps): ec2.IVpc {
  return new ec2.Vpc(scope, id, {
    ipAddresses: ec2.IpAddresses.cidr(DEFAULT_VPC_CIDR),
    maxAzs: 2,
    natGateways: 2,
    subnetConfiguration: [
      {
        name: 'Public',
        subnetType: ec2.SubnetType.PUBLIC,
        cidrMask: 24,
        mapPublicIpOnLaunch: true,
      },
      {
        name: 'PrivateApp',
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        cidrMask: 24,
      },
      {
        name: 'PrivateDb',
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        cidrMask: 24,
      },
    ],
    ...props,
  });
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly publicSubnets: ec2.ISubnet[];
  public readonly privateAppSubnets: ec2.ISubnet[];
  public readonly privateDbSubnets: ec2.ISubnet[];
  public readonly ecsSecurityGroup: ec2.ISecurityGroup;
  public readonly rdsSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC with specified configuration
    this.vpc = createVpc(this, 'TestFrameworkVPC', {
      flowLogs: {
        // Implement security monitoring requirements
        's3': {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(
            new logs.LogGroup(this, 'VPCFlowLogs', {
              retention: logs.RetentionDays.ONE_MONTH,
              removalPolicy: cdk.RemovalPolicy.DESTROY,
            })
          ),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
    });

    // Store subnet references
    this.publicSubnets = this.vpc.publicSubnets;
    this.privateAppSubnets = this.vpc.privateSubnets;
    this.privateDbSubnets = this.vpc.isolatedSubnets;

    // Configure security groups
    this.configureSecurityGroups();

    // Set up VPC endpoints for AWS services
    this.configureVpcEndpoints();

    // Add tags for cost allocation
    cdk.Tags.of(this).add('Project', 'TestFramework');
    cdk.Tags.of(this).add('Environment', props?.env?.region || 'unknown');
  }

  /**
   * Creates and configures security groups for different services
   * Implements requirements from security_considerations.network_security
   */
  private configureSecurityGroups(): void {
    // ECS Security Group
    this.ecsSecurityGroup = new ec2.SecurityGroup(this, 'ECSSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ECS containers',
      allowAllOutbound: true,
    });

    // RDS Security Group
    this.rdsSecurityGroup = new ec2.SecurityGroup(this, 'RDSSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for RDS instances',
      allowAllOutbound: false,
    });

    // Allow ECS to RDS communication
    this.rdsSecurityGroup.addIngressRule(
      this.ecsSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from ECS containers'
    );

    // Allow HTTPS traffic for ECS
    this.ecsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS inbound traffic'
    );
  }

  /**
   * Sets up VPC endpoints for AWS services
   * Implements requirements from infrastructure.cloud_services
   */
  private configureVpcEndpoints(): void {
    // S3 Gateway Endpoint
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // ECR Endpoints
    this.vpc.addInterfaceEndpoint('ECRDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      securityGroups: [this.ecsSecurityGroup],
    });

    this.vpc.addInterfaceEndpoint('ECREndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      securityGroups: [this.ecsSecurityGroup],
    });

    // CloudWatch Endpoint
    this.vpc.addInterfaceEndpoint('CloudWatchEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH,
      securityGroups: [this.ecsSecurityGroup],
    });

    // CloudWatch Logs Endpoint
    this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      securityGroups: [this.ecsSecurityGroup],
    });
  }
}