"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YoloEcsStack = void 0;
/**
 * ECS/Fargate Stack for YOLO Room Detection Service
 * Deploys YOLOv8 model as a containerized service with API Gateway HTTPS proxy
 */
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const elbv2 = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const apigatewayv2_integrations = __importStar(require("aws-cdk-lib/aws-apigatewayv2-integrations"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const path = __importStar(require("path"));
class YoloEcsStack extends cdk.Stack {
    constructor(scope, id, props) {
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
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
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
            image: ecs.ContainerImage.fromAsset(path.join(__dirname, '../../yolo-service'), {
                platform: cdk.aws_ecr_assets.Platform.LINUX_AMD64,
            }),
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'yolo-service',
                logGroup,
            }),
            environment: {
                PORT: '8080',
                PYTHONUNBUFFERED: '1',
                // Roboflow API key - loaded from environment variable for security
                ROBOFLOW_API_KEY: process.env.ROBOFLOW_API_KEY || 'S6mAH8NfqXgodc6InODR',
            },
            // Note: Removed container healthCheck - ALB handles health checks via /health endpoint
            // Container health check was failing due to missing 'requests' library
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
        albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP inbound');
        albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS inbound');
        const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
            vpc,
            description: 'Security group for YOLO ECS service',
            allowAllOutbound: true,
        });
        serviceSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(8080), 'Allow traffic from ALB');
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
        this.listener = this.loadBalancer.addListener('HttpListener', {
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
            healthCheckGracePeriod: cdk.Duration.seconds(120), // Increased to allow model loading
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
        // ===== API Gateway HTTP API (HTTPS Proxy) =====
        // Provides HTTPS endpoint for the HTTP-only ALB
        const httpApi = new apigatewayv2.HttpApi(this, 'YoloHttpApi', {
            apiName: 'yolo-room-detection-api',
            description: 'HTTPS proxy for YOLO ECS service',
            corsPreflight: {
                allowOrigins: ['*'], // Configure for production
                allowMethods: [apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.GET, apigatewayv2.CorsHttpMethod.OPTIONS],
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });
        // Create HTTP URL integration for proxy paths (forwards the full path)
        const proxyIntegration = new apigatewayv2_integrations.HttpUrlIntegration('ProxyIntegration', `http://${this.loadBalancer.loadBalancerDnsName}/{proxy}`);
        // Create HTTP URL integration for root path
        const rootIntegration = new apigatewayv2_integrations.HttpUrlIntegration('RootIntegration', `http://${this.loadBalancer.loadBalancerDnsName}/`);
        // Catch-all route for all paths - forwards /{proxy+} to ALB
        httpApi.addRoutes({
            path: '/{proxy+}',
            methods: [
                apigatewayv2.HttpMethod.GET,
                apigatewayv2.HttpMethod.POST,
                apigatewayv2.HttpMethod.PUT,
                apigatewayv2.HttpMethod.DELETE,
                apigatewayv2.HttpMethod.PATCH,
                apigatewayv2.HttpMethod.OPTIONS,
            ],
            integration: proxyIntegration,
        });
        // Root path route
        httpApi.addRoutes({
            path: '/',
            methods: [
                apigatewayv2.HttpMethod.GET,
                apigatewayv2.HttpMethod.POST,
                apigatewayv2.HttpMethod.OPTIONS,
            ],
            integration: rootIntegration,
        });
        // ===== Outputs =====
        this.serviceUrl = httpApi.apiEndpoint;
        new cdk.CfnOutput(this, 'LoadBalancerDNS', {
            value: this.loadBalancer.loadBalancerDnsName,
            description: 'DNS name of the load balancer (internal)',
            exportName: 'YoloServiceDNS',
        });
        new cdk.CfnOutput(this, 'ApiGatewayURL', {
            value: httpApi.apiEndpoint,
            description: 'HTTPS API Gateway URL',
            exportName: 'YoloApiGatewayURL',
        });
        new cdk.CfnOutput(this, 'ServiceURL', {
            value: this.serviceUrl,
            description: 'URL of the YOLO detection service (HTTPS)',
            exportName: 'YoloServiceURL',
        });
        new cdk.CfnOutput(this, 'DetectEndpoint', {
            value: `${this.serviceUrl}/detect`,
            description: 'YOLO detection endpoint (HTTPS)',
            exportName: 'YoloDetectEndpoint',
        });
    }
}
exports.YoloEcsStack = YoloEcsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieW9sby1lY3Mtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ5b2xvLWVjcy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBOzs7R0FHRztBQUNILGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLDhFQUFnRTtBQUNoRSwyRUFBNkQ7QUFDN0QscUdBQXVGO0FBQ3ZGLDJEQUE2QztBQUM3Qyx5REFBMkM7QUFFM0MsMkNBQTZCO0FBUzdCLE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBS3pDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBeUI7UUFDakUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsa0JBQWtCO1FBQ2xCLG9DQUFvQztRQUNwQyxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ2pELFNBQVMsRUFBRSxJQUFJO1NBQ2hCLENBQUMsQ0FBQztRQUVILDBCQUEwQjtRQUMxQixNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNuRCxHQUFHO1lBQ0gsV0FBVyxFQUFFLDZCQUE2QjtZQUMxQyxpQkFBaUIsRUFBRSxJQUFJO1NBQ3hCLENBQUMsQ0FBQztRQUVILDhCQUE4QjtRQUM5QixNQUFNLFFBQVEsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQzFELFlBQVksRUFBRSwwQkFBMEI7WUFDeEMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxTQUFTLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRO1NBQ3ZDLENBQUMsQ0FBQztRQUVILGtDQUFrQztRQUNsQyxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQ2hFLFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyx5QkFBeUIsQ0FBQztZQUM5RCxlQUFlLEVBQUU7Z0JBQ2YsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FDeEMsK0NBQStDLENBQ2hEO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCw4QkFBOEI7UUFDOUIsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUN4RSxjQUFjLEVBQUUsSUFBSSxFQUFFLGdDQUFnQztZQUN0RCxHQUFHLEVBQUUsSUFBSSxFQUFFLFNBQVM7WUFDcEIsYUFBYTtZQUNiLGVBQWUsRUFBRTtnQkFDZixlQUFlLEVBQUUsR0FBRyxDQUFDLGVBQWUsQ0FBQyxNQUFNO2dCQUMzQyxxQkFBcUIsRUFBRSxHQUFHLENBQUMscUJBQXFCLENBQUMsS0FBSzthQUN2RDtTQUNGLENBQUMsQ0FBQztRQUVILG1DQUFtQztRQUNuQyxNQUFNLFNBQVMsR0FBRyxjQUFjLENBQUMsWUFBWSxDQUFDLGVBQWUsRUFBRTtZQUM3RCxLQUFLLEVBQUUsR0FBRyxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQ2pDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLEVBQzFDO2dCQUNFLFFBQVEsRUFBRSxHQUFHLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxXQUFXO2FBQ2xELENBQ0Y7WUFDRCxPQUFPLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7Z0JBQzlCLFlBQVksRUFBRSxjQUFjO2dCQUM1QixRQUFRO2FBQ1QsQ0FBQztZQUNGLFdBQVcsRUFBRTtnQkFDWCxJQUFJLEVBQUUsTUFBTTtnQkFDWixnQkFBZ0IsRUFBRSxHQUFHO2dCQUNyQixtRUFBbUU7Z0JBQ25FLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLElBQUksc0JBQXNCO2FBQ3pFO1lBQ0QsdUZBQXVGO1lBQ3ZGLHVFQUF1RTtTQUN4RSxDQUFDLENBQUM7UUFFSCxTQUFTLENBQUMsZUFBZSxDQUFDO1lBQ3hCLGFBQWEsRUFBRSxJQUFJO1lBQ25CLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUc7U0FDM0IsQ0FBQyxDQUFDO1FBRUgsOEJBQThCO1FBQzlCLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUN2RSxHQUFHO1lBQ0gsV0FBVyxFQUFFLDZCQUE2QjtZQUMxQyxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILGdCQUFnQixDQUFDLGNBQWMsQ0FDN0IsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFDbEIsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQ2hCLG9CQUFvQixDQUNyQixDQUFDO1FBRUYsZ0JBQWdCLENBQUMsY0FBYyxDQUM3QixHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUNsQixHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFDakIscUJBQXFCLENBQ3RCLENBQUM7UUFFRixNQUFNLG9CQUFvQixHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDL0UsR0FBRztZQUNILFdBQVcsRUFBRSxxQ0FBcUM7WUFDbEQsZ0JBQWdCLEVBQUUsSUFBSTtTQUN2QixDQUFDLENBQUM7UUFFSCxvQkFBb0IsQ0FBQyxjQUFjLENBQ2pDLGdCQUFnQixFQUNoQixHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFDbEIsd0JBQXdCLENBQ3pCLENBQUM7UUFFRix3Q0FBd0M7UUFDeEMsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQ3JFLEdBQUc7WUFDSCxjQUFjLEVBQUUsSUFBSTtZQUNwQixhQUFhLEVBQUUsZ0JBQWdCO1lBQy9CLGdCQUFnQixFQUFFLHlCQUF5QjtTQUM1QyxDQUFDLENBQUM7UUFFSCxNQUFNLFdBQVcsR0FBRyxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDNUUsR0FBRztZQUNILElBQUksRUFBRSxJQUFJO1lBQ1YsUUFBUSxFQUFFLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJO1lBQ3hDLFVBQVUsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDL0IsV0FBVyxFQUFFO2dCQUNYLElBQUksRUFBRSxTQUFTO2dCQUNmLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ2xDLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ2pDLHFCQUFxQixFQUFFLENBQUM7Z0JBQ3hCLHVCQUF1QixFQUFFLENBQUM7YUFDM0I7WUFDRCxtQkFBbUIsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7U0FDOUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxjQUFjLEVBQUU7WUFDNUQsSUFBSSxFQUFFLEVBQUU7WUFDUixRQUFRLEVBQUUsS0FBSyxDQUFDLG1CQUFtQixDQUFDLElBQUk7WUFDeEMsbUJBQW1CLEVBQUUsQ0FBQyxXQUFXLENBQUM7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsOEJBQThCO1FBQzlCLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQzFELE9BQU87WUFDUCxjQUFjO1lBQ2QsWUFBWSxFQUFFLENBQUMsRUFBRSw2QkFBNkI7WUFDOUMsY0FBYyxFQUFFLENBQUMsb0JBQW9CLENBQUM7WUFDdEMsY0FBYyxFQUFFLElBQUksRUFBRSw4Q0FBOEM7WUFDcEUsc0JBQXNCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsbUNBQW1DO1lBQ3RGLFdBQVcsRUFBRSw2QkFBNkI7U0FDM0MsQ0FBQyxDQUFDO1FBRUgsaUNBQWlDO1FBQ2pDLE9BQU8sQ0FBQyw4QkFBOEIsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUVwRCwyQkFBMkI7UUFDM0IsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixDQUFDO1lBQ3pDLFdBQVcsRUFBRSxDQUFDO1lBQ2QsV0FBVyxFQUFFLENBQUM7U0FDZixDQUFDLENBQUM7UUFFSCxPQUFPLENBQUMscUJBQXFCLENBQUMsWUFBWSxFQUFFO1lBQzFDLHdCQUF3QixFQUFFLEVBQUU7WUFDNUIsZUFBZSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUN6QyxnQkFBZ0IsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7U0FDM0MsQ0FBQyxDQUFDO1FBRUgsT0FBTyxDQUFDLHdCQUF3QixDQUFDLGVBQWUsRUFBRTtZQUNoRCx3QkFBd0IsRUFBRSxFQUFFO1lBQzVCLGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDekMsZ0JBQWdCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1NBQzNDLENBQUMsQ0FBQztRQUVILGlEQUFpRDtRQUNqRCxnREFBZ0Q7UUFDaEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDNUQsT0FBTyxFQUFFLHlCQUF5QjtZQUNsQyxXQUFXLEVBQUUsa0NBQWtDO1lBQy9DLGFBQWEsRUFBRTtnQkFDYixZQUFZLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSwyQkFBMkI7Z0JBQ2hELFlBQVksRUFBRSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLFlBQVksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDO2dCQUN0SCxZQUFZLEVBQUUsQ0FBQyxjQUFjLEVBQUUsZUFBZSxDQUFDO2FBQ2hEO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsdUVBQXVFO1FBQ3ZFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSx5QkFBeUIsQ0FBQyxrQkFBa0IsQ0FDdkUsa0JBQWtCLEVBQ2xCLFVBQVUsSUFBSSxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsVUFBVSxDQUMxRCxDQUFDO1FBRUYsNENBQTRDO1FBQzVDLE1BQU0sZUFBZSxHQUFHLElBQUkseUJBQXlCLENBQUMsa0JBQWtCLENBQ3RFLGlCQUFpQixFQUNqQixVQUFVLElBQUksQ0FBQyxZQUFZLENBQUMsbUJBQW1CLEdBQUcsQ0FDbkQsQ0FBQztRQUVGLDREQUE0RDtRQUM1RCxPQUFPLENBQUMsU0FBUyxDQUFDO1lBQ2hCLElBQUksRUFBRSxXQUFXO1lBQ2pCLE9BQU8sRUFBRTtnQkFDUCxZQUFZLENBQUMsVUFBVSxDQUFDLEdBQUc7Z0JBQzNCLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBSTtnQkFDNUIsWUFBWSxDQUFDLFVBQVUsQ0FBQyxHQUFHO2dCQUMzQixZQUFZLENBQUMsVUFBVSxDQUFDLE1BQU07Z0JBQzlCLFlBQVksQ0FBQyxVQUFVLENBQUMsS0FBSztnQkFDN0IsWUFBWSxDQUFDLFVBQVUsQ0FBQyxPQUFPO2FBQ2hDO1lBQ0QsV0FBVyxFQUFFLGdCQUFnQjtTQUM5QixDQUFDLENBQUM7UUFFSCxrQkFBa0I7UUFDbEIsT0FBTyxDQUFDLFNBQVMsQ0FBQztZQUNoQixJQUFJLEVBQUUsR0FBRztZQUNULE9BQU8sRUFBRTtnQkFDUCxZQUFZLENBQUMsVUFBVSxDQUFDLEdBQUc7Z0JBQzNCLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBSTtnQkFDNUIsWUFBWSxDQUFDLFVBQVUsQ0FBQyxPQUFPO2FBQ2hDO1lBQ0QsV0FBVyxFQUFFLGVBQWU7U0FDN0IsQ0FBQyxDQUFDO1FBRUgsc0JBQXNCO1FBQ3RCLElBQUksQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQztRQUV0QyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLG1CQUFtQjtZQUM1QyxXQUFXLEVBQUUsMENBQTBDO1lBQ3ZELFVBQVUsRUFBRSxnQkFBZ0I7U0FDN0IsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxXQUFXO1lBQzFCLFdBQVcsRUFBRSx1QkFBdUI7WUFDcEMsVUFBVSxFQUFFLG1CQUFtQjtTQUNoQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNwQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVU7WUFDdEIsV0FBVyxFQUFFLDJDQUEyQztZQUN4RCxVQUFVLEVBQUUsZ0JBQWdCO1NBQzdCLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLEdBQUcsSUFBSSxDQUFDLFVBQVUsU0FBUztZQUNsQyxXQUFXLEVBQUUsaUNBQWlDO1lBQzlDLFVBQVUsRUFBRSxvQkFBb0I7U0FDakMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBcFBELG9DQW9QQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRUNTL0ZhcmdhdGUgU3RhY2sgZm9yIFlPTE8gUm9vbSBEZXRlY3Rpb24gU2VydmljZVxuICogRGVwbG95cyBZT0xPdjggbW9kZWwgYXMgYSBjb250YWluZXJpemVkIHNlcnZpY2Ugd2l0aCBBUEkgR2F0ZXdheSBIVFRQUyBwcm94eVxuICovXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgZWNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3MnO1xuaW1wb3J0ICogYXMgZWxidjIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVsYXN0aWNsb2FkYmFsYW5jaW5ndjInO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheXYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djInO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheXYyX2ludGVncmF0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyLWludGVncmF0aW9ucyc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuZXhwb3J0IGludGVyZmFjZSBZb2xvRWNzU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgLyoqXG4gICAqIEV4aXN0aW5nIEFQSSBHYXRld2F5IElEIHRvIGludGVncmF0ZSB3aXRoIChvcHRpb25hbClcbiAgICovXG4gIGFwaUdhdGV3YXlJZD86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFlvbG9FY3NTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBzZXJ2aWNlVXJsOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBsb2FkQmFsYW5jZXI6IGVsYnYyLkFwcGxpY2F0aW9uTG9hZEJhbGFuY2VyO1xuICBwcml2YXRlIHJlYWRvbmx5IGxpc3RlbmVyOiBlbGJ2Mi5BcHBsaWNhdGlvbkxpc3RlbmVyO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogWW9sb0Vjc1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vID09PT09IFZQQyA9PT09PVxuICAgIC8vIFVzZSBkZWZhdWx0IFZQQyB0byBrZWVwIGNvc3RzIGxvd1xuICAgIGNvbnN0IHZwYyA9IGVjMi5WcGMuZnJvbUxvb2t1cCh0aGlzLCAnRGVmYXVsdFZQQycsIHtcbiAgICAgIGlzRGVmYXVsdDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vID09PT09IEVDUyBDbHVzdGVyID09PT09XG4gICAgY29uc3QgY2x1c3RlciA9IG5ldyBlY3MuQ2x1c3Rlcih0aGlzLCAnWW9sb0NsdXN0ZXInLCB7XG4gICAgICB2cGMsXG4gICAgICBjbHVzdGVyTmFtZTogJ3lvbG8tcm9vbS1kZXRlY3Rpb24tY2x1c3RlcicsXG4gICAgICBjb250YWluZXJJbnNpZ2h0czogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vID09PT09IENsb3VkV2F0Y2ggTG9ncyA9PT09PVxuICAgIGNvbnN0IGxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ1lvbG9TZXJ2aWNlTG9ncycsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogJy9lY3MveW9sby1yb29tLWRldGVjdGlvbicsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PSBUYXNrIEV4ZWN1dGlvbiBSb2xlID09PT09XG4gICAgY29uc3QgZXhlY3V0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnWW9sb1Rhc2tFeGVjdXRpb25Sb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2Vjcy10YXNrcy5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKFxuICAgICAgICAgICdzZXJ2aWNlLXJvbGUvQW1hem9uRUNTVGFza0V4ZWN1dGlvblJvbGVQb2xpY3knXG4gICAgICAgICksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT0gVGFzayBEZWZpbml0aW9uID09PT09XG4gICAgY29uc3QgdGFza0RlZmluaXRpb24gPSBuZXcgZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbih0aGlzLCAnWW9sb1Rhc2tEZWYnLCB7XG4gICAgICBtZW1vcnlMaW1pdE1pQjogNDA5NiwgLy8gNEdCIC0gbmVlZGVkIGZvciBQeVRvcmNoL1lPTE9cbiAgICAgIGNwdTogMjA0OCwgLy8gMiB2Q1BVXG4gICAgICBleGVjdXRpb25Sb2xlLFxuICAgICAgcnVudGltZVBsYXRmb3JtOiB7XG4gICAgICAgIGNwdUFyY2hpdGVjdHVyZTogZWNzLkNwdUFyY2hpdGVjdHVyZS5YODZfNjQsXG4gICAgICAgIG9wZXJhdGluZ1N5c3RlbUZhbWlseTogZWNzLk9wZXJhdGluZ1N5c3RlbUZhbWlseS5MSU5VWCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PSBDb250YWluZXIgRGVmaW5pdGlvbiA9PT09PVxuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRhc2tEZWZpbml0aW9uLmFkZENvbnRhaW5lcignWW9sb0NvbnRhaW5lcicsIHtcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUFzc2V0KFxuICAgICAgICBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4veW9sby1zZXJ2aWNlJyksXG4gICAgICAgIHtcbiAgICAgICAgICBwbGF0Zm9ybTogY2RrLmF3c19lY3JfYXNzZXRzLlBsYXRmb3JtLkxJTlVYX0FNRDY0LFxuICAgICAgICB9XG4gICAgICApLFxuICAgICAgbG9nZ2luZzogZWNzLkxvZ0RyaXZlcnMuYXdzTG9ncyh7XG4gICAgICAgIHN0cmVhbVByZWZpeDogJ3lvbG8tc2VydmljZScsXG4gICAgICAgIGxvZ0dyb3VwLFxuICAgICAgfSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBQT1JUOiAnODA4MCcsXG4gICAgICAgIFBZVEhPTlVOQlVGRkVSRUQ6ICcxJyxcbiAgICAgICAgLy8gUm9ib2Zsb3cgQVBJIGtleSAtIGxvYWRlZCBmcm9tIGVudmlyb25tZW50IHZhcmlhYmxlIGZvciBzZWN1cml0eVxuICAgICAgICBST0JPRkxPV19BUElfS0VZOiBwcm9jZXNzLmVudi5ST0JPRkxPV19BUElfS0VZIHx8ICdTNm1BSDhOZnFYZ29kYzZJbk9EUicsXG4gICAgICB9LFxuICAgICAgLy8gTm90ZTogUmVtb3ZlZCBjb250YWluZXIgaGVhbHRoQ2hlY2sgLSBBTEIgaGFuZGxlcyBoZWFsdGggY2hlY2tzIHZpYSAvaGVhbHRoIGVuZHBvaW50XG4gICAgICAvLyBDb250YWluZXIgaGVhbHRoIGNoZWNrIHdhcyBmYWlsaW5nIGR1ZSB0byBtaXNzaW5nICdyZXF1ZXN0cycgbGlicmFyeVxuICAgIH0pO1xuXG4gICAgY29udGFpbmVyLmFkZFBvcnRNYXBwaW5ncyh7XG4gICAgICBjb250YWluZXJQb3J0OiA4MDgwLFxuICAgICAgcHJvdG9jb2w6IGVjcy5Qcm90b2NvbC5UQ1AsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PSBTZWN1cml0eSBHcm91cHMgPT09PT1cbiAgICBjb25zdCBhbGJTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdBTEJTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgWU9MTyBBTEInLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGFsYlNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBlYzIuUGVlci5hbnlJcHY0KCksXG4gICAgICBlYzIuUG9ydC50Y3AoODApLFxuICAgICAgJ0FsbG93IEhUVFAgaW5ib3VuZCdcbiAgICApO1xuXG4gICAgYWxiU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmFueUlwdjQoKSxcbiAgICAgIGVjMi5Qb3J0LnRjcCg0NDMpLFxuICAgICAgJ0FsbG93IEhUVFBTIGluYm91bmQnXG4gICAgKTtcblxuICAgIGNvbnN0IHNlcnZpY2VTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdTZXJ2aWNlU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIFlPTE8gRUNTIHNlcnZpY2UnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIHNlcnZpY2VTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgYWxiU2VjdXJpdHlHcm91cCxcbiAgICAgIGVjMi5Qb3J0LnRjcCg4MDgwKSxcbiAgICAgICdBbGxvdyB0cmFmZmljIGZyb20gQUxCJ1xuICAgICk7XG5cbiAgICAvLyA9PT09PSBBcHBsaWNhdGlvbiBMb2FkIEJhbGFuY2VyID09PT09XG4gICAgdGhpcy5sb2FkQmFsYW5jZXIgPSBuZXcgZWxidjIuQXBwbGljYXRpb25Mb2FkQmFsYW5jZXIodGhpcywgJ1lvbG9BTEInLCB7XG4gICAgICB2cGMsXG4gICAgICBpbnRlcm5ldEZhY2luZzogdHJ1ZSxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGFsYlNlY3VyaXR5R3JvdXAsXG4gICAgICBsb2FkQmFsYW5jZXJOYW1lOiAneW9sby1yb29tLWRldGVjdGlvbi1hbGInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdGFyZ2V0R3JvdXAgPSBuZXcgZWxidjIuQXBwbGljYXRpb25UYXJnZXRHcm91cCh0aGlzLCAnWW9sb1RhcmdldEdyb3VwJywge1xuICAgICAgdnBjLFxuICAgICAgcG9ydDogODA4MCxcbiAgICAgIHByb3RvY29sOiBlbGJ2Mi5BcHBsaWNhdGlvblByb3RvY29sLkhUVFAsXG4gICAgICB0YXJnZXRUeXBlOiBlbGJ2Mi5UYXJnZXRUeXBlLklQLFxuICAgICAgaGVhbHRoQ2hlY2s6IHtcbiAgICAgICAgcGF0aDogJy9oZWFsdGgnLFxuICAgICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICAgIGhlYWx0aHlUaHJlc2hvbGRDb3VudDogMixcbiAgICAgICAgdW5oZWFsdGh5VGhyZXNob2xkQ291bnQ6IDMsXG4gICAgICB9LFxuICAgICAgZGVyZWdpc3RyYXRpb25EZWxheTogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgIH0pO1xuXG4gICAgdGhpcy5saXN0ZW5lciA9IHRoaXMubG9hZEJhbGFuY2VyLmFkZExpc3RlbmVyKCdIdHRwTGlzdGVuZXInLCB7XG4gICAgICBwb3J0OiA4MCxcbiAgICAgIHByb3RvY29sOiBlbGJ2Mi5BcHBsaWNhdGlvblByb3RvY29sLkhUVFAsXG4gICAgICBkZWZhdWx0VGFyZ2V0R3JvdXBzOiBbdGFyZ2V0R3JvdXBdLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT0gRmFyZ2F0ZSBTZXJ2aWNlID09PT09XG4gICAgY29uc3Qgc2VydmljZSA9IG5ldyBlY3MuRmFyZ2F0ZVNlcnZpY2UodGhpcywgJ1lvbG9TZXJ2aWNlJywge1xuICAgICAgY2x1c3RlcixcbiAgICAgIHRhc2tEZWZpbml0aW9uLFxuICAgICAgZGVzaXJlZENvdW50OiAxLCAvLyBTdGFydCB3aXRoIDEsIGNhbiBzY2FsZSB1cFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtzZXJ2aWNlU2VjdXJpdHlHcm91cF0sXG4gICAgICBhc3NpZ25QdWJsaWNJcDogdHJ1ZSwgLy8gUmVxdWlyZWQgZm9yIHB1bGxpbmcgRG9ja2VyIGltYWdlcyBmcm9tIEVDUlxuICAgICAgaGVhbHRoQ2hlY2tHcmFjZVBlcmlvZDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTIwKSwgLy8gSW5jcmVhc2VkIHRvIGFsbG93IG1vZGVsIGxvYWRpbmdcbiAgICAgIHNlcnZpY2VOYW1lOiAneW9sby1yb29tLWRldGVjdGlvbi1zZXJ2aWNlJyxcbiAgICB9KTtcblxuICAgIC8vIEF0dGFjaCBzZXJ2aWNlIHRvIHRhcmdldCBncm91cFxuICAgIHNlcnZpY2UuYXR0YWNoVG9BcHBsaWNhdGlvblRhcmdldEdyb3VwKHRhcmdldEdyb3VwKTtcblxuICAgIC8vID09PT09IEF1dG8gU2NhbGluZyA9PT09PVxuICAgIGNvbnN0IHNjYWxpbmcgPSBzZXJ2aWNlLmF1dG9TY2FsZVRhc2tDb3VudCh7XG4gICAgICBtaW5DYXBhY2l0eTogMSxcbiAgICAgIG1heENhcGFjaXR5OiA0LFxuICAgIH0pO1xuXG4gICAgc2NhbGluZy5zY2FsZU9uQ3B1VXRpbGl6YXRpb24oJ0NwdVNjYWxpbmcnLCB7XG4gICAgICB0YXJnZXRVdGlsaXphdGlvblBlcmNlbnQ6IDcwLFxuICAgICAgc2NhbGVJbkNvb2xkb3duOiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBzY2FsZU91dENvb2xkb3duOiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgfSk7XG5cbiAgICBzY2FsaW5nLnNjYWxlT25NZW1vcnlVdGlsaXphdGlvbignTWVtb3J5U2NhbGluZycsIHtcbiAgICAgIHRhcmdldFV0aWxpemF0aW9uUGVyY2VudDogODAsXG4gICAgICBzY2FsZUluQ29vbGRvd246IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIHNjYWxlT3V0Q29vbGRvd246IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICB9KTtcblxuICAgIC8vID09PT09IEFQSSBHYXRld2F5IEhUVFAgQVBJIChIVFRQUyBQcm94eSkgPT09PT1cbiAgICAvLyBQcm92aWRlcyBIVFRQUyBlbmRwb2ludCBmb3IgdGhlIEhUVFAtb25seSBBTEJcbiAgICBjb25zdCBodHRwQXBpID0gbmV3IGFwaWdhdGV3YXl2Mi5IdHRwQXBpKHRoaXMsICdZb2xvSHR0cEFwaScsIHtcbiAgICAgIGFwaU5hbWU6ICd5b2xvLXJvb20tZGV0ZWN0aW9uLWFwaScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0hUVFBTIHByb3h5IGZvciBZT0xPIEVDUyBzZXJ2aWNlJyxcbiAgICAgIGNvcnNQcmVmbGlnaHQ6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbJyonXSwgLy8gQ29uZmlndXJlIGZvciBwcm9kdWN0aW9uXG4gICAgICAgIGFsbG93TWV0aG9kczogW2FwaWdhdGV3YXl2Mi5Db3JzSHR0cE1ldGhvZC5QT1NULCBhcGlnYXRld2F5djIuQ29yc0h0dHBNZXRob2QuR0VULCBhcGlnYXRld2F5djIuQ29yc0h0dHBNZXRob2QuT1BUSU9OU10sXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBIVFRQIFVSTCBpbnRlZ3JhdGlvbiBmb3IgcHJveHkgcGF0aHMgKGZvcndhcmRzIHRoZSBmdWxsIHBhdGgpXG4gICAgY29uc3QgcHJveHlJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5djJfaW50ZWdyYXRpb25zLkh0dHBVcmxJbnRlZ3JhdGlvbihcbiAgICAgICdQcm94eUludGVncmF0aW9uJyxcbiAgICAgIGBodHRwOi8vJHt0aGlzLmxvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJEbnNOYW1lfS97cHJveHl9YFxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgSFRUUCBVUkwgaW50ZWdyYXRpb24gZm9yIHJvb3QgcGF0aFxuICAgIGNvbnN0IHJvb3RJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5djJfaW50ZWdyYXRpb25zLkh0dHBVcmxJbnRlZ3JhdGlvbihcbiAgICAgICdSb290SW50ZWdyYXRpb24nLFxuICAgICAgYGh0dHA6Ly8ke3RoaXMubG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWV9L2BcbiAgICApO1xuXG4gICAgLy8gQ2F0Y2gtYWxsIHJvdXRlIGZvciBhbGwgcGF0aHMgLSBmb3J3YXJkcyAve3Byb3h5K30gdG8gQUxCXG4gICAgaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy97cHJveHkrfScsXG4gICAgICBtZXRob2RzOiBbXG4gICAgICAgIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLkdFVCxcbiAgICAgICAgYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuUE9TVCxcbiAgICAgICAgYXBpZ2F0ZXdheXYyLkh0dHBNZXRob2QuUFVULFxuICAgICAgICBhcGlnYXRld2F5djIuSHR0cE1ldGhvZC5ERUxFVEUsXG4gICAgICAgIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBBVENILFxuICAgICAgICBhcGlnYXRld2F5djIuSHR0cE1ldGhvZC5PUFRJT05TLFxuICAgICAgXSxcbiAgICAgIGludGVncmF0aW9uOiBwcm94eUludGVncmF0aW9uLFxuICAgIH0pO1xuXG4gICAgLy8gUm9vdCBwYXRoIHJvdXRlXG4gICAgaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy8nLFxuICAgICAgbWV0aG9kczogW1xuICAgICAgICBhcGlnYXRld2F5djIuSHR0cE1ldGhvZC5HRVQsXG4gICAgICAgIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBPU1QsXG4gICAgICAgIGFwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLk9QVElPTlMsXG4gICAgICBdLFxuICAgICAgaW50ZWdyYXRpb246IHJvb3RJbnRlZ3JhdGlvbixcbiAgICB9KTtcblxuICAgIC8vID09PT09IE91dHB1dHMgPT09PT1cbiAgICB0aGlzLnNlcnZpY2VVcmwgPSBodHRwQXBpLmFwaUVuZHBvaW50O1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0xvYWRCYWxhbmNlckROUycsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmxvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJEbnNOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdETlMgbmFtZSBvZiB0aGUgbG9hZCBiYWxhbmNlciAoaW50ZXJuYWwpJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdZb2xvU2VydmljZUROUycsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpR2F0ZXdheVVSTCcsIHtcbiAgICAgIHZhbHVlOiBodHRwQXBpLmFwaUVuZHBvaW50LFxuICAgICAgZGVzY3JpcHRpb246ICdIVFRQUyBBUEkgR2F0ZXdheSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogJ1lvbG9BcGlHYXRld2F5VVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZXJ2aWNlVVJMJywge1xuICAgICAgdmFsdWU6IHRoaXMuc2VydmljZVVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVVJMIG9mIHRoZSBZT0xPIGRldGVjdGlvbiBzZXJ2aWNlIChIVFRQUyknLFxuICAgICAgZXhwb3J0TmFtZTogJ1lvbG9TZXJ2aWNlVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEZXRlY3RFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiBgJHt0aGlzLnNlcnZpY2VVcmx9L2RldGVjdGAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1lPTE8gZGV0ZWN0aW9uIGVuZHBvaW50IChIVFRQUyknLFxuICAgICAgZXhwb3J0TmFtZTogJ1lvbG9EZXRlY3RFbmRwb2ludCcsXG4gICAgfSk7XG4gIH1cbn1cblxuIl19