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
exports.LocationDetectionStack = void 0;
/**
 * AWS CDK Stack for Location Detection AI
 * Creates S3 bucket, Lambda function, and API Gateway
 */
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const path = __importStar(require("path"));
class LocationDetectionStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.LocationDetectionStack = LocationDetectionStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYXRpb24tZGV0ZWN0aW9uLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibG9jYXRpb24tZGV0ZWN0aW9uLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7OztHQUdHO0FBQ0gsaURBQW1DO0FBQ25DLHVEQUF5QztBQUN6QywrREFBaUQ7QUFDakQsdUVBQXlEO0FBQ3pELDJEQUE2QztBQUM3Qyx5REFBMkM7QUFFM0MsMkNBQTZCO0FBRTdCLE1BQWEsc0JBQXVCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw4Q0FBOEM7UUFDOUMsTUFBTSxlQUFlLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUM3RCxVQUFVLEVBQUUsaUNBQWlDLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDM0QsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLGlEQUFpRDtZQUMzRixpQkFBaUIsRUFBRSxJQUFJLEVBQUUsZUFBZTtZQUN4QyxJQUFJLEVBQUU7Z0JBQ0o7b0JBQ0UsY0FBYyxFQUFFO3dCQUNkLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRzt3QkFDbEIsRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHO3dCQUNsQixFQUFFLENBQUMsV0FBVyxDQUFDLElBQUk7cUJBQ3BCO29CQUNELGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLHlCQUF5QjtvQkFDaEQsY0FBYyxFQUFFLENBQUMsR0FBRyxDQUFDO29CQUNyQixjQUFjLEVBQUUsQ0FBQyxNQUFNLENBQUM7aUJBQ3pCO2FBQ0Y7WUFDRCxjQUFjLEVBQUU7Z0JBQ2Q7b0JBQ0UsRUFBRSxFQUFFLHFCQUFxQjtv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VUFBVSxFQUFFLDBCQUEwQjtTQUN2QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFqTkQsd0RBaU5DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBV1MgQ0RLIFN0YWNrIGZvciBMb2NhdGlvbiBEZXRlY3Rpb24gQUlcbiAqIENyZWF0ZXMgUzMgYnVja2V0LCBMYW1iZGEgZnVuY3Rpb24sIGFuZCBBUEkgR2F0ZXdheVxuICovXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBjbGFzcyBMb2NhdGlvbkRldGVjdGlvblN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gPT09PT0gUzMgQnVja2V0IGZvciBCbHVlcHJpbnQgU3RvcmFnZSA9PT09PVxuICAgIGNvbnN0IGJsdWVwcmludEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0JsdWVwcmludEJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBsb2NhdGlvbi1kZXRlY3Rpb24tYmx1ZXByaW50cy0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gRm9yIGRldi90ZXN0IC0gY2hhbmdlIHRvIFJFVEFJTiBmb3IgcHJvZHVjdGlvblxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsIC8vIEZvciBkZXYvdGVzdFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkdFVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBVVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBPU1QsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sIC8vIFJlc3RyaWN0IGluIHByb2R1Y3Rpb25cbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgICAgZXhwb3NlZEhlYWRlcnM6IFsnRVRhZyddLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZU9sZEJsdWVwcmludHMnLFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMSksIC8vIERlbGV0ZSBhZnRlciAyNCBob3Vyc1xuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PSBMYW1iZGEgRnVuY3Rpb24gZm9yIFJvb20gRGV0ZWN0aW9uID09PT09XG4gICAgXG4gICAgLy8gTGFtYmRhIGV4ZWN1dGlvbiByb2xlXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnUm9vbURldGVjdGlvbkxhbWJkYVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBTMyBhY2Nlc3NcbiAgICBibHVlcHJpbnRCdWNrZXQuZ3JhbnRSZWFkV3JpdGUobGFtYmRhUm9sZSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb25cbiAgICBjb25zdCByb29tRGV0ZWN0aW9uRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkRvY2tlckltYWdlRnVuY3Rpb24odGhpcywgJ1Jvb21EZXRlY3Rpb25GdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ2xvY2F0aW9uLWRldGVjdGlvbi1vcGVuY3YnLFxuICAgICAgY29kZTogbGFtYmRhLkRvY2tlckltYWdlQ29kZS5mcm9tSW1hZ2VBc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vbGFtYmRhJyksIHtcbiAgICAgICAgZmlsZTogJ0RvY2tlcmZpbGUnLFxuICAgICAgfSksXG4gICAgICBtZW1vcnlTaXplOiAzMDA4LCAvLyBNYXhpbXVtIG1lbW9yeSBmb3IgZmFzdGVyIHByb2Nlc3NpbmdcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBTM19CVUNLRVRfTkFNRTogYmx1ZXByaW50QnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIE1PREVMX1ZFUlNJT046ICdwaGFzZV8xX29wZW5jdicsXG4gICAgICAgIENPTkZJREVOQ0VfVEhSRVNIT0xEOiAnMC43JyxcbiAgICAgIH0sXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5YODZfNjQsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PSBBUEkgR2F0ZXdheSA9PT09PVxuICAgIFxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0xvY2F0aW9uRGV0ZWN0aW9uQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6ICdMb2NhdGlvbiBEZXRlY3Rpb24gQVBJJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIGZvciBkZXRlY3Rpbmcgcm9vbSBib3VuZGFyaWVzIGluIGJsdWVwcmludHMnLFxuICAgICAgYmluYXJ5TWVkaWFUeXBlczogWydtdWx0aXBhcnQvZm9ybS1kYXRhJywgJ2ltYWdlLyonXSwgLy8gVHJlYXQgdGhlc2UgYXMgYmluYXJ5XG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHRydWUsXG4gICAgICAgIG1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUywgLy8gUmVzdHJpY3QgaW4gcHJvZHVjdGlvblxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZScsXG4gICAgICAgICAgJ1gtQW16LURhdGUnLFxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcbiAgICAgICAgICAnWC1BcGktS2V5JyxcbiAgICAgICAgICAnWC1BbXotU2VjdXJpdHktVG9rZW4nLFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIExhbWJkYSBpbnRlZ3JhdGlvblxuICAgIGNvbnN0IGRldGVjdEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocm9vbURldGVjdGlvbkZ1bmN0aW9uLCB7XG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7ICdhcHBsaWNhdGlvbi9qc29uJzogJ3sgXCJzdGF0dXNDb2RlXCI6IFwiMjAwXCIgfScgfSxcbiAgICAgIHByb3h5OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gL2RldGVjdCBlbmRwb2ludFxuICAgIGNvbnN0IGRldGVjdFJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2RldGVjdCcpO1xuICAgIGRldGVjdFJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGRldGVjdEludGVncmF0aW9uLCB7XG4gICAgICBhcGlLZXlSZXF1aXJlZDogZmFsc2UsIC8vIEFkZCBBUEkga2V5IGluIHByb2R1Y3Rpb25cbiAgICB9KTtcblxuICAgIC8vIFByZS1zaWduZWQgVVJMIGVuZHBvaW50IGZvciBTMyB1cGxvYWRzXG4gICAgY29uc3QgdXBsb2FkRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVcGxvYWRVcmxGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ2xvY2F0aW9uLWRldGVjdGlvbi11cGxvYWQtdXJsJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG5pbXBvcnQganNvblxuaW1wb3J0IGJvdG8zXG5pbXBvcnQgb3NcbmZyb20gZGF0ZXRpbWUgaW1wb3J0IGRhdGV0aW1lXG5cbnMzX2NsaWVudCA9IGJvdG8zLmNsaWVudCgnczMnKVxuYnVja2V0X25hbWUgPSBvcy5lbnZpcm9uWydTM19CVUNLRVRfTkFNRSddXG5cbmRlZiBoYW5kbGVyKGV2ZW50LCBjb250ZXh0KTpcbiAgICB0cnk6XG4gICAgICAgIGJvZHkgPSBqc29uLmxvYWRzKGV2ZW50LmdldCgnYm9keScsICd7fScpKVxuICAgICAgICBmaWxlbmFtZSA9IGJvZHkuZ2V0KCdmaWxlbmFtZScsIGYnYmx1ZXByaW50LXtkYXRldGltZS5ub3coKS5pc29mb3JtYXQoKX0ucG5nJylcbiAgICAgICAgXG4gICAgICAgICMgR2VuZXJhdGUgcHJlLXNpZ25lZCBVUkxcbiAgICAgICAgdXJsID0gczNfY2xpZW50LmdlbmVyYXRlX3ByZXNpZ25lZF91cmwoXG4gICAgICAgICAgICAncHV0X29iamVjdCcsXG4gICAgICAgICAgICBQYXJhbXM9e1xuICAgICAgICAgICAgICAgICdCdWNrZXQnOiBidWNrZXRfbmFtZSxcbiAgICAgICAgICAgICAgICAnS2V5JzogZid1cGxvYWRzL3tmaWxlbmFtZX0nLFxuICAgICAgICAgICAgICAgICdDb250ZW50VHlwZSc6ICdpbWFnZS9wbmcnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgRXhwaXJlc0luPTMwMCAgIyA1IG1pbnV0ZXNcbiAgICAgICAgKVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICdzdGF0dXNDb2RlJzogMjAwLFxuICAgICAgICAgICAgJ2hlYWRlcnMnOiB7XG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHtcbiAgICAgICAgICAgICAgICAndXBsb2FkX3VybCc6IHVybCxcbiAgICAgICAgICAgICAgICAna2V5JzogZid1cGxvYWRzL3tmaWxlbmFtZX0nXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ3N0YXR1c0NvZGUnOiA1MDAsXG4gICAgICAgICAgICAnaGVhZGVycyc6IHtcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoeydlcnJvcic6IHN0cihlKX0pXG4gICAgICAgIH1cbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUzNfQlVDS0VUX05BTUU6IGJsdWVwcmludEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICB9KTtcblxuICAgIGJsdWVwcmludEJ1Y2tldC5ncmFudFB1dCh1cGxvYWRGdW5jdGlvbik7XG5cbiAgICBjb25zdCB1cGxvYWRJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVwbG9hZEZ1bmN0aW9uKTtcbiAgICBjb25zdCB1cGxvYWRSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCd1cGxvYWQtdXJsJyk7XG4gICAgdXBsb2FkUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgdXBsb2FkSW50ZWdyYXRpb24pO1xuXG4gICAgLy8gPT09PT0gQ2xvdWRXYXRjaCBBbGFybXMgPT09PT1cbiAgICBcbiAgICAvLyBBbGFybSBmb3IgaGlnaCBlcnJvciByYXRlXG4gICAgcm9vbURldGVjdGlvbkZ1bmN0aW9uLm1ldHJpY0Vycm9ycyh7XG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KS5jcmVhdGVBbGFybSh0aGlzLCAnSGlnaEVycm9yUmF0ZUFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiAnTG9jYXRpb25EZXRlY3Rpb24tSGlnaEVycm9yUmF0ZScsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWxlcnQgd2hlbiBlcnJvciByYXRlIGV4Y2VlZHMgNSUnLFxuICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjZGsuYXdzX2Nsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pO1xuXG4gICAgLy8gQWxhcm0gZm9yIGhpZ2ggZHVyYXRpb25cbiAgICByb29tRGV0ZWN0aW9uRnVuY3Rpb24ubWV0cmljRHVyYXRpb24oe1xuICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pLmNyZWF0ZUFsYXJtKHRoaXMsICdIaWdoRHVyYXRpb25BbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogJ0xvY2F0aW9uRGV0ZWN0aW9uLUhpZ2hEdXJhdGlvbicsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWxlcnQgd2hlbiBhdmVyYWdlIGR1cmF0aW9uIGV4Y2VlZHMgMjUgc2Vjb25kcycsXG4gICAgICB0aHJlc2hvbGQ6IDI1MDAwLCAvLyAyNSBzZWNvbmRzIGluIG1zXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNkay5hd3NfY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PSBPdXRwdXRzID09PT09XG4gICAgXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUVuZHBvaW50Jywge1xuICAgICAgdmFsdWU6IGFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IGVuZHBvaW50IFVSTCcsXG4gICAgICBleHBvcnROYW1lOiAnTG9jYXRpb25EZXRlY3Rpb25BcGlFbmRwb2ludCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBibHVlcHJpbnRCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgYnVja2V0IGZvciBibHVlcHJpbnQgc3RvcmFnZScsXG4gICAgICBleHBvcnROYW1lOiAnTG9jYXRpb25EZXRlY3Rpb25CdWNrZXROYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdMYW1iZGFGdW5jdGlvbkFybicsIHtcbiAgICAgIHZhbHVlOiByb29tRGV0ZWN0aW9uRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1Jvb20gZGV0ZWN0aW9uIExhbWJkYSBmdW5jdGlvbiBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogJ1Jvb21EZXRlY3Rpb25GdW5jdGlvbkFybicsXG4gICAgfSk7XG4gIH1cbn1cblxuIl19