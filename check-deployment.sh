#!/bin/bash

# Monitor AWS deployment status

echo "🔍 Checking AWS Deployment Status..."
echo ""

# Check if deployment process is running
if ps aux | grep "cdk deploy" | grep -v grep > /dev/null; then
    echo "✅ CDK deployment is running"
    echo ""
fi

# Check CloudFormation stack
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name LocationDetectionStack \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "📦 CloudFormation Stack Status: $STACK_STATUS"
    
    if [ "$STACK_STATUS" == "CREATE_COMPLETE" ] || [ "$STACK_STATUS" == "UPDATE_COMPLETE" ]; then
        echo ""
        echo "🎉 DEPLOYMENT COMPLETE!"
        echo ""
        
        # Get API endpoint
        API_URL=$(aws cloudformation describe-stacks \
            --stack-name LocationDetectionStack \
            --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
            --output text)
        
        BUCKET=$(aws cloudformation describe-stacks \
            --stack-name LocationDetectionStack \
            --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
            --output text)
        
        echo "📋 Stack Outputs:"
        echo "   API Endpoint: $API_URL"
        echo "   S3 Bucket: $BUCKET"
        echo ""
        echo "✅ Update your .env file:"
        echo "   VITE_API_URL=$API_URL"
        echo ""
    elif [[ "$STACK_STATUS" == *"PROGRESS"* ]]; then
        echo "⏳ Stack creation/update in progress..."
        echo ""
        echo "Resources being created:"
        aws cloudformation list-stack-resources \
            --stack-name LocationDetectionStack \
            --query 'StackResourceSummaries[?ResourceStatus==`CREATE_IN_PROGRESS`].[LogicalResourceId,ResourceType]' \
            --output table
    elif [[ "$STACK_STATUS" == *"FAILED"* ]] || [[ "$STACK_STATUS" == *"ROLLBACK"* ]]; then
        echo "❌ Deployment failed"
        echo ""
        echo "Check CloudWatch logs:"
        echo "   aws logs tail /aws/lambda/location-detection-opencv --follow"
    fi
else
    echo "⏳ Stack not yet created - Docker image still building..."
    echo ""
    echo "This usually takes 5-10 minutes for first deployment."
    echo "The OpenCV Lambda container is being built and pushed to ECR."
    echo ""
    echo "Run this script again in a few minutes to check progress."
fi

echo ""
echo "---"
echo "Frontend: https://roomdetection-jcivqez1k-natalyscst-gmailcoms-projects.vercel.app"
echo "---"

