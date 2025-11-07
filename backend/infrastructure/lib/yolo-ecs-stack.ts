/**
 * ECS/Fargate Stack for YOLO Room Detection Service
 * Deploys YOLOv8 model as a containerized service
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface YoloEcsStackProps extends cdk.StackProps {
  /**
   * Existing API Gateway ID to integrate with (optional)
   */
  apiGatewayId?: string;
}

export class YoloEcsStack extends cdk.Stack {
  public readonly serviceUrl: string;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props?: YoloEcsStackProps) {
    super(scope, id, props);

    // ===== VPC =====
    // Use default VPC to keep costs low
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', {
      isDefault: true,
    });

    // ===== ECS Cluster =====
    const cluster = new ecs.Cluster(this, 'YoloCluster', {
      vpc,
      clusterName: 'yolo-room-detection-cluster',
      containerInsights: true,
    });

    // ===== CloudWatch Logs =====
    const logGroup = new logs.LogGroup(this, 'YoloServiceLogs', {
      logGroupName: '/ecs/yolo-room-detection',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // ===== Task Execution Role =====
    const executionRole = new iam.Role(this, 'YoloTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy'
        ),
      ],
    });

    // ===== Task Definition =====
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'YoloTaskDef', {
      memoryLimitMiB: 4096, // 4GB - needed for PyTorch/YOLO
      cpu: 2048, // 2 vCPU
      executionRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // ===== Container Definition =====
    const container = taskDefinition.addContainer('YoloContainer', {
      image: ecs.ContainerImage.fromAsset(
        path.join(__dirname, '../../yolo-service'),
        {
          platform: cdk.aws_ecr_assets.Platform.LINUX_AMD64,
        }
      ),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'yolo-service',
        logGroup,
      }),
      environment: {
        MODEL_PATH: '/app/models/yolov8_room_detector.pt',
        PORT: '8080',
        PYTHONUNBUFFERED: '1',
      },
      healthCheck: {
        command: [
          'CMD-SHELL',
          'python -c "import requests; requests.get(\'http://localhost:8080/health\')" || exit 1',
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    // ===== Security Groups =====
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'Security group for YOLO ALB',
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP inbound'
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS inbound'
    );

    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc,
      description: 'Security group for YOLO ECS service',
      allowAllOutbound: true,
    });

    serviceSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(8080),
      'Allow traffic from ALB'
    );

    // ===== Application Load Balancer =====
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'YoloALB', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      loadBalancerName: 'yolo-room-detection-alb',
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'YoloTargetGroup', {
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    const listener = this.loadBalancer.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [targetGroup],
    });

    // ===== Fargate Service =====
    const service = new ecs.FargateService(this, 'YoloService', {
      cluster,
      taskDefinition,
      desiredCount: 1, // Start with 1, can scale up
      securityGroups: [serviceSecurityGroup],
      assignPublicIp: true, // Required for pulling Docker images from ECR
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      serviceName: 'yolo-room-detection-service',
    });

    // Attach service to target group
    service.attachToApplicationTargetGroup(targetGroup);

    // ===== Auto Scaling =====
    const scaling = service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 4,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ===== Outputs =====
    this.serviceUrl = `http://${this.loadBalancer.loadBalancerDnsName}`;

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'DNS name of the load balancer',
      exportName: 'YoloServiceDNS',
    });

    new cdk.CfnOutput(this, 'ServiceURL', {
      value: this.serviceUrl,
      description: 'URL of the YOLO detection service',
      exportName: 'YoloServiceURL',
    });

    new cdk.CfnOutput(this, 'DetectEndpoint', {
      value: `${this.serviceUrl}/detect`,
      description: 'YOLO detection endpoint',
      exportName: 'YoloDetectEndpoint',
    });
  }
}

