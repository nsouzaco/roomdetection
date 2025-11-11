/**
 * ECS/Fargate Stack for YOLO Room Detection Service
 * Deploys YOLOv8 model as a containerized service with API Gateway HTTPS proxy
 */
import * as cdk from 'aws-cdk-lib';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
export interface YoloEcsStackProps extends cdk.StackProps {
    /**
     * Existing API Gateway ID to integrate with (optional)
     */
    apiGatewayId?: string;
}
export declare class YoloEcsStack extends cdk.Stack {
    readonly serviceUrl: string;
    readonly loadBalancer: elbv2.ApplicationLoadBalancer;
    private readonly listener;
    constructor(scope: Construct, id: string, props?: YoloEcsStackProps);
}
