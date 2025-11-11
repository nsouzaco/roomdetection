/**
 * AWS CDK Stack for Location Detection AI
 * Creates S3 bucket, Lambda function, and API Gateway
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export declare class LocationDetectionStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
