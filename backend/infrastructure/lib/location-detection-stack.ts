/**
 * AWS CDK Stack for Location Detection AI
 * Creates S3 bucket, Lambda function, and API Gateway
 */
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class LocationDetectionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ===== S3 Bucket for Blueprint Storage =====
    const blueprintBucket = new s3.Bucket(this, 'BlueprintBucket', {
      bucketName: `location-detection-blueprints-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev/test - change to RETAIN for production
      autoDeleteObjects: true, // For dev/test
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'], // Restrict in production
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
        },
      ],
      lifecycleRules: [
        {
          id: 'DeleteOldBlueprints',
          enabled: true,
          expiration: cdk.Duration.days(1), // Delete after 24 hours
        },
      ],
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ===== Lambda Function for Room Detection =====
    
    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'RoomDetectionLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant S3 access
    blueprintBucket.grantReadWrite(lambdaRole);

    // Lambda function
    const roomDetectionFunction = new lambda.DockerImageFunction(this, 'RoomDetectionFunction', {
      functionName: 'location-detection-opencv',
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../../lambda'), {
        file: 'Dockerfile',
      }),
      memorySize: 3008, // Maximum memory for faster processing
      timeout: cdk.Duration.seconds(30),
      role: lambdaRole,
      environment: {
        S3_BUCKET_NAME: blueprintBucket.bucketName,
        MODEL_VERSION: 'phase_1_opencv',
        CONFIDENCE_THRESHOLD: '0.7',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      architecture: lambda.Architecture.X86_64,
    });

    // ===== API Gateway =====
    
    const api = new apigateway.RestApi(this, 'LocationDetectionApi', {
      restApiName: 'Location Detection API',
      description: 'API for detecting room boundaries in blueprints',
      binaryMediaTypes: ['multipart/form-data', 'image/*'], // Treat these as binary
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Restrict in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Lambda integration
    const detectIntegration = new apigateway.LambdaIntegration(roomDetectionFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
      proxy: true,
    });

    // /detect endpoint
    const detectResource = api.root.addResource('detect');
    detectResource.addMethod('POST', detectIntegration, {
      apiKeyRequired: false, // Add API key in production
    });

    // Pre-signed URL endpoint for S3 uploads
    const uploadFunction = new lambda.Function(this, 'UploadUrlFunction', {
      functionName: 'location-detection-upload-url',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import os
from datetime import datetime

s3_client = boto3.client('s3')
bucket_name = os.environ['S3_BUCKET_NAME']

def handler(event, context):
    try:
        body = json.loads(event.get('body', '{}'))
        filename = body.get('filename', f'blueprint-{datetime.now().isoformat()}.png')
        
        # Generate pre-signed URL
        url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': f'uploads/{filename}',
                'ContentType': 'image/png'
            },
            ExpiresIn=300  # 5 minutes
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'upload_url': url,
                'key': f'uploads/{filename}'
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
      `),
      environment: {
        S3_BUCKET_NAME: blueprintBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(10),
    });

    blueprintBucket.grantPut(uploadFunction);

    const uploadIntegration = new apigateway.LambdaIntegration(uploadFunction);
    const uploadResource = api.root.addResource('upload-url');
    uploadResource.addMethod('POST', uploadIntegration);

    // ===== CloudWatch Alarms =====
    
    // Alarm for high error rate
    roomDetectionFunction.metricErrors({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    }).createAlarm(this, 'HighErrorRateAlarm', {
      alarmName: 'LocationDetection-HighErrorRate',
      alarmDescription: 'Alert when error rate exceeds 5%',
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm for high duration
    roomDetectionFunction.metricDuration({
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    }).createAlarm(this, 'HighDurationAlarm', {
      alarmName: 'LocationDetection-HighDuration',
      alarmDescription: 'Alert when average duration exceeds 25 seconds',
      threshold: 25000, // 25 seconds in ms
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ===== Outputs =====
    
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'LocationDetectionApiEndpoint',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: blueprintBucket.bucketName,
      description: 'S3 bucket for blueprint storage',
      exportName: 'LocationDetectionBucketName',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: roomDetectionFunction.functionArn,
      description: 'Room detection Lambda function ARN',
      exportName: 'RoomDetectionFunctionArn',
    });
  }
}

