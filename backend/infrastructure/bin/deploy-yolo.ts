#!/usr/bin/env node
/**
 * CDK App Entry Point for YOLO ECS Deployment
 * Deploys YOLO service to ECS/Fargate
 */
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { YoloEcsStack } from '../lib/yolo-ecs-stack';

const app = new cdk.App();

new YoloEcsStack(app, 'YoloRoomDetectionStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'YOLO Room Detection Service on ECS/Fargate',
  tags: {
    Project: 'LocationDetection',
    Service: 'YOLO',
    Environment: 'production',
  },
});

app.synth();

